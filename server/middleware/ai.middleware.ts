/**
 * AI Middleware - Reusable middleware for AI endpoints
 * 
 * Middleware functions for validation, authentication, rate limiting, etc.
 */

import { Request, Response, NextFunction } from 'express';
import { isGroqConfigured } from '../../ai-provider';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthenticatedRequest extends Request {
  _aiStartedAt?: number;
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Validate request input size to prevent DoS attacks
 */
export const validateInput = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const { body } = req;
  
  // Check for excessively large inputs (prevent DoS)
  // Increased to 5MB to support file uploads with proper multipart handling
  const bodyString = JSON.stringify(body);
  if (bodyString.length > 5 * 1024 * 1024) { // 5MB limit
    res.status(413).json({ error: "Request payload too large. Maximum size is 5MB.", code: "PAYLOAD_TOO_LARGE" });
    return;
  }
  
  next();
};

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Require a valid server-side AI key
 */
export const checkAiKey = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  req._aiStartedAt = Date.now();
  
  if (!isGroqConfigured()) {
    res.status(500).json({ error: "AI service is not configured.", code: "AI_NOT_CONFIGURED" });
    return;
  }
  
  next();
};

// ============================================================================
// RATE LIMITING MIDDLEWARE
// ============================================================================

// Student-facing copy for the in-memory burst guard
const AI_CLIENT_THROTTLED_MESSAGE =
  "You're sending requests too quickly. Please wait a moment and try again.";

// --- LIGHTWEIGHT IN-MEMORY BURST GUARD ---
const BURST_WINDOW_MS = 1500;
const burstGuardHits = new Map<string, number>();
let lastBurstSweep = Date.now();

function clientBurstKey(req: AuthenticatedRequest): string {
  const ip =
    (req.headers?.["x-nf-client-connection-ip"] as string) ||
    (typeof req.headers?.["x-forwarded-for"] === "string"
      ? (req.headers["x-forwarded-for"] as string).split(",")[0].trim()
      : "") ||
    req.ip ||
    req.connection?.remoteAddress ||
    "unknown";
  const endpoint = req.path || req.originalUrl || "api";
  return `${ip}::${endpoint}`;
}

/**
 * Prevent rapid duplicate requests from the same client
 */
export const requestBurstGuard = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({ error: AI_CLIENT_THROTTLED_MESSAGE, code: "AI_CLIENT_THROTTLED" });
    return;
  }
  burstGuardHits.set(key, now);
  next();
};

// ============================================================================
// ERROR HANDLING MIDDLEWARE
// ============================================================================

/**
 * Centralized error handler for AI endpoints
 */
export const aiErrorHandler = (
  error: any,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const startedAt = req._aiStartedAt || Date.now();
  const durationMs = Date.now() - startedAt;
  const endpoint = req?.path || req?.originalUrl || "api";

  let status: number;
  let code: string;
  let message: string;
  let retryAfterSeconds: number | undefined;

  // Check if it's already a classified AI error
  if (error.code && typeof error.code === "string" && error.code.startsWith("AI_")) {
    status = error.status || 503;
    code = error.code;
    message = error.message || "An error occurred.";
    retryAfterSeconds = error.retryAfterSeconds;
  } else {
    // Generic error
    status = 500;
    code = "AI_REQUEST_FAILED";
    message = error?.message || "An unexpected error occurred.";
  }

  if (res.headersSent) return;
  if (retryAfterSeconds !== undefined) {
    res.setHeader("Retry-After", String(retryAfterSeconds));
  }
  res.status(status).json({ error: message, code });
};