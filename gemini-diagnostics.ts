/**
 * Pure, dependency-free Gemini error diagnostics + classification.
 *
 * This module contains NO network calls and NO secrets. It only inspects an
 * already-thrown error object (from @google/genai or the fetch/runtime layer)
 * and derives:
 *   - a safe, structured diagnostic (for SERVER-ONLY logging), and
 *   - a machine-readable category + student-safe public message.
 *
 * It is intentionally isolated from app.ts so the classification logic can be
 * unit-tested without spinning up Express, Multer, or the Gemini SDK, and
 * without making a single real API request.
 *
 * SECURITY: This module never reads process.env, never touches the API key,
 * and only ever surfaces a whitelisted set of Google quota fields. It must
 * never be given (and never emits) API keys, Authorization headers, request
 * bodies, user messages, base64 media, or Firebase tokens.
 */

// Internal, fine-grained categories. The PUBLIC message stays deliberately
// vague; only the `code` + server logs carry the specific category.
export type GeminiErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_RATE_LIMIT_RPM"
  | "AI_RATE_LIMIT_TPM"
  | "AI_RATE_LIMIT_RPD"
  | "AI_SPEND_LIMIT"
  | "AI_QUOTA_EXHAUSTED"
  | "AI_AUTH_ERROR"
  | "AI_MODEL_ERROR"
  | "AI_TIMEOUT"
  | "AI_SERVICE_UNAVAILABLE"
  | "AI_REQUEST_FAILED"
  | "AI_EMPTY_RESPONSE";

export interface GeminiDiagnostics {
  httpStatus?: number;
  googleStatus?: string; // e.g. "RESOURCE_EXHAUSTED"
  reason?: string; // ErrorInfo.reason, e.g. "RATE_LIMIT_EXCEEDED"
  quotaMetric?: string;
  quotaId?: string;
  quotaValue?: string; // the configured limit value, when Google returns it
  retryDelay?: string; // e.g. "52s"
  quotaType?: "RPM" | "TPM" | "RPD" | "SPEND";
}

export interface GeminiClassification {
  status: number; // HTTP status to return to the client
  code: GeminiErrorCode; // machine-readable category (goes in the JSON body + logs)
  message: string; // student-facing, safe, vague
  /**
   * A quota/rate-limit/spend failure MUST NOT trigger a second Gemini model
   * request. Only a confirmed model-availability problem is fallback eligible.
   */
  fallbackEligible: boolean;
  retryAfterSeconds?: number; // parsed from retryDelay, for the Retry-After header
  diagnostics: GeminiDiagnostics;
}

// Student-facing messages never mention quotas, API keys, project IDs, or
// server configuration. The specific reason lives only in `code` + server logs.
const USAGE_LIMIT_MESSAGE =
  "TeenGenius AI has reached its current usage limit. Please try again later.";
const TEMP_UNAVAILABLE_MESSAGE =
  "TeenGenius AI is temporarily unavailable. Please try again later.";
const TIMEOUT_MESSAGE = "TeenGenius AI took too long to respond. Please try again.";
const RETRY_SHORTLY_MESSAGE = "TeenGenius AI is temporarily unavailable. Please try again.";

export function publicMessageFor(code: GeminiErrorCode): string {
  switch (code) {
    case "AI_RATE_LIMIT_RPM":
    case "AI_RATE_LIMIT_TPM":
    case "AI_RATE_LIMIT_RPD":
    case "AI_SPEND_LIMIT":
    case "AI_QUOTA_EXHAUSTED":
      return USAGE_LIMIT_MESSAGE;
    case "AI_TIMEOUT":
      return TIMEOUT_MESSAGE;
    case "AI_SERVICE_UNAVAILABLE":
      return RETRY_SHORTLY_MESSAGE;
    case "AI_NOT_CONFIGURED":
    case "AI_AUTH_ERROR":
    case "AI_MODEL_ERROR":
    case "AI_REQUEST_FAILED":
    default:
      return TEMP_UNAVAILABLE_MESSAGE;
  }
}

function toRawString(err: any): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  // @google/genai ApiError carries the useful payload in .message (often a JSON
  // string). Fall back to a JSON stringify of the object as a last resort.
  const parts: string[] = [];
  if (err.message) parts.push(String(err.message));
  if (err.status !== undefined && typeof err.status !== "number") parts.push(String(err.status));
  if (err.statusText) parts.push(String(err.statusText));
  if (parts.length === 0) {
    try {
      parts.push(JSON.stringify(err));
    } catch {
      parts.push(String(err));
    }
  }
  return parts.join(" ");
}

// Best-effort extraction of the embedded Google error JSON object. The SDK
// sometimes gives a clean object and sometimes a stringified `{ "error": {...} }`.
function extractErrorJson(err: any, raw: string): any | null {
  // 1) Structured object already present on the error.
  if (err && typeof err === "object") {
    if (err.error && typeof err.error === "object") return err.error;
    // Only treat the error object itself as the Google payload when it actually
    // carries the detail fields — a bare numeric HTTP `status` does NOT count
    // (the real payload usually lives in the JSON-string `message`, parsed below).
    if (Array.isArray(err.details) || typeof err.status === "string") return err;
  }
  // 2) Parse a JSON blob embedded in the message string.
  if (raw) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const candidate = raw.slice(start, end + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object") {
          return parsed.error && typeof parsed.error === "object" ? parsed.error : parsed;
        }
      } catch {
        // Not valid JSON — fall through to pure string heuristics.
      }
    }
  }
  return null;
}

function firstNumber(raw: string, candidates: number[]): number | undefined {
  for (const n of candidates) {
    if (new RegExp(`\\b${n}\\b`).test(raw)) return n;
  }
  return undefined;
}

/**
 * Parse a raw Gemini/network error into a SAFE structured diagnostic. Only a
 * whitelisted set of fields is ever surfaced — never project IDs, consumer
 * identifiers, credentials, or raw request payloads.
 */
export function parseGeminiDiagnostics(err: any): GeminiDiagnostics {
  const raw = toRawString(err);
  const lower = raw.toLowerCase();
  const diag: GeminiDiagnostics = {};

  // HTTP status: prefer a numeric `status` on the error, else scan the text.
  if (err && typeof err.status === "number") {
    diag.httpStatus = err.status;
  }
  const errObj = extractErrorJson(err, raw);
  if (errObj) {
    if (diag.httpStatus === undefined && typeof errObj.code === "number") diag.httpStatus = errObj.code;
    if (typeof errObj.status === "string") diag.googleStatus = errObj.status;

    const details = Array.isArray(errObj.details) ? errObj.details : [];
    for (const d of details) {
      if (!d || typeof d !== "object") continue;
      const type = String(d["@type"] || "");
      if (type.includes("QuotaFailure")) {
        const violation = Array.isArray(d.violations) ? d.violations[0] : undefined;
        if (violation && typeof violation === "object") {
          if (violation.quotaMetric) diag.quotaMetric = String(violation.quotaMetric);
          if (violation.quotaId) diag.quotaId = String(violation.quotaId);
          if (violation.quotaValue) diag.quotaValue = String(violation.quotaValue);
        }
      } else if (type.includes("RetryInfo")) {
        if (d.retryDelay) diag.retryDelay = String(d.retryDelay);
      } else if (type.includes("ErrorInfo")) {
        if (d.reason) diag.reason = String(d.reason);
        // NOTE: d.metadata may contain a `consumer: projects/NNN` project id.
        // We deliberately do NOT copy metadata to avoid leaking project IDs.
      }
    }
  }
  if (diag.httpStatus === undefined) {
    diag.httpStatus = firstNumber(raw, [429, 401, 403, 404, 500, 502, 503, 504]);
  }
  if (!diag.retryDelay) {
    // Fallback: "retryDelay":"52s" or Retry-After style hints in the raw text.
    const m = raw.match(/retry[\s_-]*(?:delay|after)["'\s:]*([0-9]+(?:\.[0-9]+)?s?)/i);
    if (m) diag.retryDelay = m[1].endsWith("s") ? m[1] : `${m[1]}s`;
  }

  // Classify the quota TYPE from the strongest available signals. A single 429
  // is normally exactly one of these. Precedence: spend > RPD > TPM > RPM.
  const hay = `${lower} ${(diag.quotaId || "").toLowerCase()} ${(diag.quotaMetric || "").toLowerCase()} ${(diag.reason || "").toLowerCase()}`;
  const mentionsTokens = /token/.test(hay);
  const perDay = /per[\s_-]*day|perday|requestsperday|per_day/.test(hay);
  const perMinute = /per[\s_-]*minute|perminute|permin|per_minute/.test(hay);
  const spend = /billing|spend|budget|cost[\s_-]*limit|payment/.test(hay);

  if (spend) diag.quotaType = "SPEND";
  else if (perDay) diag.quotaType = "RPD";
  else if (perMinute && mentionsTokens) diag.quotaType = "TPM";
  else if (perMinute) diag.quotaType = "RPM";
  else if (mentionsTokens && /token.*per|per.*token|tpm/.test(hay)) diag.quotaType = "TPM";

  return diag;
}

function parseRetryAfterSeconds(retryDelay?: string): number | undefined {
  if (!retryDelay) return undefined;
  const m = String(retryDelay).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return undefined;
  const seconds = Math.ceil(parseFloat(m[1]));
  if (!isFinite(seconds) || seconds < 0) return undefined;
  // Clamp to a sane ceiling so a bogus value can't produce an absurd header.
  return Math.min(seconds, 3600);
}

/**
 * Map a raw SDK/network error to a sanitized { status, code, message } plus a
 * `fallbackEligible` flag. ONLY a confirmed model-availability error is
 * fallback eligible — quota / rate-limit / spend / timeout never are.
 */
export function categorizeGeminiError(err: any): GeminiClassification {
  if (err?.code === "AI_NOT_CONFIGURED") {
    return {
      status: 500,
      code: "AI_NOT_CONFIGURED",
      message: publicMessageFor("AI_NOT_CONFIGURED"),
      fallbackEligible: false,
      diagnostics: {},
    };
  }

  const diagnostics = parseGeminiDiagnostics(err);
  const raw = toRawString(err).toLowerCase();
  const googleStatus = (diagnostics.googleStatus || "").toUpperCase();
  const http = diagnostics.httpStatus;

  const build = (
    status: number,
    code: GeminiErrorCode,
    fallbackEligible = false
  ): GeminiClassification => ({
    status,
    code,
    message: publicMessageFor(code),
    fallbackEligible,
    retryAfterSeconds: parseRetryAfterSeconds(diagnostics.retryDelay),
    diagnostics,
  });

  // 1) Auth / permission (checked before rate-limit; a 403 here is not a quota).
  if (
    googleStatus === "UNAUTHENTICATED" ||
    googleStatus === "PERMISSION_DENIED" ||
    http === 401 ||
    http === 403 ||
    raw.includes("api key not valid") ||
    raw.includes("api_key_invalid") ||
    raw.includes("api key expired") ||
    raw.includes("api_key_expired") ||
    raw.includes("permission_denied") ||
    raw.includes("permission denied") ||
    raw.includes("service_disabled") ||
    raw.includes("has not been used in project") ||
    raw.includes("unauthenticated")
  ) {
    return build(502, "AI_AUTH_ERROR");
  }

  // 2) Rate limit / quota / spend. NONE of these are fallback eligible.
  if (
    http === 429 ||
    googleStatus === "RESOURCE_EXHAUSTED" ||
    raw.includes("429") ||
    raw.includes("resource_exhausted") ||
    raw.includes("quota") ||
    raw.includes("exhausted") ||
    raw.includes("rate limit") ||
    raw.includes("rate-limit") ||
    raw.includes("ratelimit") ||
    raw.includes("rpm") ||
    raw.includes("tpm") ||
    raw.includes("rpd") ||
    !!diagnostics.quotaType
  ) {
    switch (diagnostics.quotaType) {
      case "SPEND":
        return build(429, "AI_SPEND_LIMIT");
      case "RPD":
        return build(429, "AI_RATE_LIMIT_RPD");
      case "TPM":
        return build(429, "AI_RATE_LIMIT_TPM");
      case "RPM":
        return build(429, "AI_RATE_LIMIT_RPM");
      default:
        return build(429, "AI_QUOTA_EXHAUSTED");
    }
  }

  // 3) Timeout (never fallback — a second request would just amplify load).
  if (
    raw.includes("timed out") ||
    raw.includes("timeout") ||
    raw.includes("etimedout") ||
    raw.includes("deadline")
  ) {
    return build(504, "AI_TIMEOUT");
  }

  // 4) Confirmed model-availability problem — the ONLY fallback-eligible case.
  if (
    googleStatus === "NOT_FOUND" ||
    (raw.includes("model") &&
      (raw.includes("not found") ||
        raw.includes("not supported") ||
        raw.includes("is not found for api version") ||
        raw.includes("does not exist") ||
        raw.includes("deprecated"))) ||
    raw.includes("unsupported model") ||
    raw.includes("invalid model") ||
    (http === 404 && raw.includes("model"))
  ) {
    return build(502, "AI_MODEL_ERROR", /* fallbackEligible */ true);
  }

  // 5) Temporary upstream failure.
  if (
    http === 503 ||
    googleStatus === "UNAVAILABLE" ||
    raw.includes("503") ||
    raw.includes("unavailable") ||
    raw.includes("overloaded") ||
    raw.includes("high demand")
  ) {
    return build(503, "AI_SERVICE_UNAVAILABLE");
  }

  return build(503, "AI_REQUEST_FAILED");
}

/**
 * Build the compact, SAFE `[AI_DIAGNOSTIC]` payload for server logs. Only
 * whitelisted fields, only when actually present. No invented values.
 */
export function buildDiagnosticLogPayload(fields: {
  endpoint: string;
  model?: string;
  durationMs: number;
  classification: GeminiClassification;
}): Record<string, unknown> {
  const { endpoint, model, durationMs, classification } = fields;
  const d = classification.diagnostics;
  const payload: Record<string, unknown> = {
    endpoint,
    category: classification.code,
    durationMs,
  };
  if (model) payload.model = model;
  if (d.httpStatus !== undefined) payload.httpStatus = d.httpStatus;
  if (d.googleStatus) payload.googleStatus = d.googleStatus;
  if (d.reason) payload.reason = d.reason;
  if (d.quotaMetric) payload.quotaMetric = d.quotaMetric;
  if (d.quotaId) payload.quotaId = d.quotaId;
  if (d.quotaValue) payload.quotaValue = d.quotaValue;
  if (d.quotaType) payload.quotaType = d.quotaType;
  if (d.retryDelay) payload.retryDelay = d.retryDelay;
  if (classification.retryAfterSeconds !== undefined) payload.retryAfterSeconds = classification.retryAfterSeconds;
  return payload;
}
