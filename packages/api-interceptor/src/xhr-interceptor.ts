import { generateRequestId } from './serializer';
import type {
  ApiInterceptorConfig,
  CapturedApiCall,
  CapturedRequest,
  CapturedResponse,
  RequestState,
  SerializedHeaders,
} from './types';
import { DEFAULT_CONFIG } from './types';

/**
 * Extended XMLHttpRequest with tracking properties
 */
interface TrackedXHR extends XMLHttpRequest {
  __interceptor_id?: string;
  __interceptor_url?: string;
  __interceptor_method?: string;
  __interceptor_headers?: SerializedHeaders;
  __interceptor_startTime?: number;
  __interceptor_body?: unknown;
}

/**
 * State for tracking in-flight XHR requests
 */
const pendingRequests = new Map<string, RequestState>();
const completedCalls: CapturedApiCall[] = [];

/** Original XHR methods */
let originalOpen: typeof XMLHttpRequest.prototype.open | null = null;
let originalSend: typeof XMLHttpRequest.prototype.send | null = null;
let originalSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader | null = null;

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
 * Parse XHR response based on responseType
 */
function parseXhrResponse(xhr: XMLHttpRequest): unknown {
  try {
    const maxSize = currentConfig.maxBodySize ?? DEFAULT_CONFIG.maxBodySize;

    switch (xhr.responseType) {
      case 'json':
        return xhr.response;

      case 'text':
      case '': {
        const text = xhr.responseText;
        if (maxSize && text.length > maxSize) {
          return `[Body too large: ${text.length} bytes]`;
        }
        // Try to parse as JSON if it looks like JSON
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        }
        return text;
      }

      case 'arraybuffer': {
        const buffer = xhr.response as ArrayBuffer;
        if (maxSize && buffer.byteLength > maxSize) {
          return `[Body too large: ${buffer.byteLength} bytes]`;
        }
        return `[ArrayBuffer: ${buffer.byteLength} bytes]`;
      }

      case 'blob': {
        const blob = xhr.response as Blob;
        if (maxSize && blob.size > maxSize) {
          return `[Body too large: ${blob.size} bytes]`;
        }
        return `[Blob: ${blob.size} bytes, type: ${blob.type}]`;
      }

      case 'document':
        return '[XML/HTML Document]';

      default:
        return xhr.response;
    }
  } catch (error) {
    return `[Error reading response: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Parse response headers from getAllResponseHeaders() string
 */
function parseResponseHeaders(headersString: string): SerializedHeaders {
  const headers: SerializedHeaders = {};
  const lines = headersString.trim().split(/\r?\n/);

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      headers[key] = value;
    }
  }

  return headers;
}

/**
 * Intercepted open method
 */
function interceptedOpen(
  this: TrackedXHR,
  method: string,
  url: string | URL,
  async = true,
  username?: string | null,
  password?: string | null
): void {
  const urlString = url instanceof URL ? url.href : url;

  // Store request info on the XHR instance
  this.__interceptor_url = urlString;
  this.__interceptor_method = method.toUpperCase();
  this.__interceptor_headers = {};
  this.__interceptor_id = generateRequestId();

  // Call original open
  originalOpen?.call(this, method, url, async, username, password);
}

/**
 * Intercepted setRequestHeader method
 */
function interceptedSetRequestHeader(this: TrackedXHR, name: string, value: string): void {
  // Store header
  if (this.__interceptor_headers) {
    this.__interceptor_headers[name.toLowerCase()] = value;
  }

  // Call original setRequestHeader
  originalSetRequestHeader?.call(this, name, value);
}

/**
 * Intercepted send method
 */
function interceptedSend(this: TrackedXHR, body?: Document | XMLHttpRequestBodyInit | null): void {
  const url = this.__interceptor_url ?? '';
  const method = this.__interceptor_method ?? 'GET';
  const requestId = this.__interceptor_id ?? generateRequestId();

  // Skip if shouldn't capture
  if (!shouldCapture(url, method)) {
    originalSend?.call(this, body);
    return;
  }

  const startTime = Date.now();
  this.__interceptor_startTime = startTime;

  // Build captured request
  const capturedRequest: CapturedRequest = {
    id: requestId,
    url,
    method,
    headers: this.__interceptor_headers ?? {},
    timestamp: startTime,
    initiator: 'xhr',
  };

  // Capture request body if configured
  if (currentConfig.captureRequestBody !== false && body !== null && body !== undefined) {
    const contentType = this.__interceptor_headers?.['content-type'];
    // parseBody is async, but we can't await here, so we handle it synchronously for simple cases
    if (typeof body === 'string') {
      if (
        contentType?.includes('application/json') ||
        body.trim().startsWith('{') ||
        body.trim().startsWith('[')
      ) {
        try {
          capturedRequest.body = JSON.parse(body);
        } catch {
          capturedRequest.body = body;
        }
      } else {
        capturedRequest.body = body;
      }
    } else if (body instanceof FormData) {
      const formObj: Record<string, unknown> = {};
      body.forEach((value, key) => {
        if (value instanceof File) {
          formObj[key] = { type: 'File', name: value.name, size: value.size };
        } else {
          formObj[key] = value;
        }
      });
      capturedRequest.body = formObj;
    } else if (body instanceof URLSearchParams) {
      capturedRequest.body = Object.fromEntries(body.entries());
    } else if (body instanceof Blob) {
      capturedRequest.body = `[Blob: ${body.size} bytes]`;
    } else if (body instanceof ArrayBuffer) {
      capturedRequest.body = `[ArrayBuffer: ${body.byteLength} bytes]`;
    }

    this.__interceptor_body = capturedRequest.body;
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

  // Add load/error listeners
  const handleLoadEnd = () => {
    const responseTime = Date.now() - startTime;
    const state = pendingRequests.get(requestId);

    if (!state) {
      return;
    }

    const { apiCall } = state;

    // Build captured response
    const capturedResponse: CapturedResponse = {
      status: this.status,
      statusText: this.statusText,
      headers: parseResponseHeaders(this.getAllResponseHeaders()),
      responseTime,
    };

    // Capture response body if configured
    if (currentConfig.captureResponseBody !== false) {
      capturedResponse.body = parseXhrResponse(this);
    }

    // Get body size from content-length header
    const contentLength = this.getResponseHeader('content-length');
    if (contentLength) {
      capturedResponse.bodySize = Number.parseInt(contentLength, 10);
    }

    // Update API call record
    apiCall.response = capturedResponse;
    apiCall.pending = false;

    // Check for errors (status 0 typically means network error)
    if (this.status === 0) {
      apiCall.error = 'Network Error';
      currentConfig.onError?.(apiCall);
    } else {
      currentConfig.onResponse?.(apiCall);
    }

    // Move from pending to completed
    pendingRequests.delete(requestId);
    completedCalls.push(apiCall);

    // Clean up listener
    this.removeEventListener('loadend', handleLoadEnd);
  };

  const handleError = () => {
    const responseTime = Date.now() - startTime;
    const state = pendingRequests.get(requestId);

    if (!state) {
      return;
    }

    const { apiCall } = state;

    // Update API call with error
    apiCall.error = 'Network Error';
    apiCall.pending = false;
    apiCall.response = {
      status: 0,
      statusText: 'Network Error',
      headers: {},
      responseTime,
    };

    // Notify error
    currentConfig.onError?.(apiCall);

    // Move from pending to completed
    pendingRequests.delete(requestId);
    completedCalls.push(apiCall);

    // Clean up listeners
    this.removeEventListener('loadend', handleLoadEnd);
    this.removeEventListener('error', handleError);
  };

  this.addEventListener('loadend', handleLoadEnd);
  this.addEventListener('error', handleError);

  // Call original send
  originalSend?.call(this, body);
}

/**
 * Start intercepting XHR requests
 */
export function startXhrInterceptor(config: ApiInterceptorConfig = {}): void {
  if (isActive) {
    return;
  }

  currentConfig = { ...DEFAULT_CONFIG, ...config };

  // Store original methods
  if (!originalOpen) {
    originalOpen = XMLHttpRequest.prototype.open;
  }
  if (!originalSend) {
    originalSend = XMLHttpRequest.prototype.send;
  }
  if (!originalSetRequestHeader) {
    originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  }

  // Replace with intercepted versions
  XMLHttpRequest.prototype.open = interceptedOpen;
  XMLHttpRequest.prototype.send = interceptedSend;
  XMLHttpRequest.prototype.setRequestHeader = interceptedSetRequestHeader;

  isActive = true;
}

/**
 * Stop intercepting and restore original XHR methods
 */
export function stopXhrInterceptor(): void {
  if (!isActive) {
    return;
  }

  if (originalOpen) {
    XMLHttpRequest.prototype.open = originalOpen;
  }
  if (originalSend) {
    XMLHttpRequest.prototype.send = originalSend;
  }
  if (originalSetRequestHeader) {
    XMLHttpRequest.prototype.setRequestHeader = originalSetRequestHeader;
  }

  isActive = false;
}

/**
 * Get all captured XHR calls
 */
export function getXhrCalls(): CapturedApiCall[] {
  return [...completedCalls];
}

/**
 * Get pending XHR calls
 */
export function getPendingXhrCalls(): CapturedApiCall[] {
  return Array.from(pendingRequests.values()).map((state) => state.apiCall);
}

/**
 * Clear captured XHR calls
 */
export function clearXhrCalls(): void {
  completedCalls.length = 0;
  pendingRequests.clear();
}

/**
 * Check if XHR interceptor is active
 */
export function isXhrInterceptorActive(): boolean {
  return isActive;
}

/**
 * Update XHR interceptor configuration
 */
export function updateXhrInterceptorConfig(config: Partial<ApiInterceptorConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}
