/**
 * Server Utility Functions
 *
 * Reusable helper functions for the backend.
 */

import { Request, Response as ExpressResponse } from 'express';
import dns from 'node:dns/promises';
import net from 'node:net';
import { sanitizeProviderError } from '../../ai-provider';
import { URL_FETCH_CONFIG, ERROR_MESSAGES } from '../config/constants';

// Express exports a `Response` type that would shadow the WHATWG fetch
// `Response` used by safeFetchText below, so the fetch type is aliased here.
type FetchResponse = globalThis.Response;

// ============================================================================
// SSRF-SAFE OUTBOUND URL FETCHING
// ============================================================================

/**
 * TeenGenius fetches a student-supplied URL server-side, which is a classic
 * Server-Side Request Forgery (SSRF) sink. Every hop is therefore validated:
 *
 *   1. Scheme must be http/https (no file:, gopher:, data:, ftp: ...).
 *   2. Credentials embedded in the URL are rejected.
 *   3. The hostname is checked against loopback / private / link-local /
 *      reserved literals and internal-only suffixes.
 *   4. The hostname is DNS-resolved and EVERY returned address is re-checked,
 *      which defeats DNS records that point at an internal IP.
 *   5. Redirects are followed manually, capped, and each Location is fully
 *      re-validated (an open redirect must not launder a private target).
 *   6. Response bodies are streamed with a hard byte cap and a wall-clock
 *      timeout so a hostile endpoint cannot exhaust memory or connections.
 */
export class UrlFetchError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = 'UrlFetchError';
    this.code = code;
    this.status = status;
  }
}

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.intranet',
  '.private',
  '.corp',
  '.home',
  '.lan',
  '.test',
  '.example',
  '.invalid',
  'metadata.google.internal',
  'metadata.goog',
];

const BLOCKED_HOST_EXACT = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

/** True when a literal IP (v4 or v6) belongs to a non-public range. */
export function isPrivateAddress(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) {
    const parts = ip.split('.').map((p) => Number(p));
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8 "this network"
    if (a === 10) return true; // private
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 192 && b === 0) return true; // IETF protocol assignments
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    if (lower.startsWith('ff')) return true; // multicast
    // IPv4-mapped / IPv4-compatible forms (::ffff:10.0.0.1)
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }

  return true; // Not an IP literal -> unsafe for the literal check
}

/** Syntactic host check performed before any DNS lookup. */
function assertHostnameIsNotInternal(hostname: string): void {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_HOST_EXACT.has(host)) {
    throw new UrlFetchError('Internal destinations are not allowed.', 'URL_BLOCKED', 400);
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(suffix))) {
    throw new UrlFetchError('Internal destinations are not allowed.', 'URL_BLOCKED', 400);
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new UrlFetchError('Internal destinations are not allowed.', 'URL_BLOCKED', 400);
    }
    return;
  }
  // A hostname must look like a real DNS name (letters/digits/hyphens/dots).
  if (!/^[a-z0-9.-]{1,253}$/i.test(host) || host.includes('..')) {
    throw new UrlFetchError('That hostname is not valid.', 'URL_INVALID', 400);
  }
}

/** DNS-resolve and confirm every address is publicly routable. */
async function assertResolvesToPublicIp(hostname: string): Promise<void> {
  if (net.isIP(hostname)) return; // already a public literal

  let records: Array<{ address: string }>;
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UrlFetchError('That domain could not be resolved.', 'URL_UNREACHABLE', 502);
  }
  if (!records.length) {
    throw new UrlFetchError('That domain could not be resolved.', 'URL_UNREACHABLE', 502);
  }
  for (const record of records) {
    if (isPrivateAddress(record.address)) {
      throw new UrlFetchError('Internal destinations are not allowed.', 'URL_BLOCKED', 400);
    }
  }
}

// ============================================================================
// URL PARSING + CAPPED FETCH
// ============================================================================

/** Parse and fully validate a user-supplied URL. */
export async function parseSafeUrl(raw: unknown): Promise<URL> {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new UrlFetchError('A link is required.', 'URL_INVALID', 400);
  }
  const trimmed = raw.trim();
  if (trimmed.length > 2048) {
    throw new UrlFetchError('That link is too long to be valid.', 'URL_INVALID', 400);
  }
  // Accept bare hosts ("youtube.com/watch?v=x") by assuming https.
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new UrlFetchError('That link is not a valid URL.', 'URL_INVALID', 400);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UrlFetchError('Only http and https links are supported.', 'URL_INVALID', 400);
  }
  if (url.username || url.password) {
    throw new UrlFetchError('Links with embedded credentials are not supported.', 'URL_INVALID', 400);
  }
  if (!url.hostname) {
    throw new UrlFetchError('That link is missing a website address.', 'URL_INVALID', 400);
  }

  assertHostnameIsNotInternal(url.hostname);
  await assertResolvesToPublicIp(url.hostname.toLowerCase().replace(/^\[|\]$/g, ''));
  return url;
}

function isAllowedContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const type = contentType.split(';')[0].trim().toLowerCase();
  return (URL_FETCH_CONFIG.ALLOWED_CONTENT_TYPES as readonly string[]).includes(type);
}

/** Read a body with a hard byte cap so a huge response cannot exhaust memory. */
async function readCappedBody(response: FetchResponse): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length') || '0');
  if (declaredLength && declaredLength > URL_FETCH_CONFIG.MAX_RESPONSE_BYTES) {
    throw new UrlFetchError('That page is too large to summarise.', 'URL_TOO_LARGE', 413);
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let received = 0;
  let text = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > URL_FETCH_CONFIG.MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new UrlFetchError('That page is too large to summarise.', 'URL_TOO_LARGE', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof UrlFetchError) throw error;
    throw new UrlFetchError('The page could not be read completely.', 'URL_UNREACHABLE', 502);
  }

  return text;
}

export interface SafeFetchResult {
  url: string;
  status: number;
  contentType: string;
  body: string;
}

/**
 * Fetch a remote page as text with SSRF protection, redirect caps, a byte cap
 * and a wall-clock timeout. Redirect targets are validated exactly like the
 * original URL, so an open redirect cannot reach an internal address.
 */
export async function safeFetchText(input: string | URL): Promise<SafeFetchResult> {
  let current = typeof input === 'string' ? await parseSafeUrl(input) : input;

  for (let hop = 0; hop <= URL_FETCH_CONFIG.MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), URL_FETCH_CONFIG.REQUEST_TIMEOUT_MS);

    let response: FetchResponse;
    try {
      response = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': URL_FETCH_CONFIG.USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (error: any) {
      clearTimeout(timer);
      if (error?.name === 'AbortError') {
        throw new UrlFetchError('That page took too long to load.', 'URL_UNREACHABLE', 504);
      }
      throw new UrlFetchError('That page could not be reached.', 'URL_UNREACHABLE', 502);
    }

    try {
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        await response.body?.cancel().catch(() => {});
        if (hop === URL_FETCH_CONFIG.MAX_REDIRECTS) {
          throw new UrlFetchError('That link redirects too many times.', 'URL_UNREACHABLE', 502);
        }
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          throw new UrlFetchError('That link redirects to an invalid address.', 'URL_INVALID', 400);
        }
        current = await parseSafeUrl(next);
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        if ([401, 403, 429].includes(response.status)) {
          throw new UrlFetchError(
            'That page is behind a login or blocks automated access.',
            'URL_UNREACHABLE',
            403,
          );
        }
        throw new UrlFetchError(
          `That page returned an error (HTTP ${response.status}).`,
          'URL_UNREACHABLE',
          502,
        );
      }

      const contentType = response.headers.get('content-type') || '';
      if (!isAllowedContentType(contentType)) {
        await response.body?.cancel().catch(() => {});
        throw new UrlFetchError('That link is not a readable web page.', 'URL_UNSUPPORTED', 415);
      }

      const body = await readCappedBody(response);
      return { url: current.toString(), status: response.status, contentType, body };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new UrlFetchError('That link redirects too many times.', 'URL_UNREACHABLE', 502);
}

/**
 * POST JSON to a host that was already validated by parseSafeUrl, with the same
 * timeout and byte-cap protections as safeFetchText. Used for the YouTube
 * InnerTube public player endpoint, which returns caption track URLs.
 */
export async function safePostJson(
  target: string,
  payload: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<any> {
  const url = await parseSafeUrl(target);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), URL_FETCH_CONFIG.REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': URL_FETCH_CONFIG.USER_AGENT,
        Accept: 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new UrlFetchError(
        `YouTube did not return caption data (HTTP ${response.status}).`,
        'YOUTUBE_NO_TRANSCRIPT',
        502,
      );
    }

    const text = await readCappedBody(response);
    try {
      return JSON.parse(text);
    } catch {
      throw new UrlFetchError(
        ERROR_MESSAGES.YOUTUBE_NO_TRANSCRIPT,
        'YOUTUBE_NO_TRANSCRIPT',
        422,
      );
    }
  } catch (error) {
    if (error instanceof UrlFetchError) throw error;
    if ((error as any)?.name === 'AbortError') {
      throw new UrlFetchError('YouTube took too long to respond.', 'URL_UNREACHABLE', 504);
    }
    throw new UrlFetchError(ERROR_MESSAGES.YOUTUBE_NO_TRANSCRIPT, 'YOUTUBE_NO_TRANSCRIPT', 422);
  } finally {
    clearTimeout(timer);
  }
}


// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Log AI request/response events
 */
export function logAiRequest(
  endpoint: string,
  model?: string,
  category: string = 'ok',
  status?: number,
  durationMs: number = 0,
  message?: string
): void {
  const parts = [
    `[AI]`,
    `provider=groq`,
    `endpoint=${endpoint}`,
    `model=${model || '-'}`,
    `category=${category}`,
    status !== undefined ? `status=${status}` : '',
    `durationMs=${durationMs}`,
    message ? `message="${sanitizeProviderError(message)}"` : '',
  ].filter(Boolean);

  console.log(parts.join(' '));
}

/**
 * Send standardized error response
 */
export function sendErrorResponse(
  res: ExpressResponse,
  status: number,
  errorMessage: string,
  code: string,
  retryAfterSeconds?: number
): void {
  if (res.headersSent) return;

  if (retryAfterSeconds !== undefined) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
  }

  res.status(status).json({ error: errorMessage, code });
}

/**
 * Clean and validate API keys
 */
export function cleanAndValidateKey(key: any): string | null {
  if (!key || typeof key !== 'string') return null;

  const cleaned = key.trim().replace(/[\r\n]/g, '').replace(/^["']+|["']+$/g, '');

  if (
    cleaned === '' ||
    cleaned === 'null' ||
    cleaned === 'undefined' ||
    cleaned === 'none' ||
    cleaned === 'MISSING' ||
    cleaned.includes('YOUR_API_KEY') ||
    cleaned.length < 20
  ) {
    return null;
  }

  return cleaned;
}

// ============================================================================
// RESPONSE UTILITIES
// ============================================================================

/**
 * Send success JSON response
 */
export function sendSuccess<T>(res: ExpressResponse, data: T, status: number = 200): void {
  res.status(status).json(data);
}

/**
 * Parse JSON body safely
 */
export async function parseJsonBody(req: Request): Promise<any> {
  try {
    return await req.body;
  } catch {
    return null;
  }
}