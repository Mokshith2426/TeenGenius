/**
 * Retry utility for AI requests with exponential backoff
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 2,
  initialDelayMs: 1000,
  maxDelayMs: 8000,
  shouldRetry: (error: any) => {
    // Don't retry on client errors (4xx) except rate limits (429)
    const status = error?.status || error?.httpStatus;
    if (status && status >= 400 && status < 500 && status !== 429) {
      return false;
    }
    return true;
  }
};

/**
 * Execute an async operation with retry logic and exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries!; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Check if we should retry this error
      if (!opts.shouldRetry!(error)) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === opts.maxRetries!) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delayMs = Math.min(
        opts.initialDelayMs! * Math.pow(2, attempt),
        opts.maxDelayMs!
      );

      console.warn(
        `[Retry] ${operationName} attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`,
        error?.message
      );

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Wrapper for safeFetch with automatic retry
 */
export async function safeFetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit & { timeout?: number; retries?: number }
): Promise<Response> {
  const { safeFetch } = await import('./api');
  
  return withRetry(
    () => safeFetch(input, init),
    `Fetch: ${input.toString()}`,
    {
      maxRetries: init?.retries || 2,
      shouldRetry: (error: any) => {
        // Don't retry on 4xx errors except 429
        const status = error?.status || error?.httpStatus;
        if (status && status >= 400 && status < 500 && status !== 429) {
          return false;
        }
        return true;
      }
    }
  );
}
