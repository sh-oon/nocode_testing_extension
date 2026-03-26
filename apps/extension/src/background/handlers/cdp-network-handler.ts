/**
 * CDP Network handler — captures API requests/responses via chrome.debugger.
 * Converts CDP Network domain events to CapturedApiCall format
 * used by the rest of the recording pipeline.
 */

import type {
  CapturedApiCall,
  CapturedRequest,
  CapturedResponse,
  SerializedHeaders,
} from '@like-cake/api-interceptor';

// === Types ===

export interface CdpAttachResult {
  readonly success: boolean;
  readonly reason?: 'DEBUGGER_ATTACH_FAILED' | 'ALREADY_ATTACHED' | 'UNKNOWN';
}

interface PendingCdpRequest {
  readonly requestId: string;
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly postData?: string;
  readonly timestamp: number;
  readonly initiatorType: string;
  /** Populated by responseReceived, consumed by loadingFinished */
  responseMetadata?: {
    status: number;
    statusText: string;
    headers: SerializedHeaders;
    mimeType: string;
  };
}

// === State ===

/** tabId → Set of pending requestIds */
const attachedTabs = new Map<number, Map<string, PendingCdpRequest>>();

/** Callback to invoke when an API call is fully captured */
let onApiCallCaptured: ((apiCall: CapturedApiCall) => void) | null = null;

// === URL Filtering (same patterns as api-interceptor defaults) ===

const IGNORE_PATTERNS: readonly RegExp[] = [
  /^chrome-extension:\/\//,
  /google-analytics\.com/,
  /googletagmanager\.com/,
  /facebook\.com\/tr/,
  /analytics/i,
  /tracking/i,
  /beacon/i,
  /__vite_ping/,
  /__webpack_hmr/,
  /hot-update/,
  /\.map$/,
];

const shouldIgnoreUrl = (url: string): boolean =>
  IGNORE_PATTERNS.some((pattern) => pattern.test(url));

// Non-API resource types to skip
const IGNORED_RESOURCE_TYPES = new Set([
  'Document',
  'Stylesheet',
  'Image',
  'Media',
  'Font',
  'Script',
  'Manifest',
  'SignedExchange',
  'Ping',
  'CSPViolationReport',
  'Preflight',
  'Other',
]);

// === CDP Event Handlers ===

// biome-ignore lint: chrome.debugger types use Object
const handleCdpEvent = (
  source: chrome.debugger.Debuggee,
  method: string,
  params?: object,
): void => {
  const typedParams = params as Record<string, unknown> | undefined;
  const tabId = source.tabId;
  if (tabId === undefined || !typedParams) return;

  const pendingRequests = attachedTabs.get(tabId);
  if (!pendingRequests) return;

  switch (method) {
    case 'Network.requestWillBeSent':
      handleRequestWillBeSent(tabId, pendingRequests, typedParams);
      break;
    case 'Network.responseReceived':
      handleResponseReceived(tabId, pendingRequests, typedParams);
      break;
    case 'Network.loadingFinished':
      handleLoadingFinished(tabId, pendingRequests, typedParams);
      break;
    case 'Network.loadingFailed':
      handleLoadingFailed(pendingRequests, typedParams);
      break;
  }
};

const handleRequestWillBeSent = (
  _tabId: number,
  pendingRequests: Map<string, PendingCdpRequest>,
  params: Record<string, unknown>,
): void => {
  const request = params.request as Record<string, unknown> | undefined;
  const requestId = params.requestId as string | undefined;
  const type = params.type as string | undefined;
  const initiator = params.initiator as Record<string, unknown> | undefined;

  if (!request || !requestId) return;

  // Skip non-API resource types
  if (type && IGNORED_RESOURCE_TYPES.has(type)) return;

  const url = request.url as string;
  if (shouldIgnoreUrl(url)) return;

  pendingRequests.set(requestId, {
    requestId,
    url,
    method: (request.method as string) || 'GET',
    headers: flattenHeaders(request.headers as Record<string, string> | undefined),
    postData: request.postData as string | undefined,
    timestamp: Date.now(),
    initiatorType: (initiator?.type as string) || 'other',
  });
};

const handleResponseReceived = (
  _tabId: number,
  pendingRequests: Map<string, PendingCdpRequest>,
  params: Record<string, unknown>,
): void => {
  const requestId = params.requestId as string | undefined;
  const response = params.response as Record<string, unknown> | undefined;

  if (!requestId || !response) return;

  const pending = pendingRequests.get(requestId);
  if (!pending) return;

  // Store response metadata on the pending request for later use
  pending.responseMetadata = {
    status: response.status as number,
    statusText: response.statusText as string,
    headers: flattenHeaders(response.headers as Record<string, string> | undefined),
    mimeType: response.mimeType as string,
  };
};

const handleLoadingFinished = (
  tabId: number,
  pendingRequests: Map<string, PendingCdpRequest>,
  params: Record<string, unknown>,
): void => {
  const requestId = params.requestId as string | undefined;
  if (!requestId) return;

  const pending = pendingRequests.get(requestId);
  if (!pending) return;

  pendingRequests.delete(requestId);

  const responseMetadata = pending.responseMetadata;

  // Attempt to get response body
  getResponseBody(tabId, requestId)
    .then((body) => {
      const capturedRequest = buildCapturedRequest(pending);
      const capturedResponse = buildCapturedResponse(responseMetadata, body, pending.timestamp);

      const apiCall: CapturedApiCall = {
        request: capturedRequest,
        response: capturedResponse,
        pending: false,
      };

      onApiCallCaptured?.(apiCall);
    })
    .catch(() => {
      // Body unavailable — still emit call without body
      const capturedRequest = buildCapturedRequest(pending);
      const capturedResponse = buildCapturedResponse(responseMetadata, null, pending.timestamp);

      const apiCall: CapturedApiCall = {
        request: capturedRequest,
        response: capturedResponse,
        pending: false,
      };

      onApiCallCaptured?.(apiCall);
    });
};

const handleLoadingFailed = (
  pendingRequests: Map<string, PendingCdpRequest>,
  params: Record<string, unknown>,
): void => {
  const requestId = params.requestId as string | undefined;
  const errorText = params.errorText as string | undefined;

  if (!requestId) return;

  const pending = pendingRequests.get(requestId);
  if (!pending) return;

  pendingRequests.delete(requestId);

  const apiCall: CapturedApiCall = {
    request: buildCapturedRequest(pending),
    error: errorText || 'Network error',
    pending: false,
  };

  onApiCallCaptured?.(apiCall);
};

// === Helpers ===

const flattenHeaders = (headers?: Record<string, string>): SerializedHeaders => {
  if (!headers) return {};
  const result: SerializedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = value;
  }
  return result;
};

const buildCapturedRequest = (pending: PendingCdpRequest): CapturedRequest => {
  let body: unknown;
  if (pending.postData) {
    try {
      body = JSON.parse(pending.postData);
    } catch {
      body = pending.postData;
    }
  }

  const initiator: 'fetch' | 'xhr' =
    pending.initiatorType === 'xmlhttprequest' ? 'xhr' : 'fetch';

  return {
    id: pending.requestId,
    url: pending.url,
    method: pending.method,
    headers: pending.headers,
    body,
    timestamp: pending.timestamp,
    initiator,
  };
};

const buildCapturedResponse = (
  metadata: { status: number; statusText: string; headers: SerializedHeaders; mimeType: string } | undefined,
  body: string | null,
  requestTimestamp: number,
): CapturedResponse | undefined => {
  if (!metadata) return undefined;

  let parsedBody: unknown;
  if (body) {
    const contentType = metadata.mimeType || metadata.headers['content-type'] || '';
    if (contentType.includes('json')) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        parsedBody = body;
      }
    } else if (contentType.includes('text')) {
      parsedBody = body.substring(0, 10_000);
    }
  }

  return {
    status: metadata.status,
    statusText: metadata.statusText,
    headers: metadata.headers,
    body: parsedBody,
    responseTime: Date.now() - requestTimestamp,
    bodySize: body ? new Blob([body]).size : undefined,
  };
};

const getResponseBody = async (tabId: number, requestId: string): Promise<string | null> => {
  try {
    const result = await chrome.debugger.sendCommand(
      { tabId },
      'Network.getResponseBody',
      { requestId },
    );
    return (result as { body?: string })?.body ?? null;
  } catch {
    return null;
  }
};

// === CDP Detach Listener ===

/** Called when the user closes the debugger bar or the tab closes */
let onDetachCallback: ((tabId: number) => void) | null = null;

/**
 * Register callback for when CDP is unexpectedly detached (e.g. user closes yellow bar).
 * The recording-handler uses this to auto-switch to fallback mode.
 */
export const setOnDetach = (callback: (tabId: number) => void): void => {
  onDetachCallback = callback;
};

const handleDetach = (source: chrome.debugger.Debuggee, _reason: string): void => {
  const tabId = source.tabId;
  if (tabId !== undefined) {
    const wasTracking = attachedTabs.has(tabId);
    attachedTabs.delete(tabId);

    // Notify recording-handler to switch to fallback mode
    if (wasTracking && onDetachCallback) {
      onDetachCallback(tabId);
    }
  }
};

// === Public API ===

/**
 * Register callback for captured API calls.
 * Must be called before attachToTab.
 */
export const setOnApiCallCaptured = (
  callback: (apiCall: CapturedApiCall) => void,
): void => {
  onApiCallCaptured = callback;
};

/**
 * Attach CDP debugger to a tab and enable Network domain.
 */
export const attachToTab = async (tabId: number): Promise<CdpAttachResult> => {
  if (attachedTabs.has(tabId)) {
    return { success: true, reason: 'ALREADY_ATTACHED' };
  }

  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    await chrome.debugger.sendCommand({ tabId }, 'Network.enable', {});

    attachedTabs.set(tabId, new Map());

    // Register listeners (idempotent — Chrome deduplicates)
    if (!chrome.debugger.onEvent.hasListener(handleCdpEvent)) {
      chrome.debugger.onEvent.addListener(handleCdpEvent);
    }
    if (!chrome.debugger.onDetach.hasListener(handleDetach)) {
      chrome.debugger.onDetach.addListener(handleDetach);
    }

    console.log(`[Like Cake] CDP attached to tab ${tabId}`);
    return { success: true };
  } catch (error) {
    console.error('[Like Cake] CDP attach failed:', error);
    return { success: false, reason: 'DEBUGGER_ATTACH_FAILED' };
  }
};

/**
 * Detach CDP debugger from a tab.
 */
export const detachFromTab = async (tabId: number): Promise<void> => {
  attachedTabs.delete(tabId);

  try {
    await chrome.debugger.detach({ tabId });
    console.log(`[Like Cake] CDP detached from tab ${tabId}`);
  } catch {
    // Already detached
  }
};

/**
 * Check if CDP is attached to a tab.
 */
export const isAttached = (tabId: number): boolean => attachedTabs.has(tabId);

/**
 * Detach all CDP connections (for service worker restart cleanup).
 */
export const detachAll = async (): Promise<void> => {
  const tabIds = [...attachedTabs.keys()];
  attachedTabs.clear();

  for (const tabId of tabIds) {
    try {
      await chrome.debugger.detach({ tabId });
    } catch {
      // Already detached
    }
  }
};
