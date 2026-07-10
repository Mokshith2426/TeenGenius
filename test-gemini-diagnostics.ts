/**
 * Focused unit tests for the PURE Gemini error classification/diagnostics logic.
 * Runs with:  npx tsx test-gemini-diagnostics.ts
 *
 * Makes ZERO real Gemini API requests — it only feeds representative error
 * objects (shaped like @google/genai ApiError / network errors) into the pure
 * functions and asserts the derived category, HTTP status, fallback eligibility,
 * quota type, and Retry-After parsing.
 */
import {
  categorizeGeminiError,
  parseGeminiDiagnostics,
  buildDiagnosticLogPayload,
} from "./gemini-diagnostics";

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ok  - ${name}`);
  } else {
    failed++;
    console.error(`FAIL  - ${name}${detail !== undefined ? ` :: ${JSON.stringify(detail)}` : ""}`);
  }
}

// Helper: build an @google/genai-style ApiError.
function apiError(status: number, errorBody: Record<string, unknown>) {
  return { status, message: JSON.stringify({ error: { code: status, ...errorBody } }) };
}

// --- Free-tier RPD (requests per day) 429 ---
{
  const err = apiError(429, {
    message: "You exceeded your current quota. Resource has been exhausted (e.g. check quota).",
    status: "RESOURCE_EXHAUSTED",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [
          {
            quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
            quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
          },
        ],
      },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "38s" },
      {
        "@type": "type.googleapis.com/google.rpc.ErrorInfo",
        reason: "RATE_LIMIT_EXCEEDED",
        metadata: { consumer: "projects/123456789", quota_location: "global" },
      },
    ],
  });
  const c = categorizeGeminiError(err);
  assert(c.code === "AI_RATE_LIMIT_RPD", "RPD → AI_RATE_LIMIT_RPD", c.code);
  assert(c.status === 429, "RPD → HTTP 429", c.status);
  assert(c.fallbackEligible === false, "RPD → NO fallback", c.fallbackEligible);
  assert(c.retryAfterSeconds === 38, "RPD → Retry-After 38s parsed", c.retryAfterSeconds);
  assert(c.diagnostics.quotaType === "RPD", "RPD → quotaType RPD", c.diagnostics.quotaType);
  assert(
    c.diagnostics.quotaId === "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
    "RPD → quotaId extracted",
    c.diagnostics.quotaId
  );
  const log = buildDiagnosticLogPayload({ endpoint: "/api/gemini/chat", model: "gemini-2.5-flash", durationMs: 12, classification: c });
  assert(!JSON.stringify(log).includes("123456789"), "diagnostic log NEVER contains project id", log);
  assert(log.quotaMetric === "generativelanguage.googleapis.com/generate_content_free_tier_requests", "log includes quotaMetric", log);
}

// --- RPM (requests per minute) 429 ---
{
  const err = apiError(429, {
    message: "Quota exceeded for quota metric requests per minute.",
    status: "RESOURCE_EXHAUSTED",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [{ quotaId: "GenerateRequestsPerMinutePerProjectPerModel-FreeTier" }],
      },
    ],
  });
  const c = categorizeGeminiError(err);
  assert(c.code === "AI_RATE_LIMIT_RPM", "RPM → AI_RATE_LIMIT_RPM", c.code);
  assert(c.fallbackEligible === false, "RPM → NO fallback", c.fallbackEligible);
}

// --- TPM (tokens per minute) 429 ---
{
  const err = apiError(429, {
    message: "Quota exceeded for input tokens per minute.",
    status: "RESOURCE_EXHAUSTED",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [{ quotaId: "GenerateContentInputTokensPerModelPerMinute-FreeTier", quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_input_token_count" }],
      },
    ],
  });
  const c = categorizeGeminiError(err);
  assert(c.code === "AI_RATE_LIMIT_TPM", "TPM → AI_RATE_LIMIT_TPM", c.code);
  assert(c.diagnostics.quotaType === "TPM", "TPM → quotaType TPM", c.diagnostics.quotaType);
}

// --- Spend / billing limit ---
{
  const err = apiError(429, {
    message: "The billing account for the owning project has a spend limit that has been reached.",
    status: "RESOURCE_EXHAUSTED",
  });
  const c = categorizeGeminiError(err);
  assert(c.code === "AI_SPEND_LIMIT", "spend → AI_SPEND_LIMIT", c.code);
  assert(c.fallbackEligible === false, "spend → NO fallback", c.fallbackEligible);
}

// --- Generic 429 with no quota detail ---
{
  const err = apiError(429, { message: "Resource has been exhausted (e.g. check quota).", status: "RESOURCE_EXHAUSTED" });
  const c = categorizeGeminiError(err);
  assert(c.code === "AI_QUOTA_EXHAUSTED", "generic 429 → AI_QUOTA_EXHAUSTED", c.code);
  assert(c.fallbackEligible === false, "generic 429 → NO fallback", c.fallbackEligible);
}

// --- Auth / permission (403) ---
{
  const err = apiError(403, { message: "Permission denied. API key not valid. Please pass a valid API key.", status: "PERMISSION_DENIED" });
  const c = categorizeGeminiError(err);
  assert(c.code === "AI_AUTH_ERROR", "403 → AI_AUTH_ERROR", c.code);
  assert(c.status === 502, "auth → HTTP 502", c.status);
  assert(c.fallbackEligible === false, "auth → NO fallback", c.fallbackEligible);
}

// --- Model availability (the ONLY fallback-eligible case) ---
{
  const err = apiError(404, {
    message: "models/gemini-2.5-flash is not found for API version v1beta, or is not supported.",
    status: "NOT_FOUND",
  });
  const c = categorizeGeminiError(err);
  assert(c.code === "AI_MODEL_ERROR", "model-not-found → AI_MODEL_ERROR", c.code);
  assert(c.fallbackEligible === true, "model-not-found → fallback ELIGIBLE", c.fallbackEligible);
}

// --- Timeout (never fallback) ---
{
  const err = new Error("Gemini gemini-2.5-flash request timed out after 30000ms");
  const c = categorizeGeminiError(err);
  assert(c.code === "AI_TIMEOUT", "timeout → AI_TIMEOUT", c.code);
  assert(c.status === 504, "timeout → HTTP 504", c.status);
  assert(c.fallbackEligible === false, "timeout → NO fallback", c.fallbackEligible);
}

// --- 503 service unavailable ---
{
  const err = apiError(503, { message: "The model is overloaded. Please try again later.", status: "UNAVAILABLE" });
  const c = categorizeGeminiError(err);
  assert(c.code === "AI_SERVICE_UNAVAILABLE", "503 → AI_SERVICE_UNAVAILABLE", c.code);
  assert(c.fallbackEligible === false, "503 → NO fallback", c.fallbackEligible);
}

// --- Unknown / generic failure ---
{
  const c = categorizeGeminiError(new Error("socket hang up"));
  assert(c.code === "AI_REQUEST_FAILED", "unknown → AI_REQUEST_FAILED", c.code);
  assert(c.fallbackEligible === false, "unknown → NO fallback", c.fallbackEligible);
}

// --- parseGeminiDiagnostics on a plain string (no JSON) still finds status ---
{
  const d = parseGeminiDiagnostics("got 429 Too Many Requests: quota exceeded, retryDelay: 5s");
  assert(d.httpStatus === 429, "string parse → httpStatus 429", d.httpStatus);
  assert(d.retryDelay === "5s", "string parse → retryDelay 5s", d.retryDelay);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
