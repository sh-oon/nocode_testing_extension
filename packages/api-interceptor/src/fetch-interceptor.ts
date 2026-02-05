import {
  extractMethod,
  extractRequestBody,
  extractUrl,
  generateRequestId,
  mergeHeaders,
  parseResponseBody,
  serializeHeaders,
} from './serializer';
import type {
  ApiInterceptorConfig,
  CapturedApiCall,
  CapturedRequest,
  CapturedResponse,
  RequestState,
} from './types';
import { DEFAULT_CONFIG } from './types';

/**
 * State for tracking in-flight fetch requests
 */
const pendingRequests = new Map<string, RequestState>();
const completedCalls: CapturedApiCall[] = [];

/** Original fetch function */
let originalFetch: typeof window.fetch | null = null;
let isActive = false;
let currentConfig: ApiInterceptorConfig = { ...DEFAULT_CONFIG };

/**
 * Check if URL should be ignored based on config patterns
 */
function shouldIgnoreUrl(url: string): boolean {
  const patterns = currentConfig.ignorePatterns ?? DEFAULT_CONFIG.ignorePatterns ?? [];

  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      if (url.includes(pattern)) {
        return true;
      }
    } else if (pattern instanceof RegExp) {
      if (pattern.test(url)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if request passes the filter
 */
function shouldCapture(url: string, method: string): boolean {
  if (shouldIgnoreUrl(url)) {
    return false;
  }

  if (currentConfig.filter) {
    return currentConfig.filter(url, method);
  }

  return true;
}

/**
 * Patched fetch function that intercepts all requests
 */
async function interceptedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!originalFetch) {
    throw new Error('Fetch interceptor not properly initialized');
  }

  const url = extractUrl(input);
  const method = extractMethod(input, init);

  // Skip if shouldn't capture
  if (!shouldCapture(url, method)) {
    return originalFetch(input, init);
  }

  const requestId = generateRequestId();
  const startTime = Date.now();

  // Build captured request
  const capturedRequest: CapturedRequest = {
    id: requestId,
    url,
    method,
    headers: mergeHeaders(input, init),
    timestamp: startTime,
    initiator: 'fetch',
  };

  // Capture request body if configured
  if (currentConfig.captureRequestBody !== false) {
    try {
      capturedRequest.body = await extractRequestBody(
        input,
        init,
        currentConfig.maxBodySize ?? DEFAULT_CONFIG.maxBodySize
      );
    } catch {
      // Ignore body capture errors
    }
  }

  // Create API call record
  const apiCall: CapturedApiCall = {
    request: capturedRequest,
    pending: true,
  };

  // Track pending request
  pendingRequests.set(requestId, {
    apiCall,
    startTime,
  });

  // Notify request start
  currentConfig.onRequest?.(apiCall);

  try {
    // Execute original fetch
    const response = await originalFetch(input, init);
    const responseTime = Date.now() - startTime;

    // Build captured response
    const capturedResponse: CapturedResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: serializeHeaders(response.headers),
      responseTime,
    };

    // Capture response body if configured
    if (currentConfig.captureResponseBody !== false) {
      try {
        capturedResponse.body = await parseResponseBody(
          response,
          currentConfig.maxBodySize ?? DEFAULT_CONFIG.maxBodySize
        );
      } catch {
        // Ignore body capture errors
      }
    }

    // Get body size from content-length header
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      capturedResponse.bodySize = Number.parseInt(contentLength, 10);
    }

    // Update API call record
    apiCall.response = capturedResponse;
    apiCall.pending = false;

    // Move from pending to completed
    pendingRequests.delete(requestId);
    completedCalls.push(apiCall);

    // Notify response received
    currentConfig.onResponse?.(apiCall);

    // Return original response (need to clone if body was consumed)
    // Since we used clone() in parseResponseBody, the original is intact
    return response;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    // Update API call with error
    apiCall.error = error instanceof Error ? error.message : String(error);
    apiCall.pending = false;
    apiCall.response = {
      status: 0,
      statusText: 'Network Error',
      headers: {},
      responseTime,
    };

    // Move from pending to completed
    pendingRequests.delete(requestId);
    completedCalls.push(apiCall);

    // Notify error
    currentConfig.onError?.(apiCall);

    // Re-throw original error
    throw error;
  }
}

/**
 * Start intercepting fetch requests
 */
export function startFetchInterceptor(config: ApiInterceptorConfig = {}): void {
  if (isActive) {
    return;
  }

  currentConfig = { ...DEFAULT_CONFIG, ...config };

  // Store original fetch
  if (!originalFetch) {
    originalFetch = window.fetch.bind(window);
  }

  // Replace with intercepted version
  window.fetch = interceptedFetch;
  isActive = true;
}

/**
 * Stop intercepting and restore original fetch
 */
export function stopFetchInterceptor(): void {
  if (!isActive || !originalFetch) {
    return;
  }

  window.fetch = originalFetch;
  isActive = false;
}

/**
 * Get all captured fetch calls
 */
export function getFetchCalls(): CapturedApiCall[] {
  return [...completedCalls];
}

/**
 * Get pending fetch calls
 */
export function getPendingFetchCalls(): CapturedApiCall[] {
  return Array.from(pendingRequests.values()).map((state) => state.apiCall);
}

/**
 * Clear captured fetch calls
 */
export function clearFetchCalls(): void {
  completedCalls.length = 0;
  pendingRequests.clear();
}

/**
 * Check if fetch interceptor is active
 */
export function isFetchInterceptorActive(): boolean {
  return isActive;
}

/**
 * Update fetch interceptor configuration
 */
export function updateFetchInterceptorConfig(config: Partial<ApiInterceptorConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}
