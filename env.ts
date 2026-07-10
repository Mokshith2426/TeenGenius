import "dotenv/config";

/**
 * Server-only Gemini environment resolver.
 *
 * NEVER import this module into React / Vite client code — it reads server-side
 * secrets (the Gemini API key). It is imported exclusively by app.ts / server.ts.
 *
 * Environment loading order: `import "dotenv/config"` runs at the very top, so the
 * root .env is loaded before anything reads process.env. Configuration is resolved
 * at CALL TIME (not as a stale module-level boolean) so serverless/Netlify runtimes
 * that inject env after import are handled correctly.
 */

const PLACEHOLDER_VALUES = new Set([
  "your_gemini_api_key_here",
  "your_real_gemini_key",
  "your_api_key",
  "missing",
  "none",
  "null",
  "undefined",
]);

function clean(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/[\r\n]/g, "").replace(/^["']+|["']+$/g, "").trim();
}

/**
 * Resolves the server-side Gemini key at call time, or returns null.
 * Prefers GEMINI_API_KEY, falls back to GOOGLE_API_KEY. Rejects placeholders.
 * Never exposed to the browser.
 */
export function getGeminiApiKey(): string | null {
  const key = clean(process.env.GEMINI_API_KEY) || clean(process.env.GOOGLE_API_KEY);
  if (!key) return null;
  if (PLACEHOLDER_VALUES.has(key.toLowerCase())) return null;
  if (key.length < 20) return null;
  return key;
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey() !== null;
}

// Deterministic single production model. Every AI endpoint uses PRIMARY_MODEL.
//
// FALLBACK_MODEL is NOT a quota-relief / model-rotation strategy. A 429,
// RESOURCE_EXHAUSTED, RPM/TPM/RPD, or spend-limit failure MUST NOT trigger a
// second Gemini request against a different model — doing so only multiplies
// requests against the shared free-tier project quota. FALLBACK_MODEL is used
// ONLY when the primary model itself is confirmed unavailable (model not found
// / unsupported for the API version / deprecated), which is a deploy-time
// configuration problem, not a runtime quota condition.
//
// Real, currently-supported Gemini Flash model IDs for @google/genai.
export const PRIMARY_MODEL = "gemini-2.5-flash";
export const FALLBACK_MODEL = "gemini-2.0-flash";

/**
 * Emits ONE sanitized startup status line. Never prints the key, its prefix,
 * suffix, or length.
 */
export function logAiStartupStatus(): void {
  if (isGeminiConfigured()) {
    console.log("[AI] Gemini server configuration detected.");
  } else {
    console.log("[AI] GEMINI_API_KEY is not configured. AI endpoints are disabled.");
  }
}
