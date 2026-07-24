/**
 * Custom fetch wrapper to secure AI requests and allow key/url overrides in preview environments safely.
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
  // Absolute URLs pass through unchanged.
  if (typeof urlPath === "string" && (urlPath.startsWith("http://") || urlPath.startsWith("https://"))) {
    return urlPath;
  }

  // Native Capacitor builds may point at a dedicated backend host. This path is ISOLATED
  // from the web production path: it only activates inside a real native shell AND only when
  // VITE_NATIVE_API_URL is explicitly configured. Web deployments never enter this branch.
  const isCapacitorNative = typeof window !== "undefined" && (
    window.location.protocol === "capacitor:" ||
    (window as any).Capacitor?.isNativePlatform?.() === true
  );
  if (isCapacitorNative) {
    const nativeBackend = ((import.meta.env.VITE_NATIVE_API_URL as string) || "").trim().replace(/\/$/, "");
    if (nativeBackend.startsWith("http://") || nativeBackend.startsWith("https://")) {
      return `${nativeBackend}${urlPath}`;
    }
  }

  // Web production and development: always use the same-origin relative path.
  // This guarantees immunity from CORS and iframe-sandbox "Failed to fetch" errors and
  // removes all ambiguity around VITE_API_URL / proxy resolution.
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

  if (!finalInit.headers) {
    finalInit.headers = {};
  }

  // The AI API key is SERVER-SIDE ONLY. The browser never sends an AI key
  // (no x-ai-key header, no VITE_* var, no localStorage key). Only the UI
  // language preference is forwarded.
  const activeLang = localStorage.getItem("TEEN_GENIUS_LANGUAGE") || "auto";
  (finalInit.headers as any)["x-language-setting"] = activeLang;

  const method = finalInit.method || "GET";

  // Abort Controller Setup for request timeout
  const timeoutMs = finalInit.timeout !== undefined ? finalInit.timeout : 45000; // default 45s for AI text requests
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


