/**
 * Server Utility Functions
 *
 * Reusable helper functions for the backend.
 */

import { Request, Response } from 'express';
import { sanitizeProviderError } from '../../ai-provider';

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Log AI request/response events
 */
export function logAiRequest(
  endpoint: string,
  model?: string,
  category: string = 'ok',
  status?: number,
  durationMs: number = 0,
  message?: string
): void {
  const parts = [
    `[AI]`,
    `provider=groq`,
    `endpoint=${endpoint}`,
    `model=${model || '-'}`,
    `category=${category}`,
    status !== undefined ? `status=${status}` : '',
    `durationMs=${durationMs}`,
    message ? `message="${sanitizeProviderError(message)}"` : '',
  ].filter(Boolean);

  console.log(parts.join(' '));
}

/**
 * Send standardized error response
 */
export function sendErrorResponse(
  res: Response,
  status: number,
  errorMessage: string,
  code: string,
  retryAfterSeconds?: number
): void {
  if (res.headersSent) return;

  if (retryAfterSeconds !== undefined) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
  }

  res.status(status).json({ error: errorMessage, code });
}

/**
 * Clean and validate API keys
 */
export function cleanAndValidateKey(key: any): string | null {
  if (!key || typeof key !== 'string') return null;

  const cleaned = key.trim().replace(/[\r\n]/g, '').replace(/^["']+|["']+$/g, '');

  if (
    cleaned === '' ||
    cleaned === 'null' ||
    cleaned === 'undefined' ||
    cleaned === 'none' ||
    cleaned === 'MISSING' ||
    cleaned.includes('YOUR_API_KEY') ||
    cleaned.length < 20
  ) {
    return null;
  }

  return cleaned;
}

// ============================================================================
// RESPONSE UTILITIES
// ============================================================================

/**
 * Send success JSON response
 */
export function sendSuccess<T>(res: Response, data: T, status: number = 200): void {
  res.status(status).json(data);
}

/**
 * Parse JSON body safely
 */
export async function parseJsonBody(req: Request): Promise<any> {
  try {
    return await req.body;
  } catch {
    return null;
  }
}