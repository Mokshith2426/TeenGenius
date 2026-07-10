import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
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
import {
  getGroqApiKey,
  getGroqModel,
  isGroqConfigured,
  generateGroqText,
  normalizeHistoryForGroq,
  buildSystemInstruction,
  getLanguageInstruction,
  classifyGroqError,
  logProviderEvent,
  logProviderDiagnostic,
  checkGroqHealth,
  type ProviderErrorCode,
} from "./ai-provider";

// NOTE: Environment variables are loaded by server.ts (`import "dotenv/config"`)
// BEFORE this module is dynamically imported, and by the hosting platform in
// serverless deployments (Netlify). This module never calls dotenv itself, so
// there is exactly one deterministic env-loading mechanism and no duplicate logs.

// Helper to clean and validate API Keys (stripping quotes, etc.)
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

// --- DETERMINISTIC PRODUCTION CONFIGURATION ---
const AI_REQUEST_TIMEOUT_MS = 30000;

// Note: Server-side in-flight deduplication was removed (commit 8082d70 audit).
// Frontend duplicate-submit protection (isLoading guard + requestBurstGuard middleware)
// already prevents duplicate requests. Server-side deduplication created a critical
// concurrency bug where different anonymous users shared the same Promise and
// Express response object, causing requests to hang or return wrong responses.

// Student-facing copy for the in-memory burst guard (see requestBurstGuard).
const AI_CLIENT_THROTTLED_MESSAGE =
  "You're sending requests too quickly. Please wait a moment and try again.";

// ============================================================================
// GROQ-BASED TEXT GENERATION (PRIMARY PATH FOR EXPO)
// ============================================================================

interface GenerateTextParams {
  messages: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  includePlatformKnowledge?: boolean;
  responseMimeType?: string;
  responseSchema?: any;
}

/**
 * Generate text using Groq (primary provider for expo).
 * This replaces Gemini for all text-only endpoints.
 */
async function generateTextWithGroq(params: GenerateTextParams, req: any): Promise<string> {
  const startedAt = Date.now();
  const endpoint = req?.path || req?.originalUrl || "gemini";
  
  // Normalize history
  const messages = normalizeHistoryForGroq(params.messages);
  
  // Build system instruction
  const systemInstruction = params.systemInstruction || buildSystemInstruction(params.includePlatformKnowledge || false);
  
  // Add language instruction
  const langInstruct = getLanguageInstruction(req);
  const fullSystemInstruction = (systemInstruction || "") + langInstruct;
  
  // Prepend system message
  const groqMessages: any[] = [
    { role: "system", content: fullSystemInstruction },
    ...messages,
  ];
  
  try {
    const text = await generateGroqText({
      messages: groqMessages,
      temperature: params.temperature ?? 0.7,
      maxTokens: params.maxOutputTokens ?? 2048,
      endpoint,
      req,
    });
    
    const durationMs = Date.now() - startedAt;
    logProviderEvent({ endpoint, model: getGroqModel(), category: "ok", status: 200, durationMs });
    
    return text;
  } catch (error: any) {
    const durationMs = Date.now() - startedAt;
    const classification = classifyGroqError(error, endpoint);
    
    logProviderEvent({ 
      endpoint, 
      model: getGroqModel(), 
      category: classification.error.code, 
      status: classification.error.status, 
      durationMs,
      message: error?.message 
    });
    
    logProviderDiagnostic({
      ...classification.diagnostics,
      durationMs,
    });
    
    throw error;
  }
}

// ============================================================================
// GEMINI-BASED GENERATION (RETAINED FOR MULTIMODAL)
// ============================================================================

// One lazy server-side Gemini client. Cached and reused; rebuilt only if the
// resolved key changes (e.g. env updated between requests).
let geminiClient: any = null;
let geminiClientKey: string | null = null;

// Single server-side Gemini client factory used by multimodal AI endpoints.
function getGoogleGenAI(req?: any): any {
  const key = getGeminiApiKey();
  if (!key) {
    const err: any = new Error("AI service is not configured.");
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }
  if (!geminiClient || geminiClientKey !== key) {
    // Dynamic import to avoid loading Gemini SDK when using Groq
    const { GoogleGenAI } = require("@google/genai");
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
    geminiClientKey = key;
  }
  if (req) (geminiClient as any).req = req;
  return geminiClient;
}

// Standardized error carrying an HTTP status + machine-readable code.
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

// Deterministic production generation for Gemini (multimodal only).
async function generateContentWithRetry(aiClient: any, params: any, req?: any): Promise<any> {
  const cleanConfig = params.config ? { ...params.config } : {};
  if (cleanConfig.thinkingConfig) {
    delete cleanConfig.thinkingConfig;
  }

  const requestObj = req || (aiClient as any).req;
  const langInstruct = requestObj ? getLanguageInstruction(requestObj) : "";
  const basePersona = (params.includePlatformKnowledge ? buildSystemInstruction(true) : buildSystemInstruction(false)) + langInstruct;
  
  if (cleanConfig.systemInstruction) {
    const kb = params.includePlatformKnowledge ? `\n\n${buildSystemInstruction(true)}` : "";
    cleanConfig.systemInstruction = `${cleanConfig.systemInstruction}${kb}${langInstruct}` as string;
  } else {
    cleanConfig.systemInstruction = basePersona as string;
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
      const durationMs = Date.now() - startedAt;
      const classification = categorizeGeminiError(error);
      logAiEvent({ endpoint, model, category: classification.code, status: classification.status, durationMs, message: error?.message || String(error) });
      logGeminiDiagnostic(endpoint, model, durationMs, classification);

      const canTryFallback = classification.fallbackEligible && i < models.length - 1;
      if (!canTryFallback) break;
    }
  }

  const classification = categorizeGeminiError(lastError);
  const errorCode: GeminiErrorCode = classification.code as GeminiErrorCode;
  throw new GeminiError(classification.message, classification.status, errorCode, {
    retryAfterSeconds: classification.retryAfterSeconds,
    diagnostics: classification.diagnostics,
  });
}

// Convert any thrown error into the standardized JSON error contract: { error, code }.
function sendAiError(req: any, res: any, error: any) {
  const startedAt = req?._aiStartedAt || Date.now();
  const durationMs = Date.now() - startedAt;
  const endpoint = req?.path || req?.originalUrl || "gemini";

  let status: number;
  let code: string;
  let message: string;
  let retryAfterSeconds: number | undefined;

  if (error instanceof GeminiError) {
    status = error.status;
    code = error.code as string;
    message = error.message;
    retryAfterSeconds = error.retryAfterSeconds;
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
    code = cat.code as string;
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

// Middleware: require a valid server-side AI key
const checkAiKey = (req: any, res: any, next: any) => {
  req._aiStartedAt = Date.now();
  
  // For Groq endpoints, check Groq configuration
  if (req.path?.startsWith("/api/gemini/") && !req.path?.includes("diagnose")) {
    if (!isGroqConfigured() && !isGeminiConfigured()) {
      return res.status(500).json({ error: publicMessageFor("AI_NOT_CONFIGURED"), code: "AI_NOT_CONFIGURED" });
    }
  }
  
  next();
};

// --- LIGHTWEIGHT IN-MEMORY BURST GUARD ---
const BURST_WINDOW_MS = 1500;
const burstGuardHits = new Map<string, number>();
let lastBurstSweep = Date.now();

function clientBurstKey(req: any): string {
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
    groqApiKeyPresent: isGroqConfigured(),
  });
});

// AI Health Check — reports provider status
app.get("/api/health/ai", async (req, res) => {
  const groqConfigured = isGroqConfigured();
  const geminiConfigured = isGeminiConfigured();
  
  if (!groqConfigured && !geminiConfigured) {
    return res.json({
      status: "error",
      configured: false,
      provider: "groq",
      reachable: false,
      code: "AI_NOT_CONFIGURED"
    });
  }
  
  // If Groq is configured, check its health
  if (groqConfigured) {
    const health = await checkGroqHealth();
    return res.json({
      status: health.reachable ? "ok" : "error",
      configured: true,
      provider: "groq",
      reachable: health.reachable,
      model: health.model || undefined,
      ...(health.error && { code: health.error })
    });
  }
  
  // Fallback to Gemini info if Groq not configured
  res.json({
    status: "ok",
    configured: true,
    provider: "gemini",
    reachable: true,
    model: PRIMARY_MODEL,
  });
});

// Gemini Diagnostics Route (preserved for multimodal/debugging)
app.get("/api/gemini/diagnose", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Access Denied: Diagnostics only available in development mode" });
  }
  const key = getGeminiApiKey();

  if (!key) {
    return res.json({
      success: false,
      apiKeyPresent: false,
      error: "No valid GEMINI_API_KEY or GOOGLE_API_KEY is configured on the server."
    });
  }

  try {
    const testAi = getGoogleGenAI();

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

// ============================================================================
// TEXT-ONLY ENDPOINTS (MIGRATED TO GROQ)
// ============================================================================

// AI Tutor Chat — uses Groq
app.post("/api/gemini/chat", checkAiKey, requestBurstGuard, async (req, res) => {
  try {
    const { message, history, image } = req.body;

    // If image is present, this is multimodal — use Gemini
    if (image) {
      console.log("[AI] Chat with image detected, routing to Gemini (multimodal)");
      return handleGeminiChat(req, res, { message, history, image });
    }

    // Text-only chat — use Groq
    const messages: any[] = [];
    
    // Add history
    if (history && Array.isArray(history)) {
      for (const h of history) {
        if (h.role === "user") {
          messages.push({ role: "user", content: h.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || h.content || "" });
        } else if (h.role === "model" || h.role === "assistant") {
          messages.push({ role: "assistant", content: h.parts?.map((p: any) => p.text).filter(Boolean).join("\n") || h.content || "" });
        }
      }
    }
    
    // Add current message
    messages.push({ role: "user", content: message });

    const text = await generateTextWithGroq(
      {
        messages,
        includePlatformKnowledge: true,
      },
      req
    );

    res.json({ text });
  } catch (error: any) {
    return sendGroqError(req, res, error);
  }
});

// Timetable Maker — uses Groq
app.post("/api/gemini/timetable", checkAiKey, requestBurstGuard, async (req, res) => {
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

Duration context for selection: Category is "${durationCategoryStr}" (value: "${durationValueStr}").`;

    if (durationCategoryStr === 'quick') {
      prompt += ` Generate a plan for a single quick study session. Divide the planned time (${durationValueStr.replace('_', ' ')}) into sequential chronological blocks as keys: e.g. "0 to 10 Mins (Warmup)", etc. Define realistic tasks for this short session.`;
    } else if (durationCategoryStr === 'daily') {
      prompt += ` Generate a high-productivity plan for ${durationValueStr === 'tomorrow' ? 'Tomorrow' : 'Today'} only. Divide the schedule into blocks as keys: e.g., "Morning Slot", "Afternoon Slot", "Evening Slot".`;
    } else if (durationCategoryStr === 'multiday') {
      prompt += ` Generate a robust short-term study timetable for ${durationValueStr.replace('_', ' ')}. Organize study sessions chronologically for each day with keys like Day 1, Day 2, etc.`;
    } else if (durationCategoryStr === 'weekly') {
      if (durationValueStr === '2_weeks') {
        prompt += ` Generate a balanced revision roadmap across a 2-week timeline. Organize into two structural milestones as keys: "Week 1 (Days 1-7)" and "Week 2 (Days 8-14)".`;
      } else {
        prompt += ` Generate a standard weekly timetable with the days of the week as keys. Ensure Monday to Sunday are comprehensive.`;
      }
    } else if (durationCategoryStr === 'longterm') {
      prompt += ` Generate an ambitious, highly strategic long-term study calendar for ${durationValueStr.replace('_', ' ')}. To keep it realistic, actionable, and visually balanced, divide this long journey into 4 strategic phases as keys: "Phase 1: Foundation (Conceptual Review)", "Phase 2: Practice (Problem Solving & Retrieval)", "Phase 3: Integration (Full Mock Tests & Weak Areas)", and "Phase 4: Revision (Deep Mindmap & High Speed Recall)". Describe exactly what they should study in each phase.`;
    }

    // Dynamic schema generator
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

    let generatedText: string;
    try {
      generatedText = await generateTextWithGroq(
        {
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
        req
      );
    } catch (error: any) {
      console.warn("Timetable generation failed:", error?.message || error);
      return sendGroqError(req, res, error);
    }

    try {
      let cleanedText = generatedText || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      const parsedData = JSON.parse(cleanedText);
      res.json(parsedData);
    } catch (parseError) {
      console.error("Timetable JSON Parse Error:", parseError, generatedText);
      throw parseError;
    }
  } catch (error: any) {
    console.warn("Timetable generation failed:", error?.message || error);
    return sendGroqError(req, res, error);
  }
});

// Notes Generator — uses Groq
app.post("/api/gemini/notes", checkAiKey, requestBurstGuard, async (req, res) => {
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
    
    const formattedPrompt = `You are TeenGenius AI, a rigorous academic tutor for students.

Create structured study notes aligned with CBSE/NCERT and standard secondary-school curricula.

PARAMETERS:
- Note Style: "${noteStyle || 'Short Notes'}"
- Summary Length: "${summaryLength || 'Standard'}"
- Focus Area: "${focus || 'General Comprehensive Study Guidance'}"
- Subject: "${subject || 'Auto-Detect'}"

LANGUAGE POLICY:
1. Automatically detect the input language.
2. By default, generate notes in ENGLISH.
3. If the input is in another language, translate/explain it into clear English.
4. For language arts (e.g., Telugu literature, Hindi grammar), preserve the original language when translation would diminish learning.

NOTE STRUCTURE:
1. Clear headings and subheadings.
2. Concise explanations of concepts.
3. Key terms and definitions.
4. Important points and takeaways.
5. Relevant formulas in LaTeX ($...$ or $$...$$) where applicable.
6. Examples where useful.

STYLE GUIDANCE:
${stylePrompt}

Input Content:
"${content || '(See attached file attachments for primary input material)'}"`;

    const notesText = await generateTextWithGroq(
      {
        messages: [{ role: "user", content: formattedPrompt }],
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      req
    );

    res.json({ notes: notesText });
  } catch (error: any) {
    console.warn("Notes generation failed:", error?.message || error);
    return sendGroqError(req, res, error);
  }
});

// Homework Solver — uses Groq for text-only, Gemini for images
app.post("/api/gemini/solve-homework", checkAiKey, requestBurstGuard, async (req, res) => {
  const { question, subject, image } = req.body;
  try {
    
    // If image is present, use Gemini (multimodal)
    if (image) {
      console.log("[AI] Homework with image detected, routing to Gemini (multimodal)");
      return handleGeminiHomework(req, res, { question, subject, image });
    }
    
    const prompt = `You are the ultimate TeenGenius AI Homework Solver. 
    Analyze the following academic task and perform high-precision solution.

    AUTOMATIC DETECTION REQUIREMENTS:
    1. SUBJECT DETECTION: Automatically analyze the question content to identify the precise academic subject.
    2. CHAPTER AND QUESTION TYPE: Pinpoint and state the exact chapter context, academic grade level, and specific question structure.
    3. CURRICULUM ALIGNMENT: Align the pedagogy and terminology with the NCERT syllabus framework or standard global secondary boards.

    Question or Context: "${question || 'Solve the problem.'}".
    Detected Temporary Category Indicator: ${subject || 'Auto-Detect'}.
    
    LANGUAGE POLICY:
    1. Automatically detect the language of the user's input.
    2. By default, generate all solution steps and answers in ENGLISH.
    3. If the input/source material is in another language, parse and understand the content, and translate/explain it into clear, easy-to-read English.
    4. However, if the query represents language-specific arts learning where translation to English would dilute the educational criteria, preserve the original target language. Otherwise, always produce outputs in English.
    
    Generate an extremely detailed, high-yield educational response with the following strictly defined sections:
    1. **Subject, Chapter & Question Type**: List the auto-detected subject, chapter, and question type, and mention curriculum alignment.
    2. **Prerequisite Theories & Concepts**: State the foundational theories, theorems, laws, or formulas required to solve this.
    3. **Step-by-Step Explanation**: Detailed logical derivation steps with crisp subheadings. Break down complex parts. Show neat mathematical calculations, scientific equations, and programming flowcharts/explanations.
    4. **Final Answer & Summary**: State the absolute final conclusion, result, or answer. Display it in an elegant, beautifully framed format.
    5. **Understanding Checklist**: Clear key insights and potential traps to avoid for this concept.
    6. **Exam-Focused Prep Tip**: Practical tips on how central/international boards award step-by-step marks for this exact type of problem.

    You MUST write natural, grammatically perfect, and technically precise academic terminology. Preserve all formatting, structures, and math equations ($...$ or $$...$$).`;

    const solutionText = await generateTextWithGroq(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxOutputTokens: 4096,
      },
      req
    );

    res.json({ solution: solutionText });
  } catch (error: any) {
    console.warn("Homework Solver failed:", error?.message || error);
    return sendGroqError(req, res, error);
  }
});

// Mnemonic Generator — uses Groq
app.post("/api/gemini/mnemonic", checkAiKey, requestBurstGuard, async (req, res) => {
  const { topic } = req.body;
  try {
    const prompt = `Act as a memory expert. Create 3 unique, catchy, and highly effective mnemonics (acronyms or creative sentences) to help a student memorize the following topic: "${topic}". 
    Format the output as a simple list, one mnemonic per line. Do not include extra text or explanations.`;

    const mnemonicText = await generateTextWithGroq(
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        maxOutputTokens: 512,
      },
      req
    );

    const lines = mnemonicText?.split('\n').filter(l => l.trim().length > 0).slice(0, 3) || [];
    res.json({ mnemonics: lines });
  } catch (error: any) {
    console.warn("Mnemonic generation failed:", error?.message || error);
    return sendGroqError(req, res, error);
  }
});

// Flashcards Generator — uses Groq
app.post("/api/gemini/flashcards", checkAiKey, requestBurstGuard, async (req, res) => {
  const { topic, notesContent } = req.body;
  try {
    
    let prompt = "";
    if (notesContent && notesContent.trim()) {
      prompt = `Act as a study expert. Create exactly 5 challenging and informative flashcards (Question and Answer) for learning and memorization based on the following notes / materials: "${notesContent}". Make them highly specific to the facts, key terms, and summaries provided in the notes.`;
    } else {
      prompt = `Act as a study expert. Create exactly 5 challenging and informative flashcards (Question and Answer) for the following topic: "${topic}".`;
    }

    let flashcardsText: string;
    try {
      flashcardsText = await generateTextWithGroq(
        {
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
        req
      );
    } catch (error: any) {
      console.warn("Flashcards generation failed:", error?.message || error);
      return sendGroqError(req, res, error);
    }

    try {
      let cleanedText = flashcardsText || "[]";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      const flashcards = JSON.parse(cleanedText);
      res.json({ flashcards });
    } catch (e) {
      console.error("JSON Parse Error:", e, flashcardsText);
      throw e;
    }
  } catch (error: any) {
    console.warn("Flashcards generation failed:", error?.message || error);
    return sendGroqError(req, res, error);
  }
});

// Roadmap Generator — uses Groq
app.post("/api/gemini/roadmap", checkAiKey, requestBurstGuard, async (req, res) => {
  const { topic } = req.body;
  try {
    const prompt = `Act as an expert curriculum designer. Create a structured learning roadmap for a student to master "${topic}". 
    The roadmap should have 5-6 logical stages.`;

    let roadmapText: string;
    try {
      roadmapText = await generateTextWithGroq(
        {
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
        req
      );
    } catch (error: any) {
      console.warn("Roadmap generation failed:", error?.message || error);
      return sendGroqError(req, res, error);
    }

    try {
      let cleanedText = roadmapText || "[]";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      const roadmap = JSON.parse(cleanedText);
      res.json({ roadmap });
    } catch (e) {
      console.error("Roadmap Parse Error:", e, roadmapText);
      throw e;
    }
  } catch (error: any) {
    console.warn("Roadmap generation failed:", error?.message || error);
    return sendGroqError(req, res, error);
  }
});

// Quiz Generator — uses Groq
app.post("/api/gemini/quiz", checkAiKey, requestBurstGuard, async (req, res) => {
  const { topic } = req.body;
  try {
    if (!topic || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const prompt = `Act as an expert tutor and assessment designer.
    Create a highly informative, educational, and challenging exactly 5-question multiple choice quiz on the topic: "${topic}".
    Ensure options are plausible but have one distinctly correct answer. Explain the concepts clearly in the explanations.`;

    let quizText: string;
    try {
      quizText = await generateTextWithGroq(
        {
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
        req
      );
    } catch (error: any) {
      console.warn("Quiz generation failed:", error?.message || error);
      return sendGroqError(req, res, error);
    }

    try {
      let cleanedText = quizText || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      const quiz = JSON.parse(cleanedText);
      res.json({ quiz });
    } catch (e) {
      console.error("Quiz Parse Error:", e, quizText);
      throw e;
    }
  } catch (error: any) {
    console.warn("Quiz generation failed:", error?.message || error);
    return sendGroqError(req, res, error);
  }
});

// Quick Quiz — uses Groq
app.post("/api/gemini/quick-quiz", checkAiKey, requestBurstGuard, async (req, res) => {
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

    let quickQuizText: string;
    try {
      quickQuizText = await generateTextWithGroq(
        {
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
        req
      );
    } catch (error: any) {
      console.warn("Quick Quiz generation failed:", error?.message || error);
      return sendGroqError(req, res, error);
    }

    try {
      let cleanedText = quickQuizText || "{}";
      cleanedText = cleanedText.replace(/```json|```/g, "").trim();
      const quiz = JSON.parse(cleanedText);
      res.json({ quiz });
    } catch (e) {
      console.error("Quick quiz json parse error:", e, quickQuizText);
      throw e;
    }
  } catch (error: any) {
    console.warn("Quick Quiz generation failed:", error?.message || error);
    return sendGroqError(req, res, error);
  }
});

// Editor Assist — uses Groq
app.post("/api/gemini/editor-assist", checkAiKey, requestBurstGuard, async (req, res) => {
  const { text, language, action } = req.body;
  try {
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }
    const prompt = action === 'refactor' 
      ? `Act as an expert software engineer and editor. Refactor or format and optimize the following ${language || 'plain text'} snippet for pristine logic, absolute correctness, clean styling, and professional presentation. Output only the refactored text under a clean format, followed by brief bullet-point notes of what you corrected or refined.`
      : `Act as an expert academic writer and developer. Analyze the following incomplete ${language || 'plain text'} piece, and write a high-craft complete continuation/logical extension to it. Keep it elegant, relevant, and fully educational.`;
    
    const result = await generateTextWithGroq(
      {
        messages: [{ role: "user", content: prompt + `\n\nSnippet:\n${text}` }],
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      req
    );
    res.json({ result });
  } catch (error: any) {
    console.warn("Editor assist failed:", error?.message || error);
    return sendGroqError(req, res, error);
  }
});

// ============================================================================
// MULTIMODAL ENDPOINTS (RETAINED WITH GEMINI)
// ============================================================================

// Transcription — multimodal, uses Gemini
app.post("/api/gemini/transcribe", checkAiKey, requestBurstGuard, async (req, res) => {
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

// ============================================================================
// HELPER FUNCTIONS FOR GEMINI MULTIMODAL
// ============================================================================

async function handleGeminiChat(req: any, res: any, params: { message: string; history: any[]; image: any }) {
  try {
    const { message, history, image } = params;

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

    const aiClient = getGoogleGenAI(req);
    const response = await generateContentWithRetry(aiClient, {
      contents: consolidatedContents,
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
}

async function handleGeminiHomework(req: any, res: any, params: { question: string; subject: string; image: any }) {
  try {
    const { question, subject, image } = params;
    
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
    
    const prompt = `You are the ultimate TeenGenius AI Homework Solver. 
    Analyze the following academic task, image document, or homework problem and perform high-precision OCR extraction first if necessary.

    AUTOMATIC DETECTION REQUIREMENTS:
    1. SUBJECT DETECTION: Automatically analyze the question content, formulas, or image text to identify the precise academic subject.
    2. CHAPTER AND QUESTION TYPE: Pinpoint and state the exact chapter context, academic grade level, and specific question structure.
    3. CURRICULUM ALIGNMENT: Align the pedagogy and terminology with the NCERT syllabus framework or standard global secondary boards.

    Question or Context: "${question || 'Solve the attached image/question.'}".
    Detected Temporary Category Indicator: ${subject || 'Auto-Detect'}.
    
    LANGUAGE POLICY:
    1. Automatically detect the language of the user's input.
    2. By default, generate all solution steps and answers in ENGLISH.
    3. If the input/source material is in another language, parse and understand the content, and translate/explain it into clear, easy-to-read English.
    4. However, if the query represents language-specific arts learning where translation to English would dilute the educational criteria, preserve the original target language. Otherwise, always produce outputs in English.
    
    Generate an extremely detailed, high-yield educational response with the following strictly defined sections:
    1. **Subject, Chapter & Question Type**: List the auto-detected subject, chapter, and question type, and mention curriculum alignment.
    2. **Prerequisite Theories & Concepts**: State the foundational theories, theorems, laws, or formulas required to solve this.
    3. **Step-by-Step Explanation**: Detailed logical derivation steps with crisp subheadings. Break down complex parts. Show neat mathematical calculations, scientific equations, and programming flowcharts/explanations.
    4. **Final Answer & Summary**: State the absolute final conclusion, result, or answer. Display it in an elegant, beautifully framed format.
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
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

function sendGroqError(req: any, res: any, error: any) {
  const startedAt = req?._aiStartedAt || Date.now();
  const durationMs = Date.now() - startedAt;
  const endpoint = req?.path || req?.originalUrl || "gemini";

  let status: number;
  let code: string;
  let message: string;
  let retryAfterSeconds: number | undefined;

  // Check if it's already a classified Groq error
  if (error.code && typeof error.code === "string" && error.code.startsWith("AI_")) {
    status = error.status || 503;
    code = error.code;
    message = error.message || "An error occurred.";
    retryAfterSeconds = error.retryAfterSeconds;
  } else {
    // Classify the error
    const classification = classifyGroqError(error, endpoint);
    status = classification.error.status;
    code = classification.error.code;
    message = classification.error.message;
    retryAfterSeconds = classification.error.retryAfterSeconds;
    
    logProviderDiagnostic({
      ...classification.diagnostics,
      durationMs,
    });
  }

  logProviderEvent({ endpoint, model: getGroqModel(), category: code, status, durationMs, message: error?.message });
  
  if (res.headersSent) return;
  if (retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(retryAfterSeconds));
  }
  return res.status(status).json({ error: message, code });
}

// Structured, key-safe audit log line for every AI request outcome.
function logAiEvent(fields: { endpoint: string; model?: string; category: string; status?: number; durationMs: number; message?: string }) {
  const parts = [
    `[AI]`,
    `provider=groq`,
    `endpoint=${fields.endpoint}`,
    `model=${fields.model || "-"}`,
    `category=${fields.category}`,
    fields.status !== undefined ? `status=${fields.status}` : "",
    `durationMs=${fields.durationMs}`,
    fields.message ? `message="${sanitizeErrorLog(fields.message)}"` : "",
  ].filter(Boolean);
  console.log(parts.join(" "));
}

// Structured, key-safe audit log line for Gemini requests.
function logGeminiDiagnostic(
  endpoint: string,
  model: string | undefined,
  durationMs: number,
  classification: ReturnType<typeof categorizeGeminiError>
) {
  const payload = buildDiagnosticLogPayload({ endpoint, model, durationMs, classification });
  console.log(`[AI_DIAGNOSTIC] ${JSON.stringify(payload)}`);
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
    return "API quota/rate limit reached (429).";
  }
  return errorStr.replace(/AIza[0-9A-Za-z\-_]{10,}/g, "[REDACTED_KEY]");
}

// Feedback endpoint (non-AI)
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