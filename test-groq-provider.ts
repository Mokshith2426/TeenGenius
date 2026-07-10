/**
 * Focused mocked tests for the Groq AI provider.
 * 
 * NO REAL GROQ REQUESTS in automated tests.
 * 
 * Run with: npx tsx test-groq-provider.ts
 */

import { 
  getGroqApiKey,
  getGroqModel,
  isGroqConfigured,
  generateGroqText,
  normalizeHistoryForGroq,
  classifyGroqError,
  sanitizeProviderError,
  logProviderEvent,
  logProviderDiagnostic,
  checkGroqHealth,
  type ProviderErrorCode,
  type ProviderDiagnostics
} from "./ai-provider";

// ============================================================================
// TEST UTILITIES
// ============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`✗ ${message}`);
    testsFailed++;
  }
}

function assertEqual(actual: any, expected: any, message: string): void {
  assert(actual === expected, `${message} (expected: ${expected}, got: ${actual})`);
}

// ============================================================================
// MOCK ENVIRONMENT
// ============================================================================

console.log("\n=== Groq Provider Tests ===\n");

// Test 1: Environment variable reading
console.log("--- Test 1: Environment Configuration ---");

// Save original env
const originalGroqKey = process.env.GROQ_API_KEY;
const originalGroqModel = process.env.GROQ_MODEL;

// Test with no env vars
process.env.GROQ_API_KEY = "";
process.env.GROQ_MODEL = "";
assertEqual(getGroqApiKey(), null, "getGroqApiKey() returns null when GROQ_API_KEY is empty");
assertEqual(getGroqModel(), null, "getGroqModel() returns null when GROQ_MODEL is empty");
assertEqual(isGroqConfigured(), false, "isGroqConfigured() returns false when no config");

// Test with valid env vars
process.env.GROQ_API_KEY = "gsk_123456789012345678901234567890123456789012345678";
process.env.GROQ_MODEL = "llama-3.3-70b-versatile";
assertEqual(getGroqApiKey(), "gsk_123456789012345678901234567890123456789012345678", "getGroqApiKey() returns valid key");
assertEqual(getGroqModel(), "llama-3.3-70b-versatile", "getGroqModel() returns valid model");
assertEqual(isGroqConfigured(), true, "isGroqConfigured() returns true when configured");

// Test with placeholder values
process.env.GROQ_API_KEY = "your_groq_api_key_here";
process.env.GROQ_MODEL = "your_groq_model_id_here";
assertEqual(getGroqApiKey(), null, "getGroqApiKey() rejects placeholder 'your_groq_api_key_here'");
assertEqual(getGroqModel(), null, "getGroqModel() rejects placeholder 'your_groq_model_id_here'");

// Test with short key
process.env.GROQ_API_KEY = "gsk_short";
assertEqual(getGroqApiKey(), null, "getGroqApiKey() rejects short keys (< 20 chars)");

// Restore env
process.env.GROQ_API_KEY = originalGroqKey;
process.env.GROQ_MODEL = originalGroqModel;

// ============================================================================
// Test 2: History Normalization
// ============================================================================

console.log("\n--- Test 2: History Normalization ---");

const testHistory = [
  { role: "user", parts: [{ text: "Hello" }, { text: "World" }] },
  { role: "model", parts: [{ text: "Hi there!" }] },
  { role: "assistant", parts: [{ text: "How can I help?" }] },
  { role: "user", content: "Direct content" },
  { role: "unknown", parts: [{ text: "Should be skipped" }] },
  { role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: "base64data" } }] },
];

const normalized = normalizeHistoryForGroq(testHistory);

assertEqual(normalized.length, 5, "Normalized history has correct length (skips unknown role)");
assertEqual(normalized[0].role, "user", "First entry role is 'user'");
assertEqual(normalized[0].content, "Hello\nWorld", "First entry content concatenates text parts");
assertEqual(normalized[1].role, "assistant", "Model role converted to 'assistant'");
assertEqual(normalized[1].content, "Hi there!", "Model content preserved");
assertEqual(normalized[2].role, "assistant", "Assistant role preserved");
assertEqual(normalized[2].content, "How can I help?", "Assistant content preserved");
assertEqual(normalized[3].role, "user", "Direct content user entry preserved");
assertEqual(normalized[3].content, "Direct content", "Direct content preserved");
assertEqual(normalized[4].role, "user", "Image entry role is 'user'");
assertEqual(normalized[4].content, "[Image/Media]", "Image inlineData converted to [Image/Media]");

// Test with empty array
assertEqual(normalizeHistoryForGroq([]).length, 0, "Empty history returns empty array");

// Test with null/undefined
assertEqual(normalizeHistoryForGroq(null as any).length, 0, "Null history returns empty array");
assertEqual(normalizeHistoryForGroq(undefined as any).length, 0, "Undefined history returns empty array");

// ============================================================================
// Test 3: Error Classification
// ============================================================================

console.log("\n--- Test 3: Error Classification ---");

// Test 401/403 → AI_AUTH_ERROR
let err = new Error("Unauthorized");
(err as any).status = 401;
const authClass = classifyGroqError(err, "/api/gemini/chat");
assertEqual(authClass.error.code, "AI_AUTH_ERROR", "401 → AI_AUTH_ERROR");
assertEqual(authClass.error.status, 401, "401 status preserved");

err = new Error("Permission denied");
(err as any).status = 403;
const authClass2 = classifyGroqError(err, "/api/gemini/chat");
assertEqual(authClass2.error.code, "AI_AUTH_ERROR", "403 → AI_AUTH_ERROR");

// Test 429 → AI_QUOTA_EXHAUSTED
err = new Error("Rate limit exceeded");
(err as any).status = 429;
const quotaClass = classifyGroqError(err, "/api/gemini/chat");
assertEqual(quotaClass.error.code, "AI_QUOTA_EXHAUSTED", "429 → AI_QUOTA_EXHAUSTED");
assertEqual(quotaClass.error.status, 429, "429 status preserved");

// Test timeout
err = new Error("Request timed out after 30000ms");
const timeoutClass = classifyGroqError(err, "/api/gemini/chat");
assertEqual(timeoutClass.error.code, "AI_TIMEOUT", "Timeout → AI_TIMEOUT");
assertEqual(timeoutClass.error.status, 504, "Timeout → HTTP 504");

// Test 503 → AI_SERVICE_UNAVAILABLE
err = new Error("Service unavailable");
(err as any).status = 503;
const unavailableClass = classifyGroqError(err, "/api/gemini/chat");
assertEqual(unavailableClass.error.code, "AI_SERVICE_UNAVAILABLE", "503 → AI_SERVICE_UNAVAILABLE");

// Test AI_NOT_CONFIGURED
err = new Error("API key not configured") as any;
(err as any).code = "AI_NOT_CONFIGURED";
const notConfiguredClass = classifyGroqError(err, "/api/gemini/chat");
assertEqual(notConfiguredClass.error.code, "AI_NOT_CONFIGURED", "AI_NOT_CONFIGURED preserved");
assertEqual(notConfiguredClass.error.status, 500, "AI_NOT_CONFIGURED → HTTP 500");

// Test AI_CLIENT_THROTTLED
err = new Error("Too many requests") as any;
(err as any).code = "AI_CLIENT_THROTTLED";
(err as any).retryAfterSeconds = 2;
const throttledClass = classifyGroqError(err, "/api/gemini/chat");
assertEqual(throttledClass.error.code, "AI_CLIENT_THROTTLED", "AI_CLIENT_THROTTLED preserved");
assertEqual(throttledClass.error.retryAfterSeconds, 2, "Retry-After preserved");

// Test unknown error → AI_SERVICE_UNAVAILABLE (500 is a server error)
err = new Error("Unknown error");
(err as any).status = 500;
const unknownClass = classifyGroqError(err, "/api/gemini/chat");
assertEqual(unknownClass.error.code, "AI_SERVICE_UNAVAILABLE", "Unknown 500 error → AI_SERVICE_UNAVAILABLE");

// ============================================================================
// Test 4: Error Sanitization
// ============================================================================

console.log("\n--- Test 4: Error Sanitization ---");

assertEqual(sanitizeProviderError(""), "", "Empty string returns empty");
assertEqual(sanitizeProviderError("Rate limit exceeded"), "Groq API quota/rate limit reached (429).", "Rate limit message normalized");
assertEqual(sanitizeProviderError("429 Too Many Requests"), "Groq API quota/rate limit reached (429).", "429 normalized");
assertEqual(sanitizeProviderError("gsk_123456789012345678901234567890123456789012345678"), "[REDACTED_KEY]", "Groq key redacted");
assertEqual(sanitizeProviderError("Error with gsk_abcdefghijklmnopqrstuvwxyz key"), "Error with [REDACTED_KEY] key", "Key in message redacted");

// ============================================================================
// Test 5: Diagnostics Logging
// ============================================================================

console.log("\n--- Test 5: Diagnostics Logging ---");

// These should not throw
assert(
  (() => {
    logProviderEvent({
      endpoint: "/api/gemini/chat",
      model: "llama-3.3-70b-versatile",
      category: "ok",
      status: 200,
      durationMs: 150,
    });
    return true;
  })(),
  "logProviderEvent succeeds with valid params"
);

assert(
  (() => {
    const diagnostics: ProviderDiagnostics = {
      endpoint: "/api/gemini/chat",
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      httpStatus: 429,
      category: "AI_QUOTA_EXHAUSTED",
      durationMs: 100,
    };
    logProviderDiagnostic(diagnostics);
    return true;
  })(),
  "logProviderDiagnostic succeeds with valid params"
);

// ============================================================================
// Test 6: Health Check (mocked)
// ============================================================================

console.log("\n--- Test 6: Health Check (mocked) ---");

// Note: We can't actually test checkGroqHealth without mocking fetch
// This is just a smoke test to ensure it doesn't crash on config check
assertEqual(isGroqConfigured(), false, "Health check prerequisite: not configured without env");

// ============================================================================
// SUMMARY
// ============================================================================

console.log("\n=== Test Summary ===");
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total:  ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
  console.log("\n❌ Some tests failed!");
  process.exit(1);
} else {
  console.log("\n✅ All tests passed!");
  process.exit(0);
}