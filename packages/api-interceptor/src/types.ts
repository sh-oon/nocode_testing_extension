/**
 * HTTP methods supported by the interceptor
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Serialized HTTP headers
 */
export type SerializedHeaders = Record<string, string>;

/**
 * Captured API request details
 */
export interface CapturedRequest {
  /** Unique identifier for this request */
  id: string;
  /** Full URL of the request */
  url: string;
  /** HTTP method */
  method: HttpMethod | string;
  /** Request headers */
  headers: SerializedHeaders;
  /** Request body (parsed if JSON, string otherwise) */
  body?: unknown;
  /** Timestamp when request was initiated */
  timestamp: number;
  /** Request initiator type */
  initiator: 'fetch' | 'xhr';
}

/**
 * Captured API response details
 */
export interface CapturedResponse {
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
  /** Response headers */
  headers: SerializedHeaders;
  /** Response body (parsed if JSON, string otherwise) */
  body?: unknown;
  /** Response time in milliseconds */
  responseTime: number;
  /** Response body size in bytes (if available) */
  bodySize?: number;
}

/**
 * Complete captured API call with request and optional response
 */
export interface CapturedApiCall {
  /** Request details */
  request: CapturedRequest;
  /** Response details (undefined if request is still pending or failed) */
  response?: CapturedResponse;
  /** Error message if request failed */
  error?: string;
  /** Whether the request is still pending */
  pending: boolean;
}

/**
 * Filter function to determine if a request should be captured
 */
export type RequestFilter = (url: string, method: string) => boolean;

/**
 * Callback invoked when an API call is captured
 */
export type ApiCallCallback = (apiCall: CapturedApiCall) => void;

/**
 * Configuration for the API interceptor
 */
export interface ApiInterceptorConfig {
  /** Filter to include/exclude requests (default: capture all) */
  filter?: RequestFilter;
  /** Whether to capture request bodies (default: true) */
  captureRequestBody?: boolean;
  /** Whether to capture response bodies (default: true) */
  captureResponseBody?: boolean;
  /** Maximum body size to capture in bytes (default: 1MB) */
  maxBodySize?: number;
  /** URL patterns to ignore (e.g., extension URLs, analytics) */
  ignorePatterns?: (string | RegExp)[];
  /** Callback invoked when a request starts */
  onRequest?: ApiCallCallback;
  /** Callback invoked when a response is received */
  onResponse?: ApiCallCallback;
  /** Callback invoked when a request fails */
  onError?: ApiCallCallback;
}

/**
 * API Interceptor instance
 */
export interface ApiInterceptor {
  /** Start intercepting API calls */
  start(): void;
  /** Stop intercepting and restore original functions */
  stop(): void;
  /** Get all captured API calls */
  getCalls(): CapturedApiCall[];
  /** Get pending (in-flight) API calls */
  getPendingCalls(): CapturedApiCall[];
  /** Clear captured API calls */
  clear(): void;
  /** Check if interceptor is active */
  isActive(): boolean;
  /** Update configuration */
  updateConfig(config: Partial<ApiInterceptorConfig>): void;
}

/**
 * Internal state for tracking requests
 */
export interface RequestState {
  apiCall: CapturedApiCall;
  startTime: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<
  Omit<ApiInterceptorConfig, 'filter' | 'onRequest' | 'onResponse' | 'onError'>
> &
  Pick<ApiInterceptorConfig, 'filter' | 'onRequest' | 'onResponse' | 'onError'> = {
  captureRequestBody: true,
  captureResponseBody: true,
  maxBodySize: 1024 * 1024, // 1MB
  ignorePatterns: [
    // Chrome extension URLs
    /^chrome-extension:\/\//,
    // Common analytics
    /google-analytics\.com/,
    /googletagmanager\.com/,
    /facebook\.com\/tr/,
    /analytics/,
  ],
};
