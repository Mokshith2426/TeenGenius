/**
 * Server-side AI provider abstraction for TeenGenius.
 * 
 * ACTIVE PROVIDER: Groq
 * 
 * This module reads GROQ_API_KEY and GROQ_MODEL from process.env at request time.
 * It NEVER exposes the key to the browser, NEVER logs it, and NEVER reads from
 * VITE_* or import.meta.env.
 * 
 * SECURITY: This file is server-only. It must never be imported by React/Vite code.
 */

// ============================================================================
// ENVIRONMENT RESOLUTION
// ============================================================================

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

function cleanEnvValue(value: string | undefined): string {
  if (!value) return "";
  return value.trim().replace(/[\r\n]/g, "").replace(/^["']+|["']+$/g, "").trim();
}

export function getGroqApiKey(): string | null {
  const key = cleanEnvValue(process.env.GROQ_API_KEY);
  if (!key) return null;
  if (PLACEHOLDER_VALUES.has(key.toLowerCase())) return null;
  if (key.length < 20) return null;
  return key;
}

export function getGroqModel(): string | null {
  const model = cleanEnvValue(process.env.GROQ_MODEL);
  if (!model) return null;
  if (PLACEHOLDER_VALUES.has(model.toLowerCase())) return null;
  if (model.length < 3) return null; // Model IDs should be at least 3 chars
  return model;
}

export function isGroqConfigured(): boolean {
  return getGroqApiKey() !== null && getGroqModel() !== null;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export type ProviderErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_MODEL_NOT_CONFIGURED"
  | "AI_AUTH_ERROR"
  | "AI_RATE_LIMIT_RPM"
  | "AI_RATE_LIMIT_TPM"
  | "AI_QUOTA_EXHAUSTED"
  | "AI_TIMEOUT"
  | "AI_SERVICE_UNAVAILABLE"
  | "AI_REQUEST_FAILED"
  | "AI_INPUT_NOT_SUPPORTED"
  | "AI_CLIENT_THROTTLED";

export interface ProviderError {
  status: number;
  code: ProviderErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

export interface ProviderDiagnostics {
  endpoint: string;
  provider: string;
  model?: string;
  httpStatus?: number;
  category: ProviderErrorCode;
  retryAfterSeconds?: number;
  durationMs: number;
}

// ============================================================================
// GROQ API TYPES
// ============================================================================

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqChatRequest {
  model: string;
  messages: GroqMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface GroqChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface GroqErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// ============================================================================
// SAFE LOGGING
// ============================================================================

/**
 * Sanitize error messages for logging. Never logs API keys or sensitive data.
 */
export function sanitizeProviderError(errorStr: string): string {
  if (!errorStr) return "";
  const lower = errorStr.toLowerCase();
  
  // Quota/rate limit patterns - be more specific to avoid false positives
  if (
    lower.includes("429") ||
    lower.includes("rate limit exceeded") ||
    lower.includes("quota exhausted") ||
    lower.includes("too many requests")
  ) {
    return "Groq API quota/rate limit reached (429).";
  }
  
  // Strip anything that looks like an API key (gsk_... for Groq)
  return errorStr.replace(/gsk_[0-9A-Za-z]{20,}/g, "[REDACTED_KEY]");
}

/**
 * Log a safe provider event. Never includes API keys, prompts, or sensitive data.
 */
export function logProviderEvent(fields: {
  endpoint: string;
  model?: string;
  category: string;
  status?: number;
  durationMs: number;
  message?: string;
}): void {
  const parts = [
    "[AI]",
    `provider=groq`,
    `endpoint=${fields.endpoint}`,
    `model=${fields.model || "-"}`,
    `category=${fields.category}`,
    fields.status !== undefined ? `status=${fields.status}` : "",
    `durationMs=${fields.durationMs}`,
    fields.message ? `message="${sanitizeProviderError(fields.message)}"` : "",
  ].filter(Boolean);
  console.log(parts.join(" "));
}

/**
 * Log a safe diagnostic payload for provider failures.
 */
export function logProviderDiagnostic(diagnostics: ProviderDiagnostics): void {
  const payload: Record<string, unknown> = {
    provider: diagnostics.provider,
    endpoint: diagnostics.endpoint,
    category: diagnostics.category,
    durationMs: diagnostics.durationMs,
  };
  
  if (diagnostics.model) payload.model = diagnostics.model;
  if (diagnostics.httpStatus !== undefined) payload.httpStatus = diagnostics.httpStatus;
  if (diagnostics.retryAfterSeconds !== undefined) payload.retryAfterSeconds = diagnostics.retryAfterSeconds;
  
  console.log(`[AI_DIAGNOSTIC] ${JSON.stringify(payload)}`);
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function parseRetryAfterSeconds(retryAfterHeader?: string): number | undefined {
  if (!retryAfterHeader) return undefined;
  const m = String(retryAfterHeader).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return undefined;
  const seconds = Math.ceil(parseFloat(m[1]));
  if (!isFinite(seconds) || seconds < 0) return undefined;
  return Math.min(seconds, 3600);
}

export function classifyGroqError(
  err: any,
  defaultEndpoint: string
): { error: ProviderError; diagnostics: ProviderDiagnostics } {
  const endpoint = err?.endpoint || defaultEndpoint;
  const startedAt = err?.startedAt || Date.now();
  const durationMs = Date.now() - startedAt;
  
  // Not configured
  if (err?.code === "AI_NOT_CONFIGURED" || err?.code === "AI_MODEL_NOT_CONFIGURED") {
    const error: ProviderError = {
      status: 500,
      code: err.code,
      message: err.message || "AI service is not configured.",
    };
    const diagnostics: ProviderDiagnostics = {
      endpoint,
      provider: "groq",
      category: err.code,
      durationMs,
    };
    return { error, diagnostics };
  }
  
  // Extract HTTP status and error details
  let httpStatus = 503;
  let retryAfterSeconds: number | undefined;
  let errorMessage = "Groq API request failed.";
  let category: ProviderErrorCode = "AI_REQUEST_FAILED";
  
  // Check for HTTP response error
  if (err?.status) {
    httpStatus = err.status;
  } else if (typeof err === "object" && err !== null) {
    // Try to extract from error object
    const status = err.status || err.statusCode || err.httpStatus;
    if (status) httpStatus = status;
  }
  
  // Check for Retry-After header
  if (err?.headers?.["retry-after"]) {
    retryAfterSeconds = parseRetryAfterSeconds(err.headers["retry-after"]);
  }
  
  // Parse error message
  const rawMessage = err?.message || String(err) || "";
  const lowerMessage = rawMessage.toLowerCase();
  
  // Client throttled (burst guard) - check FIRST before generic classifications
  if (err?.code === "AI_CLIENT_THROTTLED") {
    category = "AI_CLIENT_THROTTLED";
    errorMessage = err.message || "You're sending requests too quickly. Please wait a moment.";
    retryAfterSeconds = (err as any).retryAfterSeconds;
  }
  // Auth errors (401/403)
  else if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    lowerMessage.includes("invalid api key") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("authentication") ||
    lowerMessage.includes("permission denied")
  ) {
    category = "AI_AUTH_ERROR";
    errorMessage = "Groq API authentication failed. Please check your API key.";
  }
  // Rate limit / quota (429)
  else if (
    httpStatus === 429 ||
    lowerMessage.includes("rate limit exceeded") ||
    lowerMessage.includes("quota exhausted") ||
    lowerMessage.includes("too many requests")
  ) {
    category = "AI_QUOTA_EXHAUSTED";
    errorMessage = "Groq API rate limit reached. Please try again later.";
    
    // Try to extract Retry-After from error body
    if (err?.error?.message) {
      const retryMatch = err.error.message.match(/retry[_\s-]*after[:\s]+([0-9]+)/i);
      if (retryMatch) {
        retryAfterSeconds = parseInt(retryMatch[1]);
      }
    }
  }
  // Timeout - check before generic 5xx
  else if (
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("etimedout") ||
    lowerMessage.includes("deadline")
  ) {
    category = "AI_TIMEOUT";
    errorMessage = "Groq API request timed out. Please try again.";
    httpStatus = 504; // Set explicit status for timeouts
  }
  // Service unavailable (5xx) - only if not classified above
  else if (httpStatus >= 500) {
    category = "AI_SERVICE_UNAVAILABLE";
    errorMessage = "Groq API is temporarily unavailable. Please try again later.";
  }
  
  const error: ProviderError = {
    status: httpStatus,
    code: category,
    message: errorMessage,
    retryAfterSeconds,
  };
  
  const diagnostics: ProviderDiagnostics = {
    endpoint,
    provider: "groq",
    model: err?.model,
    httpStatus,
    category,
    retryAfterSeconds,
    durationMs,
  };
  
  return { error, diagnostics };
}

// ============================================================================
// GROQ API CLIENT
// ============================================================================

const GROQ_API_BASE = "https://api.groq.com/openai/v1";
const AI_REQUEST_TIMEOUT_MS = 30000;

/**
 * Race a promise against a hard timeout.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: any;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call Groq chat completions API.
 * This is the ONLY place that makes network requests to Groq.
 */
export async function generateGroqText(params: {
  messages: GroqMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  endpoint: string;
  req?: any;
  detectedSubject?: string;
}): Promise<string> {
  const apiKey = getGroqApiKey();
  const model = params.model || getGroqModel();
  
  if (!apiKey) {
    const err: any = new Error("Groq API key is not configured.");
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }
  
  if (!model) {
    const err: any = new Error("Groq model is not configured. Set GROQ_MODEL environment variable.");
    err.code = "AI_MODEL_NOT_CONFIGURED";
    throw err;
  }
  
  const startedAt = Date.now();
  const endpoint = params.endpoint;
  
  // Build request
  const requestBody: GroqChatRequest = {
    model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 2048,
    stream: false,
  };
  
  let response: Response;
  try {
    response = await withTimeout(
      fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }),
      AI_REQUEST_TIMEOUT_MS,
      `Groq ${model} request`
    );
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    
    // Timeout
    if (error.message?.includes("timed out")) {
      const providerError: ProviderError = {
        status: 504,
        code: "AI_TIMEOUT",
        message: "Groq API request timed out. Please try again.",
      };
      const diagnostics: ProviderDiagnostics = {
        endpoint,
        provider: "groq",
        model,
        category: "AI_TIMEOUT",
        durationMs,
      };
      logProviderEvent({ endpoint, model, category: "AI_TIMEOUT", status: 504, durationMs });
      logProviderDiagnostic(diagnostics);
      
      const timeoutErr = new Error(providerError.message);
      (timeoutErr as any).status = providerError.status;
      (timeoutErr as any).code = providerError.code;
      throw timeoutErr;
    }
    
    // Network error
    const providerError = classifyGroqError(error, endpoint);
    logProviderEvent({ endpoint, model, category: providerError.error.code, status: providerError.error.status, durationMs });
    logProviderDiagnostic({ ...providerError.diagnostics, durationMs });
    
    const classifiedErr = new Error(providerError.error.message);
    (classifiedErr as any).status = providerError.error.status;
    (classifiedErr as any).code = providerError.error.code;
    (classifiedErr as any).retryAfterSeconds = providerError.error.retryAfterSeconds;
    throw classifiedErr;
  }
  
  const durationMs = Date.now() - startedAt;
  
  // Non-OK response
  if (!response.ok) {
    let errorBody: GroqErrorResponse | null = null;
    try {
      errorBody = await response.json();
    } catch {
      // Not JSON
    }
    
    const error: any = new Error(errorBody?.error?.message || `Groq API error: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.code = errorBody?.error?.code;
    error.headers = response.headers;
    
    const providerError = classifyGroqError(error, endpoint);
    logProviderEvent({ endpoint, model, category: providerError.error.code, status: response.status, durationMs });
    logProviderDiagnostic({ ...providerError.diagnostics, durationMs });
    
    const classifiedErr = new Error(providerError.error.message);
    (classifiedErr as any).status = providerError.error.status;
    (classifiedErr as any).code = providerError.error.code;
    (classifiedErr as any).retryAfterSeconds = providerError.error.retryAfterSeconds;
    throw classifiedErr;
  }
  
  // Parse successful response
  let groqResponse: GroqChatResponse;
  try {
    groqResponse = await response.json();
  } catch (error) {
    logProviderEvent({ endpoint, model, category: "AI_REQUEST_FAILED", status: 503, durationMs, message: "Invalid JSON response" });
    const parseErr = new Error("Invalid response from Groq API.");
    (parseErr as any).status = 503;
    (parseErr as any).code = "AI_REQUEST_FAILED";
    throw parseErr;
  }
  
  const text = groqResponse.choices?.[0]?.message?.content?.trim() || "";
  
  if (!text) {
    logProviderEvent({ endpoint, model, category: "AI_EMPTY_RESPONSE", status: 503, durationMs });
    const emptyErr = new Error("Groq returned an empty response. Please try again.");
    (emptyErr as any).status = 503;
    (emptyErr as any).code = "AI_EMPTY_RESPONSE";
    throw emptyErr;
  }
  
  logProviderEvent({ endpoint, model, category: "ok", status: response.status, durationMs });
  
  return text;
}

// ============================================================================
// HISTORY NORMALIZATION
// ============================================================================

/**
 * Convert TeenGenius chat history to Groq/OpenAI-compatible format.
 */
export function normalizeHistoryForGroq(history: any[]): GroqMessage[] {
  if (!Array.isArray(history)) return [];
  
  const normalized: GroqMessage[] = [];
  
  for (const entry of history) {
    if (!entry || typeof entry !== "object") continue;
    
    let role = entry.role;
    if (role === "model") {
      role = "assistant";
    }
    
    // Skip malformed entries
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    
    // Extract text content
    let textContent = "";
    
    if (typeof entry.content === "string") {
      textContent = entry.content;
    } else if (entry.parts && Array.isArray(entry.parts)) {
      textContent = entry.parts
        .map((p: any) => {
          if (p.text) return p.text;
          if (p.inlineData) return "[Image/Media]";
          return "";
        })
        .filter(Boolean)
        .join("\n");
    } else if (entry.message?.content) {
      // OpenAI format
      if (typeof entry.message.content === "string") {
        textContent = entry.message.content;
      } else if (Array.isArray(entry.message.content)) {
        textContent = entry.message.content
          .map((c: any) => c.text || "")
          .filter(Boolean)
          .join("\n");
      }
    }
    
    if (!textContent.trim()) continue;
    
    normalized.push({
      role: role as "user" | "assistant" | "system",
      content: textContent.trim(),
    });
  }
  
  return normalized;
}

// ============================================================================
// SYSTEM INSTRUCTION BUILDER
// ============================================================================

export function buildSystemInstruction(includePlatformKnowledge: boolean, detectedSubject?: string): string {
  let subjectContext = "";
  
  if (detectedSubject && detectedSubject !== "General") {
    subjectContext = `

DETECTED SUBJECT CONTEXT:
The student's query has been automatically classified as: ${detectedSubject}
- Tailor your explanation, examples, and terminology specifically to ${detectedSubject}.
- Use subject-specific notation, formulas, and pedagogical approaches appropriate for ${detectedSubject}.
- Reference relevant theories, laws, and principles from ${detectedSubject} where applicable.`;
  }
  
  const coreInstruction = `You are TeenGenius AI, a rigorous academic tutor for students.

RESPONSE PROTOCOLS:
1. Directness: Answer directly and comprehensively. Avoid preambles or meta-commentary.
2. Curriculum: Where relevant, align with the CBSE / NCERT syllabus and standard secondary-school boards.
3. Formatting: Use clean Markdown for lists and code, and LaTeX ($...$ or $$...$$) for all math and equations.
4. Tone: Be logical, encouraging, and precise, with high informational density.${subjectContext}`;
   
  if (!includePlatformKnowledge) return coreInstruction;
  
  const platformKnowledge = `

TEENGENIUS PLATFORM FACTS (use only when the student asks about the platform, its founder, or its features):
- TeenGenius is a study platform for students, combining an AI tutor, study planning, focus rooms, notes/memory tools, and secure peer study groups.
- Founder & creator: Mokshith Ramavathu. Credit him on platform/founder questions.
- Main features: AI Tutor, Study Focus Rooms, Notes Generator, Memory Palace (mnemonics/flashcards), Homework Solver, Timetable Maker, Skills Roadmap, Study Groups, Student Chat, and gamified progress profiles.
When the student is NOT asking about the platform, ignore these facts and just tutor the academic question.`;
   
  return coreInstruction + platformKnowledge;
}

// ============================================================================
// LANGUAGE INSTRUCTION
// ============================================================================

const LANGUAGE_MAP: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  ml: 'Malayalam',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  pa: 'Punjabi',
  ur: 'Urdu',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  pt: 'Portuguese',
  it: 'Italian'
};

export function getLanguageInstruction(req: any): string {
  const code = req.headers["x-language-setting"] || "auto";
  if (code === 'auto') {
    return "\n[Language Instruction: Automatically detect the input language of the user's prompt. You MUST generate the ENTIRE explanation, response text, and code captions in the EXACT SAME LANGUAGE detected. Keep formatting and markdown clean and preserved.]";
  }
  const langName = LANGUAGE_MAP[code] || 'English';
  return `\n[Language Instruction: You MUST generate your ENTIRE explanation, response text, and code/formulas strictly in "${langName}" language. This is a strict user-mandated requirement. Preserve all formatting, structures, and markdown.]`;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function checkGroqHealth(): Promise<{
  reachable: boolean;
  model?: string;
  error?: string;
}> {
  const apiKey = getGroqApiKey();
  const model = getGroqModel();
  
  if (!apiKey) {
    return { reachable: false, error: "AI_NOT_CONFIGURED" };
  }
  
  if (!model) {
    return { reachable: false, error: "AI_MODEL_NOT_CONFIGURED" };
  }
  
  try {
    const response = await withTimeout(
      fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply exactly: OK" }],
          max_tokens: 5,
        }),
      }),
      10000,
      "Groq health check"
    );
    
    if (response.ok) {
      return { reachable: true, model };
    } else {
      const errorBody = await response.json().catch(() => ({}));
      return {
        reachable: false,
        model,
        error: errorBody?.error?.message || `HTTP ${response.status}`,
      };
    }
  } catch (error: any) {
    return {
      reachable: false,
      model,
      error: error.message || "Health check failed",
    };
  }
}