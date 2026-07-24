/**
 * Server Configuration Constants
 * 
 * Centralized configuration for the backend server.
 */

// ============================================================================
// SERVER CONFIGURATION
// ============================================================================

export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
} as const;

// ============================================================================
// AI CONFIGURATION
// ============================================================================

export const AI_CONFIG = {
  REQUEST_TIMEOUT_MS: 30000,
  MAX_OUTPUT_TOKENS: 4096,
  DEFAULT_TEMPERATURE: 0.7,
  BURST_WINDOW_MS: 1500,
  MAX_PAYLOAD_SIZE: 50000, // 50KB
} as const;

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

export const UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  UPLOADS_DIR: 'uploads',
} as const;

// ============================================================================
// CORS CONFIGURATION
// ============================================================================

export const CORS_CONFIG = {
  development: ['*'] as string[],
  production: [
    'https://teengenius.netlify.app',
    'https://teengenius.com',
    'capacitor://localhost',
    'ionic://localhost'
  ] as string[],
};

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  AI_NOT_CONFIGURED: 'AI service is not configured.',
  PAYLOAD_TOO_LARGE: 'Request payload too large',
  INVALID_INPUT: 'Invalid input provided',
  FILE_TOO_LARGE: 'File too large. Please select a file under 10MB.',
  NO_FILE_UPLOADED: 'No file uploaded',
} as const;