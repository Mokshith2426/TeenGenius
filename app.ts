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
class GeminiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "GeminiError";
    this.status = status;
    this.code = code;
  }
}

// Student-facing messages never mention server configuration or API keys.
const AI_MESSAGES = {
  AI_NOT_CONFIGURED: "TeenGenius AI is temporarily unavailable. Please try again later.",
  AI_AUTH_ERROR: "TeenGenius AI is temporarily unavailable. Please try again later.",
  AI_MODEL_ERROR: "TeenGenius AI is temporarily unavailable. Please try again later.",
  AI_TIMEOUT: "TeenGenius AI took too long to respond. Please try again.",
  AI_RATE_LIMITED: "TeenGenius AI is receiving too many requests right now. Please try again shortly.",
  AI_SERVICE_UNAVAILABLE: "TeenGenius AI is temporarily unavailable. Please try again.",
  AI_REQUEST_FAILED: "TeenGenius AI is temporarily unavailable. Please try again.",
} as const;

// Map a raw SDK/network error into a sanitized status + code + student-facing message.
// Only rate-limit / timeout / temporary-unavailable are retryable (drive the single fallback).
function categorizeGeminiError(err: any): { status: number; code: string; message: string; retryable: boolean } {
  if (err?.code === "AI_NOT_CONFIGURED") {
    return { status: 500, code: "AI_NOT_CONFIGURED", message: AI_MESSAGES.AI_NOT_CONFIGURED, retryable: false };
  }
  const raw = (err?.message || String(err) || "").toLowerCase();

  // Auth / permission: invalid key, expired key, permission denied, API disabled.
  if (
    raw.includes("api key not valid") ||
    raw.includes("api_key_invalid") ||
    raw.includes("api key expired") ||
    raw.includes("api_key_expired") ||
    raw.includes("permission_denied") ||
    raw.includes("permission denied") ||
    raw.includes("service_disabled") ||
    raw.includes("has not been used in project") ||
    raw.includes("unauthenticated") ||
    raw.includes("401") ||
    raw.includes("403")
  ) {
    return { status: 502, code: "AI_AUTH_ERROR", message: AI_MESSAGES.AI_AUTH_ERROR, retryable: false };
  }

  // Rate limit / quota.
  if (
    raw.includes("429") ||
    raw.includes("quota") ||
    raw.includes("exhausted") ||
    raw.includes("resource_exhausted") ||
    raw.includes("rate limit") ||
    raw.includes("rate-limit")
  ) {
    return { status: 429, code: "AI_RATE_LIMITED", message: AI_MESSAGES.AI_RATE_LIMITED, retryable: true };
  }

  // Timeout.
  if (raw.includes("timed out") || raw.includes("timeout") || raw.includes("etimedout") || raw.includes("deadline")) {
    return { status: 504, code: "AI_TIMEOUT", message: AI_MESSAGES.AI_TIMEOUT, retryable: true };
  }

  // Invalid / unavailable model.
  if (
    (raw.includes("model") && (raw.includes("not found") || raw.includes("not supported") || raw.includes("is not found for api version"))) ||
    raw.includes("unsupported model") ||
    raw.includes("invalid model") ||
    raw.includes("404")
  ) {
    return { status: 502, code: "AI_MODEL_ERROR", message: AI_MESSAGES.AI_MODEL_ERROR, retryable: false };
  }

  // Temporary upstream failure.
  if (raw.includes("503") || raw.includes("unavailable") || raw.includes("overloaded") || raw.includes("high demand")) {
    return { status: 503, code: "AI_SERVICE_UNAVAILABLE", message: AI_MESSAGES.AI_SERVICE_UNAVAILABLE, retryable: true };
  }

  return { status: 503, code: "AI_REQUEST_FAILED", message: AI_MESSAGES.AI_REQUEST_FAILED, retryable: false };
}

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

// --- TEENGENIUS KNOWLEDGE ENGINE & SYSTEM INSTRUCTIONS ---
export const TEEN_GEN_KNOWLEDGE = `
TEENGENIUS PLATFORM KNOWLEDGE BASE:
- Platform Name: TeenGenius (also recognized as Teengenius)
- Primary URL/Address: TeenGenius Network Web App (https://ai.studio/build/)
- Platform Mission & Purpose: TeenGenius is the elite cognitive workstation and performance-driven academic workspace designed specifically for ambitious students. It integrates clinical study planning, end-to-end encrypted collaboration hubs, AI-powered diagnostic tutor tools, immersive deep focus rooms, and procedural memory enhancement systems to help students tackle complex scientific, technical, and mathematical subjects.
- Platform Creator & Founder: Mokshith Ramavathu (built and launched specifically under Mokshith's domain address as a state-of-the-art student-genius accelerator). Mokshith developed TeenGenius to democratize top-tier cognitive resources and deep focus structures.
- Core TeenGenius Features and Modules:
  1. TeenGenius AI Tutor (AIAssistant): Personalized, 24/7 academic guide capable of streaming multi-stage concept explanations, rendering Markdown math expressions, formulating customized recall study plans, triggering diagnostic assessments, and suggesting practice quizzes.
  2. Study Focus Rooms (FocusRoom): An immersive deep-focus environment integrating customizable timers (such as state-of-the-art Pomodoros) and sound-engineered ambient synthesizers (like Focus Waves, Binaural Alpha Beats, Space Cosmos Echo, and Lofi Chill) to block noise and optimize cerebral blood flow.
  3. Notes & Outlines Synthesizer (NotesGenerator): Instantly transforms raw copy-pasted lectures, textbooks, code repos, or transcript snippets into high-fidelity markdown outlines, concept-tree diagrams, and retention summaries.
  4. Loci Memory Palace & Acronym Maker (MemoryPalace): Translates technical facts or sequence lists into immersive spatial paths (using the ancient Method of Loci), combined with automated acronym/acrostic engines and mnemonic revision cards.
  5. Homework Solver & Equation Analyzer (HomeworkSolver): An OCR-compatible, step-by-step mathematical and conceptual problem-solving engine. It reads uploaded scientific diagrams or equations and returns multi-stage LaTeX-based derivations.
  6. Intelligent Schedule Builder (TimetableMaker): Optimizes study calendars by dynamically analyzing a student's current subject lists, difficulty preferences, exam timelines, and daily active target hours to output structural timetables.
  7. Skills & Roadmap Architect (Roadmap): A nodes-based tree roadmap builder that graphs conceptual milestones, learning materials, and checkpoint challenges to systematically master rigorous technical fields (e.g., Quantum Mechanics, Vector Calculus, organic synthesis).
  8. Secure Study Groups (StudyGroups & StudyGroupDetail): Collaborative peer-led encrypted academic rooms with file exchanges, shared task milestones, and real-time multiplayer concept quizzes.
  9. Real-time Student Chat Support (ChatList & ChatRoom): Secure direct line communication supporting rich Markdown text, file uploads, peer status alerts, and instant study invites.
  10. Progression Profiles (Profile): Monitors and displays academic stats, levels, study durations, active focus sessions, streak meters, and custom unlockable achievement badges (such as Polymath, Focus Guru, AI Pioneer, and Syllabus Crusader) driven by XP rewards.
`;

export const TEEN_GENIUS_SYSTEM_INSTRUCTION = `You are TeenGenius AI, a premier cognitive research and academic intelligence system.
Your objective is to deliver authoritative, clinical, and high-fidelity academic support.

${TEEN_GEN_KNOWLEDGE}

INTELLIGENT RESPONSE PROTOCOLS:
1. Prioritize TeenGenius Knowledge: When users ask about TeenGenius, its founder, features, capabilities, or "what can you do?", always refer to the TeenGenius Platform Knowledge Base above. Avoid generic internet definitions or pretending not to know what TeenGenius is. Explicitly credit Mokshith Ramavathu as the founder/creator on platform questions.
2. Directness: Answer directly and comprehensively. Avoid unnecessary introductions, preambles, metadata, or meta-commentary.
3. Formatting: Use clean, professional Markdown formatting for all notes, lists, code samples, LaTeX math symbols ($...$ or \$\$...$$\), and equations.
4. Tone: Be sharply logical, encouraging, clinical, and extremely intelligent. Deliver answers with maximum informational density.
5. In-character: Never break character as the resident TeenGenius AI companion.
`;

interface GenerateParams {
  model?: string;
  contents: any;
  config?: any;
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

// Deterministic production generation: try the primary model ONCE, then the fallback model
// ONCE (only when the primary failed for a retryable reason: quota, rate limit, temporary
// unavailability, or timeout). No recursion, no per-model multi-attempt loops.
async function generateContentWithRetry(aiClient: GoogleGenAI, params: GenerateParams, req?: any) {
  const cleanConfig = params.config ? { ...params.config } : {};
  if (cleanConfig.thinkingConfig) {
    delete cleanConfig.thinkingConfig;
  }

  // Inject the global TeenGenius system instruction + language directive.
  const requestObj = req || (aiClient as any).req;
  const langInstruct = requestObj ? getLanguageInstruction(requestObj) : "";
  if (cleanConfig.systemInstruction) {
    cleanConfig.systemInstruction = `${cleanConfig.systemInstruction}\n\n${TEEN_GEN_KNOWLEDGE}${langInstruct}`;
  } else {
    cleanConfig.systemInstruction = TEEN_GENIUS_SYSTEM_INSTRUCTION + langInstruct;
  }

  const endpoint = requestObj?.path || requestObj?.originalUrl || "gemini";
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
      const cat = categorizeGeminiError(error);
      logAiEvent({ endpoint, model, category: cat.code, durationMs: Date.now() - startedAt, message: error?.message || String(error) });
      
      // Only fall through to the single fallback model for retryable failures.
      if (!cat.retryable) break;
    }
  }

  const cat = categorizeGeminiError(lastError);
  throw new GeminiError(cat.message, cat.status, cat.code);
}

// Convert any thrown error into the standardized JSON error contract: { error, code }.
function sendAiError(req: any, res: any, error: any) {
  const startedAt = req?._aiStartedAt || Date.now();
  const durationMs = Date.now() - startedAt;
  const endpoint = req?.path || req?.originalUrl || "gemini";

  let status: number;
  let code: string;
  let message: string;

  if (error instanceof GeminiError) {
    status = error.status;
    code = error.code;
    message = error.message;
  } else {
    const cat = categorizeGeminiError(error);
    status = cat.status;
    code = cat.code;
    message = cat.message;
  }

  logAiEvent({ endpoint, category: code, status, durationMs, message: error?.message || String(error) });
  if (res.headersSent) return;
  return res.status(status).json({ error: message, code });
}

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// Middleware: require a valid server-side Gemini key (server-side only; never from the browser).
const checkGeminiKey = (req: any, res: any, next: any) => {
  req._aiStartedAt = Date.now();
  if (!resolveGeminiKey()) {
    return res.status(500).json({ error: AI_MESSAGES.AI_NOT_CONFIGURED, code: "AI_NOT_CONFIGURED" });
  }
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

app.post("/api/gemini/transcribe", checkGeminiKey, async (req, res) => {
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
app.post("/api/gemini/chat", checkGeminiKey, async (req, res) => {
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
                const mimeType = `image/${path.extname(fileName).slice(1)}`.replace("..", ".") || "image/jpeg";
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
              const mimeType = `image/${path.extname(fileName).slice(1)}`.replace("..", ".") || "image/jpeg";
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
    }, req);

    const text = (response.text || "").trim();
    if (!text) {
      throw new GeminiError("The AI returned an empty response. Please try again.", 503, "AI_EMPTY_RESPONSE");
    }
    return res.json({ text });
  } catch (error: any) {
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/timetable", checkGeminiKey, async (req, res) => {
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
      model: "gemini-3.5-flash",
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

app.post("/api/gemini/notes", checkGeminiKey, async (req, res) => {
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
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts }]
    }, req); // Pass req to automatically inject language instructions

    res.json({ notes: response.text });
  } catch (error: any) {
    console.warn("Notes generation failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/solve-homework", checkGeminiKey, async (req, res) => {
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
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts }]
    }, req);

    res.json({ solution: response.text });
  } catch (error: any) {
    console.warn("Homework Solver failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/mnemonic", checkGeminiKey, async (req, res) => {
  const { topic } = req.body;
  try {
    const prompt = `Act as a memory expert. Create 3 unique, catchy, and highly effective mnemonics (acronyms or creative sentences) to help a student memorize the following topic: "${topic}". 
    Format the output as a simple list, one mnemonic per line. Do not include extra text or explanations.`;

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, { 
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    const lines = response.text?.split('\n').filter(l => l.trim().length > 0).slice(0, 3) || [];
    res.json({ mnemonics: lines });
  } catch (error: any) {
    console.warn("Mnemonic generation failed:", error?.message || error);
    return sendAiError(req, res, error);
  }
});

app.post("/api/gemini/flashcards", checkGeminiKey, async (req, res) => {
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
      model: "gemini-3.5-flash",
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

app.post("/api/gemini/roadmap", checkGeminiKey, async (req, res) => {
  const { topic } = req.body;
  try {
    const prompt = `Act as an expert curriculum designer. Create a structured learning roadmap for a student to master "${topic}". 
    The roadmap should have 5-6 logical stages.`;

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, { 
      model: "gemini-3.5-flash",
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

app.post("/api/gemini/quiz", checkGeminiKey, async (req, res) => {
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
      model: "gemini-3.5-flash",
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

app.post("/api/gemini/quick-quiz", checkGeminiKey, async (req, res) => {
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
      model: "gemini-3.5-flash",
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

app.post("/api/gemini/editor-assist", checkGeminiKey, async (req, res) => {
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
      model: "gemini-3.5-flash",
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
