import "dotenv/config";

/**
 * Server-only Groq environment resolver.
 *
 * NEVER import this module into React / Vite client code — it reads server-side
 * secrets (the Groq API key). It is imported exclusively by app.ts / server.ts.
 *
 * Environment loading order: `import "dotenv/config"` runs at the very top, so the
 * root .env is loaded before anything reads process.env. Configuration is resolved
 * at CALL TIME (not as a stale module-level boolean) so serverless/Netlify runtimes
 * that inject env after import are handled correctly.
 */

const PLACEHOLDER_VALUES = new Set([
  "your_groq_api_key_here",
  "your_real_groq_key",
  "your_api_key",
  "your_groq_model_id_here",
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
 * Resolves the server-side Groq key at call time, or returns null.
 * Rejects placeholders.
 * Never exposed to the browser.
 */
export function getGroqApiKey(): string | null {
  const key = clean(process.env.GROQ_API_KEY);
  if (!key) return null;
  if (PLACEHOLDER_VALUES.has(key.toLowerCase())) return null;
  if (key.length < 20) return null;
  return key;
}

export function getGroqModel(): string | null {
  const model = clean(process.env.GROQ_MODEL);
  if (!model) return null;
  if (PLACEHOLDER_VALUES.has(model.toLowerCase())) return null;
  if (model.length < 3) return null; // Model IDs should be at least 3 chars
  return model;
}

export function isGroqConfigured(): boolean {
  return getGroqApiKey() !== null && getGroqModel() !== null;
}

/**
 * Emits ONE sanitized startup status line. Never prints the key, its prefix,
 * suffix, or length.
 */
export function logAiStartupStatus(): void {
  if (isGroqConfigured()) {
    console.log("[AI] Groq server configuration detected.");
  } else {
    console.log("[AI] GROQ_API_KEY or GROQ_MODEL is not configured. AI endpoints are disabled.");
  }
}