/**
 * Custom fetch wrapper to secure Gemini requests and allow key/url overrides in preview environments safely.
 */

export interface RequestLog {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  duration: number;
  error?: string;
}

export function addRequestLog(log: Omit<RequestLog, "id" | "timestamp">): void {
  // Disable logging of internal traffic in production mode
  if (import.meta.env.PROD) {
    return;
  }
  try {
    const logsKey = "TEEN_GENIUS_REQUEST_LOGS";
    const existing = JSON.parse(localStorage.getItem(logsKey) || "[]");
    const newLog: RequestLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      ...log
    };
    const updated = [newLog, ...existing].slice(0, 40);
    localStorage.setItem(logsKey, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("teen_genius_log_updated"));
  } catch (err) {
    console.error("Failed to save request log:", err);
  }
}

export function getApiUrl(urlPath: string): string {
  // If it's already an absolute URL, leave it be
  if (typeof urlPath === "string" && (urlPath.startsWith("http://") || urlPath.startsWith("https://"))) {
    return urlPath;
  }

  // Check if a custom backend URL was configured in localStorage (development diagnostic helper)
  let customUrl = "";
  if (!import.meta.env.PROD) {
    customUrl = (localStorage.getItem("TEEN_GENIUS_BACKEND_URL") || "").trim();
  }
  
  if (!customUrl) {
    // Check other environment variables
    customUrl = ((import.meta.env.VITE_API_PROXY_URL as string) || (import.meta.env.VITE_API_BASE_URL as string) || (import.meta.env.VITE_API_URL as string) || "").trim();
  }

  if (customUrl.includes("VITE_API_URL=")) {
    customUrl = customUrl.replace(/VITE_API_URL\s*=\s*/g, "");
  }
  customUrl = customUrl.replace(/^['"]|['"]$/g, "").trim().replace(/\/$/, "");

  if (customUrl === "undefined" || customUrl === "null") {
    customUrl = "";
  }

  // If there's a custom URL configured, and it is a valid absolute URL, we use it
  if (customUrl && (customUrl.startsWith("http://") || customUrl.startsWith("https://"))) {
    try {
      // If we are in a browser, and the custom URL matches our current origin, we don't need to make it absolute.
      // This helps bypass sandboxed iframe restrictions.
      if (typeof window !== "undefined" && window.location) {
        const baseOrigin = new URL(customUrl).origin;
        const currentOrigin = window.location.origin;
        if (baseOrigin === currentOrigin) {
          // It's the same origin, safe to return relative to prevent sandbox iframe blocks
          return urlPath;
        }
      }
      return `${customUrl}${urlPath}`;
    } catch (e) {
      // Fallback
    }
  }

  // Check if running inside standard Capacitor / native container
  const isCapacitor = typeof window !== "undefined" && (
    window.location.protocol === "capacitor:" ||
    window.location.origin.startsWith("capacitor://") ||
    (window as any).Capacitor !== undefined
  );

  if (isCapacitor) {
    const origin = (typeof window !== "undefined" && window.location) ? window.location.origin : "";
    return `${origin}${urlPath}`;
  }

  // In traditional browser environments, keep it relative to current host
  // This guarantees 100% immunity from CORS and iframe sandboxing "Failed to fetch" errors.
  return urlPath;
}

export async function safeFetch(input: RequestInfo | URL, init?: RequestInit & { timeout?: number }): Promise<Response> {
  const startTime = Date.now();
  const finalInit = init ? { ...init } : {};
  let targetInput = input;
  let targetUrl = typeof input === "string" ? input : (input instanceof URL ? input.pathname : (input as Request).url);
  
  if (typeof input === "string") {
    targetInput = getApiUrl(input);
  } else if (input instanceof URL) {
    targetInput = getApiUrl(input.pathname + input.search + input.hash);
  } else if (input instanceof Request) {
    const resolvedUrl = getApiUrl(input.url);
    targetInput = new Request(resolvedUrl, input);
  }

  // Inject user custom key and model overrides if set under Secret Developer Console
  const customKey = localStorage.getItem("TEEN_GENIUS_GEMINI_KEY");
  const customModel = localStorage.getItem("TEEN_GENIUS_GEMINI_MODEL");

  if (!finalInit.headers) {
    finalInit.headers = {};
  }

  if (customKey) {
    (finalInit.headers as any)["x-gemini-key"] = customKey;
  }
  if (customModel) {
    (finalInit.headers as any)["x-gemini-model"] = customModel;
  }

  const activeLang = localStorage.getItem("TEEN_GENIUS_LANGUAGE") || "auto";
  (finalInit.headers as any)["x-language-setting"] = activeLang;

  const method = finalInit.method || "GET";

  // Abort Controller Setup for request timeout
  const timeoutMs = finalInit.timeout !== undefined ? finalInit.timeout : 60000; // default 60 seconds
  const controller = new AbortController();
  const signal = controller.signal;
  
  // If user passed a signal, register listener to abort
  if (finalInit.signal) {
    finalInit.signal.addEventListener('abort', () => controller.abort());
  }
  finalInit.signal = signal;

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(targetInput, finalInit);
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    
    // Log response
    addRequestLog({
      method,
      url: targetUrl,
      status: response.status,
      duration
    });

    return response;
  } catch (error: any) {
    // If the target input was absolute and failed (e.g. DNS failure, offline endpoint, incorrect proxy config),
    // we fallback instantly to the relative endpoint on the browser's current host to ensure high-density offline/sandbox connectivity.
    if (typeof input === "string" && input.startsWith("/") && targetInput !== input) {
      console.warn(`[safeFetch] Absolute primary connection failed (${error?.message || error}). Retrying with relative fallback: ${input}`);
      try {
        const fallbackResponse = await fetch(input, finalInit);
        clearTimeout(timeoutId);
        addRequestLog({
          method,
          url: targetUrl,
          status: fallbackResponse.status,
          duration: Date.now() - startTime
        });
        return fallbackResponse;
      } catch (retryError: any) {
        console.error("[safeFetch] Both absolute and relative connection methods failed:", retryError);
      }
    }

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    let errorStr = error?.message || String(error);
    
    if (error.name === 'AbortError') {
      errorStr = `Request timed out after ${timeoutMs}ms`;
    }
    
    // Track last error globally
    localStorage.setItem("TEEN_GENIUS_LAST_ERROR", errorStr);
    
    // Log error
    addRequestLog({
      method,
      url: targetUrl,
      status: 0,
      duration,
      error: errorStr
    });
    
    throw new Error(errorStr);
  }
}


