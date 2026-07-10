import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import compression from "compression";
import {
  isGeminiConfigured,
  getGeminiApiKey,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
} from "./env";
import {
  categorizeGeminiError,
  buildDiagnosticLogPayload,
  publicMessageFor,
  type GeminiErrorCode,
  type GeminiDiagnostics,
} from "./gemini-diagnostics";

// NOTE: Environment variables are loaded by server.ts (`import "dotenv/config"`)
// BEFORE this module is dynamically imported, and by the hosting platform in
// serverless deployments (Netlify). This module never calls dotenv itself, so
// there is exactly one deterministic env-loading mechanism and no duplicate logs.

// Helper to clean and validate Gemini API Keys (stripping quotes, etc.)
export function cleanAndValidateKey(key: any): string | null {
  if (!key || typeof key !== "string") return null;
  const cleaned = key.trim().replace(/[\r\n]/g, "").replace(/^["']+|["']+$/g, "");

  if (
    cleaned === "" ||
    cleaned === "null" ||
    cleaned === "undefined" ||
    cleaned === "none" ||
    cleaned === "MISSING" ||
    cleaned.includes("YOUR_API_KEY") ||
    cleaned.length < 20
  ) {
    return null;
  }
  return cleaned;
}

const app = express();
app.use(compression());

// Enable robust Cross-Origin-Resource-Sharing (CORS) for Android/Capacitor requests
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, x-language-setting, X-Language-Setting");
  res.setHeader("Access-Control-Max-Age", "86400");
  
  // Intercept and handle OPTIONS preflight requests
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// Ensure uploads directory exists (safeguarded for serverless)
const uploadsDir = path.join(process.cwd(), "uploads");
const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT);

if (!isServerless && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer Config
const storage = isServerless 
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, "uploads/");
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
      },
    });

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// --- DETERMINISTIC GEMINI PRODUCTION CONFIGURATION ---
// PRIMARY_MODEL / FALLBACK_MODEL / getGeminiApiKey / isGeminiConfigured come from ./env (server-only).
const AI_REQUEST_TIMEOUT_MS = 30000;

// Server-side ONLY key resolution (call-time). The Gemini key is never read from
// the browser: no x-gemini-key header, no VITE_* variable, no localStorage.
function resolveGeminiKey(): string | null {
  return getGeminiApiKey();
}

// Note: Server-side in-flight deduplication was removed (commit 8082d70 audit).
// Frontend duplicate-submit protection (isLoading guard + requestBurstGuard middleware)
// already prevents duplicate requests. Server-side deduplication created a critical
// concurrency bug where different anonymous users shared the same Promise and
// Express response object, causing requests to hang or return wrong responses.

// One lazy server-side Gemini client. Cached and reused; rebuilt only if the
// resolved key changes (e.g. env updated between requests).
let geminiClient: GoogleGenAI | null = null;
let geminiClientKey: string | null = null;

// Single server-side Gemini client factory used by every AI endpoint.
function getGoogleGenAI(req?: any): GoogleGenAI {
  const key = getGeminiApiKey();
  if (!key) {
    const err: any = new Error("AI service is not configured.");
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }
  if (!geminiClient || geminiClientKey !== key) {
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
    geminiClientKey = key;
  }
  // The per-request object is read synchronously by generateContentWithRetry
  // (for the language header) immediately after this call, before any await.
  if (req) (geminiClient as any).req = req;
  return geminiClient;
}

// Standardized Gemini error carrying an HTTP status + machine-readable code.
// It also carries the parsed diagnostics + optional Retry-After hint so the
// route layer can emit a Retry-After header without re-parsing the raw error.
// Classification itself lives in ./gemini-diagnostics (pure + unit-testable).
class GeminiError extends Error {
  status: number;
  code: GeminiErrorCode;
  retryAfterSeconds?: number;
  diagnostics?: GeminiDiagnostics;
  constructor(
    message: string,
    status: number,
    code: GeminiErrorCode,
    extra?: { retryAfterSeconds?: number; diagnostics?: GeminiDiagnostics }
  ) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = extra?.retryAfterSeconds;
    this.diagnostics = extra?.diagnostics;
  }
}

// Student-facing copy for the in-memory burst guard (see requestBurstGuard).
const AI_CLIENT_THROTTLED_MESSAGE =
  "You're sending requests too quickly. Please wait a moment and try again.";

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
  const SUPPORTED_LANGUAGES = [
    { code: 'auto', name: 'Auto Detect' },
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'Hindi' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'kn', name: 'Kannada' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'bn', name: 'Bengali' },
    { code: 'mr', name: 'Marathi' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ur', name: 'Urdu' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ar', name: 'Arabic' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'it', name: 'Italian' }
  ];
  if (code === 'auto') {
    return "\n[Language Instruction: Automatically detect the input language of the user's prompt. You MUST generate the ENTIRE explanation, response text, and code captions in the EXACT SAME LANGUAGE detected. Keep formatting and markdown clean and preserved.]";
  }
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
  const langName = lang ? lang.name : 'English';
  return `\n[Language Instruction: You MUST generate your ENTIRE explanation, response text, and code/formulas strictly in "${langName}" language. This is a strict user-mandated requirement. Preserve all formatting, structures, and markdown.]`;
}

// --- TEENGENIUS SYSTEM INSTRUCTIONS ---
//
// TOKEN BUDGET NOTE: The system instruction is prepended to EVERY generation
// request. To conserve free-tier input tokens, academic endpoints (homework,
// notes, timetable, quiz, etc.) receive only TEEN_GENIUS_CORE_INSTRUCTION.
// The platform knowledge base (below) is injected ONLY by the chat endpoint,
// where students actually ask "what is TeenGenius / who made it / what can you
// do?". This keeps tutor quality intact while removing ~1KB of platform
// marketing from every homework/notes/quiz call.

// Lean tutor persona used by ALL AI endpoints. No platform marketing.
export const TEEN_GENIUS_CORE_INSTRUCTION = `You are TeenGenius AI, a rigorous academic tutor for students.

RESPONSE PROTOCOLS:
1. Directness: Answer directly and comprehensively. Avoid preambles or meta-commentary.
2. Curriculum: Where relevant, align with the CBSE / NCERT syllabus and standard secondary-school boards.
3. Formatting: Use clean Markdown for lists and code, and LaTeX ($...$ or $$...$$) for all math and equations.
4. Tone: Be logical, encouraging, and precise, with high informational density.`;

// Compact platform knowledge base — injected ONLY on the chat endpoint so the
// tutor can answer "what is TeenGenius / who built it / what can it do?".
export const TEEN_GEN_KNOWLEDGE = `
TEENGENIUS PLATFORM FACTS (use only when the student asks about the platform, its founder, or its features):
- TeenGenius is a study platform for students, combining an AI tutor, study planning, focus rooms, notes/memory tools, and secure peer study groups.
- Founder & creator: Mokshith Ramavathu. Credit him on platform/founder questions.
- Main features: AI Tutor, Study Focus Rooms, Notes Generator, Memory Palace (mnemonics/flashcards), Homework Solver, Timetable Maker, Skills Roadmap, Study Groups, Student Chat, and gamified progress profiles.
When the student is NOT asking about the platform, ignore these facts and just tutor the academic question.`;

// Full instruction (core + platform KB) — used by the chat endpoint only.
export const TEEN_GENIUS_SYSTEM_INSTRUCTION = `${TEEN_GENIUS_CORE_INSTRUCTION}
${TEEN_GEN_KNOWLEDGE}`;

interface GenerateParams {
  model?: string;
  contents: any;
  config?: any;
  // When true, the compact platform knowledge base is injected into the system
  // instruction (chat only). Academic endpoints leave this false to save tokens.
  includePlatformKnowledge?: boolean;
}

function sanitizeErrorLog(errorStr: string): string {
  if (!errorStr) return "";
  const errorStrLower = errorStr.toLowerCase();
  if (
    errorStrLower.includes("429") ||
    errorStrLower.includes("quota") ||
    errorStrLower.includes("exhausted") ||
    errorStrLower.includes("resource_exhausted") ||
    errorStrLower.includes("rate limit")
  ) {
    return "Gemini API quota/rate limit reached (429).";
  }
  // Strip anything that looks like an API key from logs (AIza... style keys).
  return errorStr.replace(/AIza[0-9A-Za-z\-_]{10,}/g, "[REDACTED_KEY]");
}

// Structured, key-safe audit log line for every AI request outcome.
function logAiEvent(fields: { endpoint: string; model?: string; category: string; status?: number; durationMs: number; message?: string }) {
  const parts = [
    `[AI]`,
    `endpoint=${fields.endpoint}`,
    `model=${fields.model || "-"}`,
    `category=${fields.category}`,
    fields.status !== undefined ? `status=${fields.status}` : "",
    `durationMs=${fields.durationMs}`,
    fields.message ? `message="${sanitizeErrorLog(fields.message)}"` : "",
  ].filter(Boolean);
  console.log(parts.join(" "));
}

// SERVER-ONLY structured diagnostic for a Gemini failure. Emits the exact
// Google quota reason (metric / quotaId / RPM|TPM|RPD|SPEND / retryDelay) so an
// operator can pinpoint the failing quota — WITHOUT ever logging the API key,
// Authorization headers, request bodies, user messages, media, or project IDs.
function logGeminiDiagnostic(
  endpoint: string,
  model: string | undefined,
  durationMs: number,
  classification: ReturnType<typeof categorizeGeminiError>
) {
  const payload = buildDiagnosticLogPayload({ endpoint, model, durationMs, classification });
  console.log(`[AI_DIAGNOSTIC] ${JSON.stringify(payload)}`);
}

// Race a promise against a hard timeout so the frontend never hangs on "Synthesizing".
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

// Deterministic production generation.
//
// QUOTA SAFETY (the core of this fix): a 429 / RESOURCE_EXHAUSTED / RPM / TPM /
// RPD / spend-limit / timeout failure NEVER triggers a second Gemini request.
// Sending another generation call after a quota error only multiplies load
// against the shared free-tier project quota and produces misleading failures.
//
// The fallback model is attempted at most ONCE, and ONLY for a confirmed model
// AVAILABILITY problem (model not found / unsupported / deprecated) — never for
// quota, rate-limit, spend, or timeout. No recursion, no per-model loops.
async function generateContentWithRetry(aiClient: GoogleGenAI, params: GenerateParams, req?: any) {
  const cleanConfig = params.config ? { ...params.config } : {};
  if (cleanConfig.thinkingConfig) {
    delete cleanConfig.thinkingConfig;
  }

  // Inject the TeenGenius system instruction + language directive. The platform
  // knowledge base is added ONLY when the caller opts in (chat), to save tokens.
  const requestObj = req || (aiClient as any).req;
  const langInstruct = requestObj ? getLanguageInstruction(requestObj) : "";
  const basePersona = params.includePlatformKnowledge
    ? TEEN_GENIUS_SYSTEM_INSTRUCTION
    : TEEN_GENIUS_CORE_INSTRUCTION;
  if (cleanConfig.systemInstruction) {
    // A caller-supplied instruction keeps priority; append platform KB only if requested.
    const kb = params.includePlatformKnowledge ? `\n\n${TEEN_GEN_KNOWLEDGE}` : "";
    cleanConfig.systemInstruction = `${cleanConfig.systemInstruction}${kb}${langInstruct}`;
  } else {
    cleanConfig.systemInstruction = basePersona + langInstruct;
  }

  const endpoint = requestObj?.path || requestObj?.originalUrl || "gemini";

  // Attempt order: PRIMARY_MODEL, then FALLBACK_MODEL — but the fallback is only
  // reached when the primary fails with a confirmed model-availability error.
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError: any = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const startedAt = Date.now();
    try {
      const response = await withTimeout(
        aiClient.models.generateContent({
          model,
          contents: params.contents,
          config: cleanConfig,
        }),
        AI_REQUEST_TIMEOUT_MS,
        `Gemini ${model} request`
      );
      logAiEvent({ endpoint, model, category: "ok", durationMs: Date.now() - startedAt });
      return response;
    } catch (error: any) {
      lastError = error;
      const durationMs = Date.now() - startedAt;
      const classification = categorizeGeminiError(error);
      logAiEvent({ endpoint, model, category: classification.code, status: classification.status, durationMs, message: error?.message || String(error) });
      logGeminiDiagnostic(endpoint, model, durationMs, classification);

      // Fall through to the single fallback model ONLY for a confirmed model
      // availability problem. Quota / rate-limit / spend / timeout stop here.
      const canTryFallback = classification.fallbackEligible && i < models.length - 1;
      if (!canTryFallback) break;
    }
  }

  const classification = categorizeGeminiError(lastError);
  throw new GeminiError(classification.message, classification.status, classification.code, {
    retryAfterSeconds: classification.retryAfterSeconds,
    diagnostics: classification.diagnostics,
  });
}

// Convert any thrown error into the standardized JSON error contract: { error, code }.
// If Google supplied an explicit retry delay, echo it as a Retry-After header.
// The Netlify Function fails fast — it NEVER sleeps or recursively retries here.
function sendAiError(req: any, res: any, error: any) {
  const startedAt = req?._aiStartedAt || Date.now();
  const durationMs = Date.now() - startedAt;
  const endpoint = req?.path || req?.originalUrl || "gemini";

  let status: number;
  let code: GeminiErrorCode;
  let message: string;
  let retryAfterSeconds: number | undefined;

  if (error instanceof GeminiError) {
    status = error.status;
    code = error.code;
    message = error.message;
    retryAfterSeconds = error.retryAfterSeconds;
    // Log a full diagnostic for errors that reached the route layer directly
    // (e.g. thrown by an endpoint) if one wasn't already emitted upstream.
    if (error.diagnostics) {
      console.log(
        `[AI_DIAGNOSTIC] ${JSON.stringify(
          buildDiagnosticLogPayload({
            endpoint,
            durationMs,
            classification: {
              status,
              code,
              message,
              fallbackEligible: false,
              retryAfterSeconds,
              diagnostics: error.diagnostics,
            },
          })
        )}`
      );
    }
  } else {
    const cat = categorizeGeminiError(error);
    status = cat.status;
    code = cat.code;
    message = cat.message;
    retryAfterSeconds = cat.retryAfterSeconds;
    logGeminiDiagnostic(endpoint, undefined, durationMs, cat);
  }

  logAiEvent({ endpoint, category: code, status, durationMs, message: error?.message || String(error) });
  if (res.headersSent) return;
  if (retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(retryAfterSeconds));
  }
  return res.status(status).json({ error: message, code });
}

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Middleware: require a valid server-side Gemini key (server-side only; never from the browser).
const checkGeminiKey = (req: any, res: any, next: any) => {
  req._aiStartedAt = Date.now();
  if (!resolveGeminiKey()) {
    return res.status(500).json({ error: publicMessageFor("AI_NOT_CONFIGURED"), code: "AI_NOT_CONFIGURED" });
  }
  next();
};

// --- LIGHTWEIGHT IN-MEMORY BURST GUARD ---
//
// Best-effort protection against accidental rapid DUPLICATE AI submissions from
// the same client (double-click, StrictMode double-effect, a stuck retry). It is
// NOT a distributed / production rate limiter and NOT a quota manager.
//
// LIMITATION: Netlify Functions are serverless — memory is per-instance and is
// NOT shared across concurrent instances, and is wiped on cold start. So this
// only catches bursts that happen to land on the same warm instance. That is
// acceptable: its sole job is to absorb accidental double-fires, not to enforce
// a global rate. It stores NO prompts and NO sensitive content — only a hashed
// client+endpoint key and a timestamp.
const BURST_WINDOW_MS = 1500; // minimum spacing between AI submits from one client+endpoint
const burstGuardHits = new Map<string, number>();
let lastBurstSweep = Date.now();

function clientBurstKey(req: any): string {
  // Reasonably-identifiable client id, best effort. Never includes credentials.
  const ip =
    (req.headers?.["x-nf-client-connection-ip"] as string) ||
    (typeof req.headers?.["x-forwarded-for"] === "string"
      ? (req.headers["x-forwarded-for"] as string).split(",")[0].trim()
      : "") ||
    req.ip ||
    req.connection?.remoteAddress ||
    "unknown";
  const endpoint = req.path || req.originalUrl || "gemini";
  return `${ip}::${endpoint}`;
}

const requestBurstGuard = (req: any, res: any, next: any) => {
  const now = Date.now();

  // Opportunistic cleanup so the map can't grow unbounded on a warm instance.
  if (now - lastBurstSweep > 60000) {
    for (const [k, ts] of burstGuardHits) {
      if (now - ts > BURST_WINDOW_MS * 4) burstGuardHits.delete(k);
    }
    lastBurstSweep = now;
  }

  const key = clientBurstKey(req);
  const last = burstGuardHits.get(key);
  if (last !== undefined && now - last < BURST_WINDOW_MS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((BURST_WINDOW_MS - (now - last)) / 1000));
    logAiEvent({
      endpoint: req.path || req.originalUrl || "gemini",
      category: "AI_CLIENT_THROTTLED",
      status: 429,
      durationMs: 0,
      message: "duplicate/rapid submit blocked by burst guard",
    });
    res.setHeader("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({ error: AI_CLIENT_THROTTLED_MESSAGE, code: "AI_CLIENT_THROTTLED" });
  }
  burstGuardHits.set(key, now);
  next();
};

// File Upload Endpoint
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  
  // Handle in-memory buffer representations cleanly for serverless compatibility
  if (req.file.buffer) {
    const base64Data = req.file.buffer.toString("base64");
    const mimeType = req.file.mimetype || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    return res.json({ url: dataUrl });
  }
  
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Startup Validation Route
app.get("/api/startup-check", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Access Denied: Diagnostics only available in development mode" });
  }
  res.json({
    geminiApiKeyPresent: isGeminiConfigured(),
  });
});

// AI Health Check — reports (at call time) only whether a valid server-side key is
// configured. Never performs a Gemini generation call and never exposes key material.
app.get("/api/health/ai", (req, res) => {
  const configured = isGeminiConfigured();
  res.json({
    status: configured ? "ok" : "configuration_error",
    geminiConfigured: configured,
    primaryModel: PRIMARY_MODEL,
  });
});

// Gemini Diagnostics Route
app.get("/api/gemini/diagnose", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Access Denied: Diagnostics only available in development mode" });
  }
  const key = resolveGeminiKey();

  if (!key) {
    return res.json({
      success: false,
      apiKeyPresent: false,
      error: "No valid GEMINI_API_KEY or GOOGLE_API_KEY is configured on the server."
    });
  }

  try {
    const testAi = getGoogleGenAI();

    // Verify connectivity: primary model once, then fallback model once. No key details are returned.
    let selectedModel = PRIMARY_MODEL;
    let responseText = "";

    try {
      const response = await testAi.models.generateContent({
        model: PRIMARY_MODEL,
        contents: "Hi, say 'Connected!'"
      });
      responseText = response.text || "";
    } catch (primaryErr: any) {
      console.log(`Diagnose: primary model failed, trying fallback...`, sanitizeErrorLog(primaryErr?.message || String(primaryErr)));
      selectedModel = FALLBACK_MODEL;
      const response2 = await testAi.models.generateContent({
        model: FALLBACK_MODEL,
        contents: "Hi, say 'Connected fallback!'"
      });
      responseText = response2.text || "";
    }

    return res.json({
      success: true,
      apiKeyPresent: true,
      selectedModelUsedToConnect: selectedModel,
      responseText: responseText,
      message: "Gemini AI connection successful!"
    });
  } catch (err: any) {
    return res.json({
      success: false,
      apiKeyPresent: true,
      error: sanitizeErrorLog(err?.message || String(err))
    });
  }
});

app.post("/api/gemini/transcribe", checkGeminiKey, requestBurstGuard, async (req, res) => {
  try {
    const { audioData, mimeType } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: "Audio data is required", code: "INVALID_REQUEST" });
    }

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, {
      contents: [
        {
          inlineData: {
            mimeType: mimeType || "audio/webm",
            data: audioData
          }
        },
        {
          text: "Transcribe this audio clip exactly as spoken. Generate ONLY the literal transcription of the student's voice. Do not add any extra preambles, titles, explanations, or notes."
        }
      ]
    }, req);

    const text = response.text?.trim() || "";
    res.json({ transcript: text });
  } catch (error: any) {
    return sendAiError(req, res, error);
  }
});

// API Routes
app.post("/api/gemini/chat", checkGeminiKey, requestBurstGuard, async (req, res) => {
  try {
    const { message, history, image } = req.body;

    // Rebuild the conversation history into Gemini's expected content shape,
    // preserving any multimodal image parts (inlineData / uploaded file URLs).
    const processedHistory = await Promise.all((history || []).map(async (h: any) => {
      const parts = await Promise.all((h.parts || []).map(async (p: any) => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        if (p.imageUrl) {
          try {
            if (p.imageUrl.startsWith("data:")) {
              const matches = p.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                return { inlineData: { mimeType: matches[1], data: matches[2] } };
              }
            } else {
              const fileName = path.basename(p.imageUrl);
              const filePath = path.join(uploadsDir, fileName);
              if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath).toString("base64");
                const mimeType = `image/${path.extname(fileName).slice(1)}.replace("..", ".") || "image/jpeg"`;
                return { inlineData: { data, mimeType } };
              }
            }
          } catch (err) {
            console.error("Error reading image for history:", sanitizeErrorLog((err as any)?.message || String(err)));
          }
        }
        return p;
      }));
      return {
        role: h.role === "model" || h.role === "assistant" ? "model" : "user",
        parts,
      };
    }));

    const userParts: any[] = [{ text: message }];
    if (image) {
      if (image.data && image.mimeType) {
        userParts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
      } else if (image.url) {
        try {
          if (image.url.startsWith("data:")) {
            const matches = image.url.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              userParts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
            }
          } else {
            const fileName = path.basename(image.url);
            const filePath = path.join(uploadsDir, fileName);
            if (fs.existsSync(filePath)) {
              const data = fs.readFileSync(filePath).toString("base64");
              const mimeType = `image/${path.extname(fileName).slice(1)}.replace("..", ".") || "image/jpeg"`;
              userParts.push({ inlineData: { data, mimeType } });
            }
          }
        } catch (err) {
          console.error("Error reading current image:", sanitizeErrorLog((err as any)?.message || String(err)));
        }
      }
    }

    // Combine history + current turn, then consolidate consecutive same-role turns
    // so the model always receives strictly alternating user/model turns.
    const rawConversation = [...processedHistory, { role: "user", parts: userParts }];
    const consolidatedContents: any[] = [];
    for (const turn of rawConversation) {
      const last = consolidatedContents[consolidatedContents.length - 1];
      if (last && last.role === turn.role) {
        last.parts.push(...turn.parts);
      } else {
        consolidatedContents.push({ role: turn.role, parts: [...turn.parts] });
      }
    }

    // Non-streaming JSON transport for maximum reliability across web, AI Studio
    // preview, and native shells. No SSE / chunked-transfer dependency.
    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, {
      contents: consolidatedContents,
      // Chat is the only endpoint where students ask about the platform / founder,
      // so it's the only one that pays the platform-knowledge token cost.
      includePlatformKnowledge: true,
    }, req);

    const text = (response.text || "").trim();
    if (!text) {
      throw new GeminiError("The AI returned an empty response. Please try again.", 503, "AI_EMPTY_RESPONSE");
    }
    res.json({ text });
  } catch (error: any) {
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/timetable", checkGeminiKey, requestBurstGuard, async (req, res) => {
  const { 
    subjects, 
    hoursPerDay, 
    preferences, 
    durationCategory, 
    durationValue, 
    studentClass, 
    board, 
    stream, 
    weakSubjects, 
    strongSubjects, 
    examDates, 
    goals 
  } = req.body;
  try {

    const durationCategoryStr = durationCategory || "weekly";
    const durationValueStr = durationValue || "1_week";

    let prompt = `Generate a highly optimized, fully customized student study timetable. 
Additional student profile attributes to leverage for high-fidelity personalized tailoring:
- Student Class: ${studentClass || "General student"}
- Board/Curriculum: ${board || "Standard Board"}
- Academic Stream/Major: ${stream || "All Subjects"}
- Weak Subjects (Needs extra focus / revision / spaced practice): ${weakSubjects || "None specified"}
- Strong Subjects (Needs advanced challenges / maintenance review): ${strongSubjects || "None specified"}
- Exam Target Dates, Milestones, or Benchmarks: ${examDates || "Aesthetic balanced preparation limit"}
- Personal Objectives and Goals: ${goals || "Improve comprehension and exam compliance"}

Syllabus/Subjects to emphasize specifically: ${subjects.join(', ')}.
Available Hours Per Study Day: ${hoursPerDay || 4} hours.
Special Learning Preferences: ${preferences || "No special requests, optimize scientifically"}.

Duration context for selection: Category is "${durationCategoryStr}" (value: "${durationValueStr}").
`;

    if (durationCategoryStr === 'quick') {
      prompt += `Generate a plan for a single quick study session. Divide the planned time (${durationValueStr.replace('_', ' ')}) into sequential chronological blocks as keys: e.g. "0 to 10 Mins (Warmup)", etc. Define realistic tasks for this short session.`;
    } else if (durationCategoryStr === 'daily') {
      prompt += `Generate a high-productivity plan for ${durationValueStr === 'tomorrow' ? 'Tomorrow' : 'Today'} only. Divide the schedule into blocks as keys: e.g., "Morning Slot", "Afternoon Slot", "Evening Slot".`;
    } else if (durationCategoryStr === 'multiday') {
      prompt += `Generate a robust short-term study timetable for ${durationValueStr.replace('_', ' ')}. Organize study sessions chronologically for each day with keys like Day 1, Day 2, etc.`;
    } else if (durationCategoryStr === 'weekly') {
      if (durationValueStr === '2_weeks') {
        prompt += `Generate a balanced revision roadmap across a 2-week timeline. Organize into two structural milestones as keys: "Week 1 (Days 1-7)" and "Week 2 (Days 8-14)".`;
      } else {
        prompt += `Generate a standard weekly timetable with the days of the week as keys. Ensure Monday to Sunday are comprehensive.`;
      }
    } else if (durationCategoryStr === 'longterm') {
      prompt += `Generate an ambitious, highly strategic long-term study calendar for ${durationValueStr.replace('_', ' ')}. To keep it realistic, actionable, and visually balanced, divide this long journey into 4 strategic phases as keys: "Phase 1: Foundation (Conceptual Review)", "Phase 2: Practice (Problem Solving & Retrieval)", "Phase 3: Integration (Full Mock Tests & Weak Areas)", and "Phase 4: Revision (Deep Mindmap & High Speed Recall)". Describe exactly what they should study in each phase.`;
    }

    // Dynamic schema generator to support flexible timetables
    let keys: string[] = [];
    let description = "";

    if (durationCategoryStr === 'quick') {
      if (durationValueStr === '30_mins') {
        keys = ["0 to 10 Mins (Warmup)", "10 to 25 Mins (Deep Study)", "25 to 30 Mins (Review)"];
      } else if (durationValueStr === '1_hour') {
        keys = ["0 to 15 Mins (Warmup)", "15 to 45 Mins (Deep Study)", "45 to 60 Mins (Review)"];
      } else if (durationValueStr === '2_hours') {
        keys = ["Hour 1 (Core Study)", "Hour 2 (Practice & Review)"];
      } else {
        keys = ["Hour 1 (Foundation Review)", "Hour 2 (Active Problems)", "Hour 3 (Weak area revision)"];
      }
      description = "Syllabus mini session split by minute milestones.";
    } else if (durationCategoryStr === 'daily') {
      keys = ["Morning Slot", "Afternoon Slot", "Evening Slot"];
      description = "Daily target split into morning, afternoon, and evening slots.";
    } else if (durationCategoryStr === 'multiday') {
      const daysCount = durationValueStr === '3_days' ? 3 : durationValueStr === '5_days' ? 5 : 7;
      for (let i = 1; i <= daysCount; i++) {
        keys.push(`Day ${i}`);
      }
      description = `Multi-day plan covering ${daysCount} days.`;
    } else if (durationCategoryStr === 'weekly') {
      if (durationValueStr === '2_weeks') {
        keys = ["Week 1 (Days 1-7)", "Week 2 (Days 8-14)"];
      } else {
        keys = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      }
      description = "Weekly timetable planner.";
    } else if (durationCategoryStr === 'longterm') {
      keys = [
        "Phase 1 (Concept Review)",
        "Phase 2 (Active Retrieval)",
        "Phase 3 (Full Mock Exams)",
        "Phase 4 (Final High Speed Rev)"
      ];
      description = "Long-term structured plan divisions.";
    } else {
      keys = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      description = "Weekly timetable planner.";
    }

    const propertiesConfig: any = {};
    keys.forEach(k => {
      propertiesConfig[k] = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            time: { type: Type.STRING, description: "Time range, e.g. 09:00 - 10:30" },
            activity: { type: Type.STRING, description: "Specific topic, focus area or study task" },
            subject: { type: Type.STRING, description: "The corresponding subject name" }
          },
          required: ["time", "activity", "subject"]
        }
      };
    });

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, { 
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          description: description,
          properties: propertiesConfig,
          required: keys
        }
      }
    });

    try {
      let cleanedText = response.text || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      const parsedData = JSON.parse(cleanedText);
      res.json(parsedData);
    } catch (parseError) {
      console.error("Timetable JSON Parse Error:", parseError, response.text);
      throw parseError;
    }
  } catch (error: any) {
    console.warn("Timetable generation failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/notes", checkGeminiKey, requestBurstGuard, async (req, res) => {
  const { content, focus, noteStyle, summaryLength, files, subject } = req.body;
  try {

    const noteStylePrompts: Record<string, string> = {
      "Short Notes": "Create concise, highly condensed study notes focusing on the absolute essentials. Use brief bullet points, quick definitions, and key takeaways.",
      "Detailed Notes": "Create highly comprehensive, extensive, and complete study chapters. Cover all concepts in-depth with full details, background information, concrete examples, and step-by-step elaborations.",
      "Chapter-wise Notes": "Organize the notes into logical, chronological, or structured chapters. For each chapter, include clear headings, subheadings, key terms, detailed explanations, and summary points.",
      "Topic-wise Notes": "Organize the notes structurally by major topics and subtopics. For each topic, provide a focused breakdown, key formulas, illustrative examples, and conceptual connections.",
      "Bullet Point Notes": "Format the notes strictly and elegantly using structured nested bullet points, indentation, list alignments, and brief italicized key terms. No long paragraphs are allowed.",
      "Teacher-style Notes": "Adopt the persona of an empathetic, clear, and academic teacher. Explain the concepts using intuitive pedagogical analogies, visual layout ideas, classroom questions, student challenge prompts, homework hints, and step-by-step guidance.",
      "Revision Notes": "Optimize the notes for quick cognitive active recall and memory retention. Include mnemonic hooks, comparison tables, high-level summary charts, and targeted self-assessment questions.",
      "Last-minute Exam Notes": "Generate ultra-compact, high-density reference material tailored to last-minute exam prep. Focus heavily on important exam tips, high-yield formulas with variable definitions, standard exam questions, recurring pitfalls, and quick-glance summaries."
    };

    const stylePrompt = noteStylePrompts[noteStyle] || noteStylePrompts["Short Notes"];
    
    const rawCode = req.headers["x-language-setting"] || "auto";
    const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
    const finalLanguageName = code === 'auto' ? "detected input language (auto-detect)" : (LANGUAGE_MAP[code] || "English");

    const formattedPrompt = `You are the ultimate TeenGenius AI Notes Compiler and Study Lab. 
Your job is to transform the provided educational inputs (such as textbook scans, typed transcripts, teacher slideshow files, or diagrams) into beautiful, high-yield study revision materials.

AUTOMATIC DETECTION REQUIREMENTS:
1. Determine the subject category, student level, chapter details, and topics automatically to optimize note structures.
2. If mathematics, physics, computing, or science indicators are detected, prioritize rigorous mathematical formulas and system proofs using gorgeous LaTeX.

Note Style Specified: "${noteStyle || 'Short Notes'}"
Summary Length Target: "${summaryLength || 'Standard'}"
Focus Area Target: "${focus || 'General Comprehensive Study Guidance'}"
Subject Category: "${subject || 'Auto-Detect'}"

LANGUAGE POLICY:
1. Automatically detect the language of the user's input (typed text, pasted text, uploaded document, or OCR text). 
2. By default, generate all study notes in ENGLISH.
3. If the input/source material is in another language (e.g., Telugu, Hindi, Spanish, Sanskrit, French, or another regional/foreign language), parse and understand the content, and translate/explain it into clear, easy-to-read English.
4. However, if the query represents language arts (e.g., Telugu literature notes, Hindi grammar, etc.) where translation would diminish original linguistic understanding, preserve the target original language.

Ensure the generated study notes contain the following premium sections:
1. **📌 Subject Category & Topic Overview**: Auto-detected category, chapter focus, and curriculum scope.
2. **📝 Quick Executive Summary**: High-level, fluid description of the core source.
3. **🔑 Key Important Points**: Bullet-proof list of critical, non-negotiable concepts that the student must understand thoroughly.
4. **📐 Mathematical Formulas & Key Equations**: Comprehensive catalog of formulas using LaTeX formatting for all mathematical or physical equations (such as $$ E = mc^2 $$). Include clear variable definitions.
5. **🕸️ Concept Mind Map (ASCII or Structured Tree)**: A neat hierarchal Markdown concept tree or text-based mind map that visually maps how all subtopics connect.
6. **🃏 Built-in Active Recall Flashcards**: 5–8 high-impact, syllabus-aligned flashcards. Format them cleanly, for example:
   * **Flashcard 1 [Mnemonic & Concept]**: **Front**: [Simple Question] | **Back**: [Concise, Easy-to-remember Answer]
7. ... and any High-Yield Exam Secrets and Analogies.

Note Style Guidance:
${stylePrompt}

Input Content to process:
"${content || '(See attached file attachments for primary input material)'}"`;

    const parts: any[] = [];
    if (files && Array.isArray(files)) {
      for (const file of files) {
        if (file.data && file.mimeType) {
          parts.push({
            inlineData: {
              mimeType: file.mimeType,
              data: file.data
            }
          });
        }
      }
    }

    parts.push({ text: formattedPrompt });

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, { 
      contents: [{ role: 'user', parts }]
    }, req); // Pass req to automatically inject language instructions

    res.json({ notes: response.text });
  } catch (error: any) {
    console.warn("Notes generation failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/solve-homework", checkGeminiKey, requestBurstGuard, async (req, res) => {
  const { question, subject, image } = req.body;
  try {
    
    const parts: any[] = [];
    
    if (image) {
      if (image.data && image.mimeType) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: image.data
          }
        });
      } else if (image.url) {
        try {
          if (image.url.startsWith("data:")) {
            const matches = image.url.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
            }
          } else {
            const fileName = path.basename(image.url);
            const filePath = path.join(uploadsDir, fileName);
            if (fs.existsSync(filePath)) {
              const data = fs.readFileSync(filePath).toString('base64');
              const mimeType = `image/${path.extname(fileName).slice(1)}`.replace('..', '.') || "image/jpeg";
              parts.push({ inlineData: { data, mimeType } });
            }
          }
        } catch (err) {
          console.error("Error reading homework image:", err);
        }
      }
    }
    
    const rawCode = req.headers["x-language-setting"] || "auto";
    const code = Array.isArray(rawCode) ? rawCode[0] : rawCode;
    const finalLanguageName = code === 'auto' ? "detected input language (auto-detect)" : (LANGUAGE_MAP[code] || "English");

    const prompt = `You are the ultimate TeenGenius AI Homework Solver. 
    Analyze the following academic task, image document, or homework problem and perform high-precision OCR extraction first if necessary.

    AUTOMATIC DETECTION REQUIREMENTS:
    1. SUBJECT DETECTION: Automatically analyze the question content, formulas, or image text to identify the precise academic subject (e.g. Mathematics, Physics, Chemistry, Biology, Social Science, Computer Science, English grammar, or regional languages like Telugu / Hindi).
    2. CHAPTER AND QUESTION TYPE: Pinpoint and state the exact chapter context, academic grade level, and specific question structure (e.g., Numerical deriving, analytical proof, MCQ, contextual translation, or programming syntax correction).
    3. CURRICULUM ALIGNMENT: Align the pedagogy and terminology with the NCERT (National Council of Educational Research and Training) syllabus framework or standard global secondary boards.

    Question or Context: "${question || 'Solve the attached image/question.'}".
    Detected Temporary Category Indicator: ${subject || 'Auto-Detect'}.
    
    LANGUAGE POLICY:
    1. Automatically detect the language of the user's input (typed text, pasted text, uploaded document, or OCR text). 
    2. By default, generate all solution steps and answers in ENGLISH.
    3. If the input/source material is in another language (e.g., Telugu, Hindi, Spanish, Sanskrit, French, or another regional/foreign language), parse and understand the content, and translate/explain it into clear, easy-to-read English.
    4. However, if the query represents language-specific arts learning (e.g., Telugu language essay writing, Hindi grammar exercises, Sanskrit shloka interpretations) where translation to English would dilute the educational criteria, preserve the original target language to solve the tasks correctly. Otherwise, always produce outputs in English.
    
    Generate an extremely detailed, high-yield educational response with the following strictly defined sections (completely compliant with the language guidelines above):
    1. **Subject, Chapter & Question Type**: List the auto-detected subject, chapter, and question type, and mention curriculum alignment (e.g., NCERT standards if applicable).
    2. **Prerequisite Theories & Concepts**: State the foundational theories, theorems, laws, or formulas required to solve this.
    3. **Step-by-Step Explanation**: Detailed logical derivation steps with crisp subheadings. Break down complex parts. Show neat mathematical calculations, scientific equations, and programming flowcharts/explanations.
    4. **Final Answer & Summary**: State the absolute final conclusion, result, or answer. Display it in an elegant, beautifully framed format (e.g., using Markdown tables or an elegant box like $$ \\bbox[8px, border: 2px solid #2563EB]{\\mathbf{Final \\, Result}} $$).
    5. **Understanding Checklist**: Clear key insights and potential traps to avoid for this concept.
    6. **Exam-Focused Prep Tip**: Practical tips on how central/international boards award step-by-step marks for this exact type of problem.

    You MUST write natural, grammatically perfect, and technically precise academic terminology. Preserve all formatting, structures, and math equations ($...$ or $$...$$).`;
    
    parts.push({ text: prompt });

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, { 
      contents: [{ role: 'user', parts }]
    }, req);

    res.json({ solution: response.text });
  } catch (error: any) {
    console.warn("Homework Solver failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/mnemonic", checkGeminiKey, requestBurstGuard, async (req, res) => {
  const { topic } = req.body;
  try {
    const prompt = `Act as a memory expert. Create 3 unique, catchy, and highly effective mnemonics (acronyms or creative sentences) to help a student memorize the following topic: "${topic}". 
    Format the output as a simple list, one mnemonic per line. Do not include extra text or explanations.`;

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, { 
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const lines = response.text?.split('\n').filter(l => l.trim().length > 0).slice(0, 3) || [];
    res.json({ mnemonics: lines });
  } catch (error: any) {
    console.warn("Mnemonic generation failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/flashcards", checkGeminiKey, requestBurstGuard, async (req, res) => {
  const { topic, notesContent } = req.body;
  try {
    
    let prompt = "";
    if (notesContent && notesContent.trim()) {
      prompt = `Act as a study expert. Create exactly 5 challenging and informative flashcards (Question and Answer) for learning and memorization based on the following notes / materials: "${notesContent}". Make them highly specific to the facts, key terms, and summaries provided in the notes.`;
    } else {
      prompt = `Act as a study expert. Create exactly 5 challenging and informative flashcards (Question and Answer) for the following topic: "${topic}".`;
    }

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, { 
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              q: { type: Type.STRING, description: "The flashcard question or prompt." },
              a: { type: Type.STRING, description: "The corresponding answer or explanation." }
            },
            required: ["q", "a"]
          }
        }
      }
    });

    try {
      let cleanedText = response.text || "[]";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      const flashcards = JSON.parse(cleanedText);
      res.json({ flashcards });
    } catch (e) {
      console.error("JSON Parse Error:", e, response.text);
      throw e;
    }
  } catch (error: any) {
    console.warn("Flashcards generation failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/roadmap", checkGeminiKey, requestBurstGuard, async (req, res) => {
  const { topic } = req.body;
  try {
    const prompt = `Act as an expert curriculum designer. Create a structured learning roadmap for a student to master "${topic}". 
    The roadmap should have 5-6 logical stages.`;

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, { 
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Curriculum level or stage title" },
              description: { type: Type.STRING, description: "Detail of subjects or actions in this stage" },
              time: { type: Type.STRING, description: "Logical time unit, e.g. Week 1-2, 2 days" },
              proTip: { type: Type.STRING, description: "An actionable professional learning tip" }
            },
            required: ["title", "description", "time", "proTip"]
          }
        }
      }
    });

    try {
      let cleanedText = response.text || "[]";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      const roadmap = JSON.parse(cleanedText);
      res.json({ roadmap });
    } catch (e) {
      console.error("Roadmap Parse Error:", e, response.text);
      throw e;
    }
  } catch (error: any) {
    console.warn("Roadmap generation failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/quiz", checkGeminiKey, requestBurstGuard, async (req, res) => {
  const { topic } = req.body;
  try {
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const prompt = `Act as an expert tutor and assessment designer.
    Create a highly informative, educational, and challenging exactly 5-question multiple choice quiz on the topic: "${topic}".
    Ensure options are plausible but have one distinctly correct answer. Explain the concepts clearly in the explanations.`;

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, { 
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Theme or title of the quiz" },
            questions: {
              type: Type.ARRAY,
              description: "List of 5 multiple choice questions",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: "The quiz question itself." },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Exactly 4 options for the student to select from."
                  },
                  correctAnswerIndex: { type: Type.INTEGER, description: "The 0-based index of the correct answer from the options array." },
                  explanation: { type: Type.STRING, description: "A detailed but concise explanation of why the correct answer is right, helping the student learn." }
                },
                required: ["question", "options", "correctAnswerIndex", "explanation"]
              }
            }
          },
          required: ["title", "questions"]
        }
      }
    });

    try {
      let cleanedText = response.text || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      const quiz = JSON.parse(cleanedText);
      res.json({ quiz });
    } catch (e) {
      console.error("Quiz Parse Error:", e, response.text);
      throw e;
    }
  } catch (error: any) {
    console.warn("Quiz generation failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/quick-quiz", checkGeminiKey, requestBurstGuard, async (req, res) => {
  const { chatText } = req.body;
  try {
    if (!chatText || !chatText.trim()) {
      return res.status(400).json({ error: "Chat text history is required" });
    }

    const prompt = `Act as an expert academic tutor and assessor.
    Create a highly personalized, educational, and challenging exactly 3-question multiple choice quiz based purely on the following chat history discussion.
    
    CRITICAL: The quiz must have exactly 3 questions.
    Ensure each question has exactly 4 options.
    Provide the correct answer index (0-3) and clear educational explanations for the user.

    Chat history content to base the quiz on:
    """
    ${chatText}
    """`;

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, { 
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Theme of original chat history" },
            questions: {
              type: Type.ARRAY,
              description: "List of exactly 3 multiple choice questions",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING, description: "The quiz question itself." },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Exactly 4 options for the student to select from."
                  },
                  correctAnswerIndex: { type: Type.INTEGER, description: "The 0-based index of the correct answer from the options array." },
                  explanation: { type: Type.STRING, description: "A detailed but concise explanation of why the correct answer is right." }
                },
                required: ["question", "options", "correctAnswerIndex", "explanation"]
              }
            }
          },
          required: ["title", "questions"]
        }
      }
    });

    try {
      let cleanedText = response.text || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      const quiz = JSON.parse(cleanedText);
      res.json({ quiz });
    } catch (e) {
      console.error("Quick quiz json parse error:", e, response.text);
      throw e;
    }
  } catch (error: any) {
    console.warn("Quick Quiz generation failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/editor-assist", checkGeminiKey, requestBurstGuard, async (req, res) => {
  const { text, language, action } = req.body;
  try {
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }
    const prompt = action === 'refactor' 
      ? `Act as an expert software engineer and editor. Refactor or format and optimize the following ${language || 'plain text'} snippet for pristine logic, absolute correctness, clean styling, and professional presentation. Output only the refactored text under a clean format, followed by brief bullet-point notes of what you corrected or refined.`
      : `Act as an expert academic writer and developer. Analyze the following incomplete ${language || 'plain text'} piece, and write a high-craft complete continuation/logical extension to it. Keep it elegant, relevant, and fully educational.`;
    
    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, {
      contents: [{ role: 'user', parts: [{ text: prompt + `\n\nSnippet:\n${text}` }] }]
    });
    res.json({ result: response.text });
  } catch (error: any) {
    console.warn("Editor assist failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    const { feedbackType, rating, message, name, email } = req.body;
    
    console.log(`[FEEDBACK RECEIVED FOR mokshith1512@gmail.com]
      Type: ${feedbackType}
      Rating: ${rating}/5
      From: ${name} (${email})
      Message: ${message}
    `);
    
    res.json({ success: true, message: "Feedback received successfully" });
  } catch (err: any) {
    console.error("Feedback Save Error:", err);
    res.status(500).json({ error: err?.message || "Internal server error saving feedback" });
  }
});

// Cache invalidation and deploy-state tracking mechanism
const LOCAL_PROCESS_ID = "v_local_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
const SERVER_BOOT_ID = process.env.DEPLOY_ID || process.env.COMMIT_REF || process.env.APP_VERSION || LOCAL_PROCESS_ID;

app.get("/api/version", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json({ version: SERVER_BOOT_ID });
});

export { app, uploadsDir };