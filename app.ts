import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import compression from "compression";
import { logAiStartupStatus } from "./env";
import { AIService } from './server/services/ai.service';
import { aiErrorHandler } from './server/middleware/ai.middleware';
import { cleanAndValidateKey } from './server/utils/helpers';
import { SERVER_CONFIG, AI_CONFIG, UPLOAD_CONFIG, CORS_CONFIG, ERROR_MESSAGES } from './server/config/constants';
import aiRoutes from './server/routes/ai.routes';

// Initialize AI service
const aiService = AIService.getInstance();

const app = express();
app.use(compression());

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

const ALLOWED_ORIGINS = process.env.NODE_ENV === "production"
  ? CORS_CONFIG.production
  : CORS_CONFIG.development;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.some(o => o === origin);

  if (allowedOrigin && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, x-language-setting, X-Language-Setting");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});

// ============================================================================
// BODY PARSING
// ============================================================================

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ limit: '15mb', extended: true }));

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

const uploadsDir = path.join(process.cwd(), UPLOAD_CONFIG.UPLOADS_DIR);
const isServerless = !!(process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT);

if (!isServerless && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = isServerless
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, UPLOAD_CONFIG.UPLOADS_DIR + "/");
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_CONFIG.MAX_FILE_SIZE }
});

// ============================================================================
// AI ROUTES
// ============================================================================

app.use('/api/ai', aiRoutes);

// AI error handler (must be after routes)
app.use(aiErrorHandler);

// ============================================================================
// FILE UPLOAD ENDPOINT
// ============================================================================

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: ERROR_MESSAGES.NO_FILE_UPLOADED });
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

// ============================================================================
// STARTUP VALIDATION ROUTE
// ============================================================================

app.get("/api/startup-check", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Access Denied: Diagnostics only available in development mode" });
  }
  res.json({
    groqApiKeyPresent: aiService.isConfigured(),
  });
});

// ============================================================================
// AI HEALTH CHECK
// ============================================================================

app.get("/api/health/ai", async (req, res) => {
  try {
    const health = await aiService.healthCheck();
    return res.json({
      status: health.reachable ? "ok" : "error",
      configured: aiService.isConfigured(),
      provider: "groq",
      reachable: health.reachable,
      model: health.model || undefined,
      ...(health.error && { code: health.error })
    });
  } catch (error: any) {
    return res.json({
      status: "error",
      configured: false,
      provider: "groq",
      reachable: false,
      code: "AI_HEALTH_CHECK_FAILED",
      error: error.message
    });
  }
});

// ============================================================================
// FEEDBACK ENDPOINT (NON-AI)
// ============================================================================

app.post("/api/feedback", async (req, res) => {
  try {
    const { feedbackType, rating, message, name, email } = req.body;

    console.log(`[FEEDBACK RECEIVED]
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

// ============================================================================
// CACHE INVALIDATION AND VERSION TRACKING
// ============================================================================

const LOCAL_PROCESS_ID = "v_local_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
const SERVER_BOOT_ID = process.env.DEPLOY_ID || process.env.COMMIT_REF || process.env.APP_VERSION || LOCAL_PROCESS_ID;

app.get("/api/version", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json({ version: SERVER_BOOT_ID });
});

// ============================================================================
// EXPORT
// ============================================================================

export { app, uploadsDir };