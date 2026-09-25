/**
 * Source Extractor Service
 *
 * Turns a student-supplied link into plain study text that the existing AI
 * notes pipeline can consume. Two source types are supported:
 *
 *   - YouTube  -> the public caption/transcript track for the video.
 *   - Article  -> the readable body of a blog/news/documentation page.
 *
 * Design rules that this module must never break:
 *   1. The URL is NEVER handed to the LLM as if the model could "watch" it.
 *      Only extracted text is sent onward.
 *   2. Nothing here bypasses authentication, DRM, paywalls, age gates or
 *      private videos. If the public transcript is unavailable we fail loudly
 *      and let the UI offer a paste-the-transcript fallback.
 *   3. All network access goes through `safeFetchText` (SSRF-hardened).
 */

import { URL_FETCH_CONFIG, ERROR_MESSAGES } from '../config/constants';
import {
  safeFetchText,
  safePostJson,
  parseSafeUrl,
  UrlFetchError,
} from '../utils/helpers';

export type SourceType = 'youtube' | 'article';

export interface ExtractedSource {
  type: SourceType;
  /** Short human label shown in the UI, e.g. "YouTube video" or "Article". */
  label: string;
  title: string;
  /** The source link, normalised (no trackers). */
  url: string;
  /** Plain text to summarise. Never empty. */
  text: string;
  /** Character count of `text` after truncation. */
  chars: number;
  /** Transcript language code for YouTube sources. */
  language?: string;
}

// ============================================================================
// YOUTUBE
// ============================================================================

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

/** YouTube video ids are 11 URL-safe base64 characters. */
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Public YouTube clients for the InnerTube `player` endpoint.
 * The caption track list they return is bound to their own request, which is
 * what makes the resulting caption URL fetchable. Nothing here is private: the
 * API key is the one YouTube embeds in every watch page, and no cookies,
 * login, DRM or paywall is involved.
 */
const INNERTUBE_CLIENTS: Array<{ name: string; id: string; version: string; userAgent: string }> = [
  {
    name: 'ANDROID',
    id: '3',
    version: '20.10.38',
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
  },
  {
    name: 'IOS',
    id: '5',
    version: '20.10.4',
    userAgent:
      'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3 like Mac OS X; en_US) gzip',
  },
];

/** True when the parsed URL points at YouTube (video or otherwise). */
export function isYouTubeUrl(url: URL): boolean {
  return YOUTUBE_HOSTS.has(url.hostname.toLowerCase());
}

/**
 * Extract the video id from the common YouTube URL shapes:
 *   /watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID, /live/ID, /v/ID,
 *   plus /playlist?video=ID and ?v=ID&t=... variants.
 */
export function extractYouTubeVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const candidate = segments[0];
    return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
  }

  if (!YOUTUBE_HOSTS.has(host)) return null;

  const queryId = url.searchParams.get('v');
  if (queryId && VIDEO_ID_PATTERN.test(queryId)) return queryId;

  const pathPrefixes = ['shorts', 'embed', 'live', 'v'];
  if (segments.length >= 2 && pathPrefixes.includes(segments[0])) {
    const candidate = segments[1];
    if (VIDEO_ID_PATTERN.test(candidate)) return candidate;
  }

  return null;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  /** 'asr' marks an auto-generated track; manual tracks are preferred. */
  kind?: string;
  name?: { simpleText?: string };
}

interface YouTubePlayerResponse {
  videoDetails?: { title?: string; isLiveContent?: boolean };
  playabilityStatus?: { status?: string; reason?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
  };
}

/** Pull a JSON blob out of the `ytInitialPlayerResponse = {...};` assignment. */
function readPlayerResponse(html: string): YouTubePlayerResponse | null {
  const markerIndex = html.indexOf('ytInitialPlayerResponse');
  if (markerIndex === -1) return null;

  const start = html.indexOf('{', markerIndex);
  if (start === -1) return null;

  // Brace-match from the first object; the payload is JSON so this is safe.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as YouTubePlayerResponse;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** json3 -> plain transcript text, joining cue fragments and dropping duplicates. */
function parseJson3Transcript(payload: any): string {
  const events: any[] = Array.isArray(payload?.events) ? payload.events : [];
  const parts: string[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    const segs: any[] = Array.isArray(event?.segs) ? event.segs : [];
    if (!segs.length) continue;
    const line = segs
      .map((seg) => (typeof seg?.utf8 === 'string' ? seg.utf8 : ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!line) continue;
    // Rolling auto-captions repeat the previous line as rolling context.
    if (seen.has(line)) continue;
    seen.add(line);
    parts.push(line);
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** XML (default timedtext format) -> plain transcript text. */
function parseTimedTextXml(xml: string): string {
  const cues: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) cues.push(text);
  }
  return cues.join(' ').replace(/\s+/g, ' ').trim();
}

function pickCaptionTrack(tracks: CaptionTrack[]): CaptionTrack {
  const manualEnglish = tracks.find((t) => t.languageCode?.startsWith('en') && !t.kind);
  if (manualEnglish) return manualEnglish;
  const anyEnglish = tracks.find((t) => t.languageCode?.startsWith('en'));
  if (anyEnglish) return anyEnglish;
  return tracks[0];
}

function truncate(text: string): string {
  const collapsed = text.replace(/\n{3,}/g, '\n\n').trim();
  if (collapsed.length <= URL_FETCH_CONFIG.MAX_EXTRACTED_CHARS) return collapsed;
  return `${collapsed.slice(0, URL_FETCH_CONFIG.MAX_EXTRACTED_CHARS).trimEnd()}…`;
}

/**
 * Retrieve the public transcript for a YouTube video.
 *
 * How it works (all public, unauthenticated data — no auth, DRM, paywall or
 * private-video bypass is attempted):
 *   1. Load the watch page to read the public InnerTube API key that YouTube
 *      embeds in every page, plus the video title and playability status.
 *   2. Ask the public InnerTube `player` endpoint for the video's caption track
 *      list. The `captionTracks[].baseUrl` handed back here is bound to that
 *      request and is what the caption endpoint actually honours.
 *   3. Download that caption track and flatten it to plain text.
 *
 * If captions are unavailable (private video, captions disabled, region or age
 * restricted) we fail with a clear message rather than inventing a summary.
 */
async function extractYouTube(videoId: string): Promise<ExtractedSource> {
  const watchUrl = new URL('https://www.youtube.com/watch');
  watchUrl.searchParams.set('v', videoId);
  watchUrl.searchParams.set('hl', 'en');

  const page = await safeFetchText(watchUrl);
  const player = readPlayerResponse(page.body);

  // LOGIN_REQUIRED / UNPLAYABLE / AGE_VERIFICATION_REQUIRED / ERROR ...
  const status = player?.playabilityStatus?.status;
  if (player && status && status !== 'OK') {
    throw new UrlFetchError(ERROR_MESSAGES.YOUTUBE_NO_TRANSCRIPT, 'YOUTUBE_NO_TRANSCRIPT', 422);
  }

  const apiKey = page.body.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];

  // Caption tracks from the public player endpoint (preferred), falling back
  // to the ones embedded in the watch page HTML.
  let tracks: CaptionTrack[] =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  if (apiKey) {
    for (const client of INNERTUBE_CLIENTS) {
      try {
        const data = await safePostJson(
          `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false`,
          {
            videoId,
            context: {
              client: {
                clientName: client.name,
                clientVersion: client.version,
                hl: 'en',
                gl: 'US',
              },
            },
          },
          {
            'User-Agent': client.userAgent,
            'X-Youtube-Client-Name': client.id,
            'X-Youtube-Client-Version': client.version,
          },
        );
        const playerTracks: CaptionTrack[] =
          data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
        if (playerTracks.length) {
          tracks = playerTracks;
          break;
        }
      } catch {
        // Try the next public client; the watch-page tracks remain as a fallback.
      }
    }
  }

  if (!tracks.length) {
    throw new UrlFetchError(ERROR_MESSAGES.YOUTUBE_NO_TRANSCRIPT, 'YOUTUBE_NO_TRANSCRIPT', 422);
  }

  const track = pickCaptionTrack(tracks);
  const transcriptUrl = new URL(track.baseUrl);
  transcriptUrl.searchParams.set('fmt', 'json3');

  const transcriptResponse = await safeFetchText(transcriptUrl);
  let transcript = '';
  try {
    transcript = parseJson3Transcript(JSON.parse(transcriptResponse.body));
  } catch {
    transcript = parseTimedTextXml(transcriptResponse.body);
  }

  if (transcript.length < 200) {
    throw new UrlFetchError(ERROR_MESSAGES.YOUTUBE_NO_TRANSCRIPT, 'YOUTUBE_NO_TRANSCRIPT', 422);
  }

  const text = truncate(transcript);
  return {
    type: 'youtube',
    label: 'YouTube video',
    title: player?.videoDetails?.title?.trim() || `YouTube video ${videoId}`,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    text,
    chars: text.length,
    language: track.languageCode,
  };
}

// ============================================================================
// ARTICLE / BLOG READABILITY
// ============================================================================

const NOISE_TAGS = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'iframe',
  'object',
  'embed',
  'form',
  'nav',
  'aside',
  'footer',
  'header',
  'button',
];

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&hellip;': '…',
  '&mdash;': '—',
  '&ndash;': '–',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&middot;': '·',
  '&bull;': '•',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
};

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ' ';
  try {
    return String.fromCodePoint(code);
  } catch {
    return ' ';
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&[a-z]+;/gi, (entity) => ENTITIES[entity.toLowerCase()] ?? ' ');
}

function stripNoise(html: string): string {
  let out = html;
  for (const tag of NOISE_TAGS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi'), ' ');
    out = out.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), ' ');
  }
  out = out.replace(/<!--[\s\S]*?-->/g, ' ');
  out = out.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ' ');
  return out;
}

function readMeta(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const value = html.match(pattern)?.[1];
    if (!value) continue;
    const decoded = decodeEntities(value.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (decoded) return decoded.slice(0, 180);
  }
  return '';
}

function extractTitle(html: string): string {
  const meta = readMeta(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
  ]);
  if (meta) return meta;

  const h1 = html.match(/<h1\b[^>]*>([\s\S]{0,400}?)<\/h1>/i);
  if (h1?.[1]) {
    const text = decodeEntities(h1[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (text) return text.slice(0, 180);
  }

  const title = html.match(/<title\b[^>]*>([\s\S]{0,400}?)<\/title>/i);
  if (title?.[1]) {
    const text = decodeEntities(title[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (text) return (text.split('|')[0].split('-')[0].trim() || text).slice(0, 180);
  }

  return 'Untitled page';
}

/** Restrict the page to its main content region when the markup exposes one. */
function pickContentRegion(html: string): string {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article?.[1] && article[1].length > 400) return article[1];

  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main?.[1] && main[1].length > 400) return main[1];

  const roleMain = html.match(/<([a-z]+)\b[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/\1>/i);
  if (roleMain?.[2] && roleMain[2].length > 400) return roleMain[2];

  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return body?.[1] ?? html;
}

const BLOCK_TAGS =
  /<\/?(?:p|div|section|br|li|ul|ol|h[1-6]|tr|td|th|table|blockquote|pre|figure|figcaption)\b[^>]*>/gi;

const CHROME_PREFIX =
  /^(cookie|privacy|terms|sign in|log in|login|menu|share|advertisement|sponsored|read more|related|accept|necessary|manage|skip to|newsletter|subscribe|follow us|copyright|all rights|privacy policy|terms of use)\b/i;

/**
 * Readability-lite: keep block text, drop boilerplate by shape (short,
 * punctuation-free fragments are menu/cookie/legal chrome, not prose).
 */
function extractReadableText(html: string): string {
  const region = stripNoise(pickContentRegion(html));

  const blocks: string[] = [];
  const re = /<(p|h[1-6]|li|blockquote|pre|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(region)) !== null) {
    const tag = match[1].toLowerCase();
    const inner = match[2].replace(BLOCK_TAGS, ' ');
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ' '))
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\s*\n\s*/g, ' ')
      .trim();
    if (text.length < 2) continue;

    const isHeading = tag.startsWith('h');
    const looksLikeChrome =
      !isHeading &&
      text.length < 90 &&
      !/[.!?;:)]$/.test(text) &&
      (text.split(' ').length <= 12 || CHROME_PREFIX.test(text));
    if (looksLikeChrome) continue;

    blocks.push(isHeading ? `\n${text}\n` : text);
  }

  const joined = blocks.join('\n').trim();
  if (joined.length < URL_FETCH_CONFIG.MIN_EXTRACTED_CHARS) {
    // Last resort: strip every remaining tag from the cleaned region.
    return decodeEntities(region.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  }

  return joined.replace(/\n{3,}/g, '\n\n').replace(/[^\S\n]{2,}/g, ' ').trim();
}

/** Remove common tracking parameters so the stored link stays clean. */
function canonicalUrl(url: URL): string {
  const tracker = /^(utm_|fbclid|gclid|igshid|mc_|ref|source)/i;
  for (const key of [...url.searchParams.keys()]) {
    if (tracker.test(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.toString();
}

async function extractArticle(url: URL): Promise<ExtractedSource> {
  const page = await safeFetchText(url);
  const raw = extractReadableText(page.body);

  if (!raw || raw.length < URL_FETCH_CONFIG.MIN_EXTRACTED_CHARS) {
    throw new UrlFetchError(ERROR_MESSAGES.URL_UNSUPPORTED, 'URL_UNSUPPORTED', 422);
  }

  const text = truncate(raw);
  let resolved: URL;
  try {
    resolved = new URL(page.url);
  } catch {
    resolved = url;
  }

  return {
    type: 'article',
    label: 'Article',
    title: extractTitle(page.body) || resolved.hostname,
    url: canonicalUrl(resolved),
    text,
    chars: text.length,
  };
}

// ============================================================================
// PUBLIC ENTRY POINT
// ============================================================================

/**
 * Validate, fetch and extract any supported source URL.
 * Always throws a UrlFetchError with a student-readable message on failure —
 * it never invents content.
 */
export async function extractSource(rawUrl: unknown): Promise<ExtractedSource> {
  const url = await parseSafeUrl(rawUrl);

  if (isYouTubeUrl(url)) {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      throw new UrlFetchError(
        'That YouTube link does not point to a single video. Open the video, copy its link, and try again.',
        'YOUTUBE_NO_TRANSCRIPT',
        422,
      );
    }
    return extractYouTube(videoId);
  }

  return extractArticle(url);
}
