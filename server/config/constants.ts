/**
 * Server Configuration Constants
 * 
 * Centralized configuration for the backend server.
 */

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const;

// ============================================================================
// AI CONFIGURATION
// ============================================================================

export const AI_CONFIG = {
  REQUEST_TIMEOUT_MS: 30000,
  MAX_OUTPUT_TOKENS: 4096,
  DEFAULT_TEMPERATURE: 0.7,
  BURST_WINDOW_MS: 1500,
  MAX_PAYLOAD_SIZE: 50000, // 50KB
} as const;

// ============================================================================
// URL FETCH CONFIGURATION (SSRF-hardened outbound fetching for Create Notes)
// ============================================================================

export const URL_FETCH_CONFIG = {
  // Only public web pages are ever fetched. Internal/private destinations are
  // rejected before a socket is opened (see server/utils/url-guard.ts).
  MAX_REDIRECTS: 3,
  REQUEST_TIMEOUT_MS: 12000,
  // Hard ceiling on a single response body. Prevents a hostile page from
  // exhausting server memory.
  MAX_RESPONSE_BYTES: 3 * 1024 * 1024, // 3MB
  // Extracted article/transcript text is truncated before it reaches the model.
  MAX_EXTRACTED_CHARS: 14000,
  // Minimum plausible body size; anything smaller is a blocked/empty page.
  MIN_EXTRACTED_CHARS: 220,
  // Client-facing cooldown for the extraction endpoint (anti-abuse).
  EXTRACT_BURST_WINDOW_MS: 5000,
  ALLOWED_CONTENT_TYPES: [
    'text/html',
    'application/xhtml+xml',
    'text/plain',
    'application/json',
    'application/xml',
    'text/xml',
  ],
  USER_AGENT:
    'Mozilla/5.0 (compatible; TeenGeniusBot/1.0; +https://teengenius.netlify.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
} as const;

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  UPLOADS_DIR: 'uploads',
} as const;

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

export const CORS_CONFIG = {
  development: ['*'] as string[],
  production: [
    'https://teengenius.netlify.app',
    'https://teengenius.com',
    'capacitor://localhost',
    'ionic://localhost'
  ] as string[],
};

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  AI_NOT_CONFIGURED: 'AI service is not configured.',
  PAYLOAD_TOO_LARGE: 'Request payload too large',
  INVALID_INPUT: 'Invalid input provided',
  FILE_TOO_LARGE: 'File too large. Please select a file under 10MB.',
  NO_FILE_UPLOADED: 'No file uploaded',
  URL_INVALID: "That doesn't look like a valid web link. Paste a full link starting with https://",
  URL_BLOCKED: 'That link points to a private or restricted address, so TeenGenius cannot open it.',
  URL_UNREACHABLE: 'TeenGenius could not open that page. It may be offline, blocking automated access, or behind a login.',
  URL_TOO_LARGE: 'That page is too large to summarise. Try a shorter article or paste the text directly.',
  URL_UNSUPPORTED: 'That page did not contain readable article text. Try pasting the study text directly.',
  YOUTUBE_NO_TRANSCRIPT:
    "We could not retrieve a transcript for that video. It may be private, age-restricted, or have captions turned off — paste the transcript or your own summary in the Text tab instead.",
} as const;