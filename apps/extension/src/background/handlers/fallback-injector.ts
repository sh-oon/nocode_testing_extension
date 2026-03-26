/**
 * Fallback injector — dynamically injects API/navigation interceptors
 * into the main world via chrome.scripting.executeScript when CDP is unavailable.
 *
 * Unlike the previous approach (static <script> tags at document_start),
 * this only injects when recording is actively started, and uses the
 * CSP-safe chrome.scripting API.
 */

// === Injected Functions ===
// These run in the MAIN world. They must be self-contained (no closures over module scope).

/**
 * API interceptor function to be injected into main world.
 * Same logic as the former inject-api.js, but as a callable function.
 */
function apiInterceptorMain(): void {
  // biome-ignore lint: main world injection needs dynamic window access
  const w = window as unknown as Record<string, unknown>;
  if (w.__like_cake_api_injected__) return;
  w.__like_cake_api_injected__ = true;

  const apiCallBuffer: Array<Record<string, unknown>> = [];
  const MAX_BUFFER_SIZE = 100;
  let isRecording = true; // Starts immediately since we only inject during recording

  const generateId = (): string =>
    `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const dispatchApiEvent = (apiCall: Record<string, unknown>): void => {
    window.dispatchEvent(
      new CustomEvent('__like_cake_api_call__', { detail: apiCall }),
    );
  };

  const serializeHeaders = (headers: unknown): Record<string, string> => {
    const result: Record<string, string> = {};
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key.toLowerCase()] = value;
      });
    } else if (headers && typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers as Record<string, string>)) {
        result[key.toLowerCase()] = String(value);
      }
    }
    return result;
  };

  const shouldIgnore = (url: string): boolean => {
    const ignorePatterns = [
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
    return ignorePatterns.some((pattern) => pattern.test(url));
  };

  const handleApiCall = (apiCall: Record<string, unknown>): void => {
    if (isRecording) {
      dispatchApiEvent(apiCall);
    } else {
      apiCallBuffer.push(apiCall);
      if (apiCallBuffer.length > MAX_BUFFER_SIZE) {
        apiCallBuffer.shift();
      }
    }
  };

  // Patch fetch
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = typeof input === 'string' ? input : (input as Request).url;
    if (shouldIgnore(url)) return originalFetch(input, init);

    const requestId = generateId();
    const method = (init.method || 'GET').toUpperCase();
    const requestHeaders = serializeHeaders(
      init.headers || (input instanceof Request ? input.headers : {}),
    );

    const apiCall: Record<string, unknown> = {
      request: {
        id: requestId,
        url: new URL(url, window.location.href).href,
        method,
        headers: requestHeaders,
        timestamp: Date.now(),
      },
      response: null,
      error: null,
    };

    try {
      const response = await originalFetch(input, init);
      const clonedResponse = response.clone();
      let responseBody: unknown;

      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          responseBody = await clonedResponse.json();
        } else if (contentType.includes('text/')) {
          const text = await clonedResponse.text();
          responseBody = text.substring(0, 10000);
        }
      } catch {
        // Body parsing failed
      }

      apiCall.response = {
        status: response.status,
        statusText: response.statusText,
        headers: serializeHeaders(response.headers),
        body: responseBody,
        timestamp: Date.now(),
      };

      handleApiCall(apiCall);
      return response;
    } catch (error) {
      apiCall.error = (error as Error).message || String(error);
      handleApiCall(apiCall);
      throw error;
    }
  };

  // Patch XMLHttpRequest
  const OriginalXHR = window.XMLHttpRequest;
  const PatchedXHR = function (this: XMLHttpRequest): XMLHttpRequest {
    const xhr = new OriginalXHR();
    const requestId = generateId();
    let method = 'GET';
    let url = '';
    const requestHeaders: Record<string, string> = {};

    const originalOpen = xhr.open.bind(xhr);
    xhr.open = (m: string, u: string, ...args: unknown[]): void => {
      method = (m || 'GET').toUpperCase();
      url = u;
      (originalOpen as Function)(m, u, ...args);
    };

    const originalSetHeader = xhr.setRequestHeader.bind(xhr);
    xhr.setRequestHeader = (name: string, value: string): void => {
      requestHeaders[name.toLowerCase()] = value;
      originalSetHeader(name, value);
    };

    const originalSend = xhr.send.bind(xhr);
    xhr.send = (body?: Document | XMLHttpRequestBodyInit | null): void => {
      if (shouldIgnore(url)) {
        originalSend(body);
        return;
      }

      const apiCall: Record<string, unknown> = {
        request: {
          id: requestId,
          url: new URL(url, window.location.href).href,
          method,
          headers: requestHeaders,
          body: typeof body === 'string' ? body : undefined,
          timestamp: Date.now(),
        },
        response: null,
        error: null,
      };

      xhr.addEventListener('load', () => {
        let responseBody: unknown;
        try {
          const contentType = xhr.getResponseHeader('content-type') || '';
          if (contentType.includes('application/json')) {
            responseBody = JSON.parse(xhr.responseText);
          } else if (contentType.includes('text/')) {
            responseBody = xhr.responseText.substring(0, 10000);
          }
        } catch {
          // Parsing failed
        }

        apiCall.response = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: {},
          body: responseBody,
          timestamp: Date.now(),
        };

        handleApiCall(apiCall);
      });

      xhr.addEventListener('error', () => {
        apiCall.error = 'Network error';
        handleApiCall(apiCall);
      });

      originalSend(body);
    };

    return xhr;
  } as unknown as typeof XMLHttpRequest;

  // Copy static properties and prototype chain
  const PatchedXHRAny = PatchedXHR as unknown as Record<string, unknown>;
  PatchedXHRAny.UNSENT = 0;
  PatchedXHRAny.OPENED = 1;
  PatchedXHRAny.HEADERS_RECEIVED = 2;
  PatchedXHRAny.LOADING = 3;
  PatchedXHRAny.DONE = 4;
  PatchedXHRAny.prototype = OriginalXHR.prototype;
  (PatchedXHRAny.prototype as Record<string, unknown>).constructor = PatchedXHR;
  window.XMLHttpRequest = PatchedXHR;

  // Listen for recording state changes from content script
  window.addEventListener('__like_cake_stop_recording__', () => {
    isRecording = false;
  });

  console.log('[Like Cake] Fallback API interceptor injected');
}

/**
 * Navigation interceptor function to be injected into main world.
 */
function navigationPatchMain(): void {
  // biome-ignore lint: main world injection needs dynamic window access
  const w = window as unknown as Record<string, unknown>;
  if (w.__like_cake_nav_injected__) return;
  w.__like_cake_nav_injected__ = true;

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  const dispatchNavEvent = (type: string, url: string): void => {
    window.dispatchEvent(
      new CustomEvent('__like_cake_navigation__', { detail: { type, url } }),
    );
  };

  history.pushState = (data: unknown, unused: string, url?: string | URL | null): void => {
    originalPushState(data, unused, url);
    if (url) {
      try {
        dispatchNavEvent('pushState', new URL(url.toString(), window.location.href).href);
      } catch {
        // URL parsing failed
      }
    }
  };

  history.replaceState = (data: unknown, unused: string, url?: string | URL | null): void => {
    originalReplaceState(data, unused, url);
    if (url) {
      try {
        dispatchNavEvent('replaceState', new URL(url.toString(), window.location.href).href);
      } catch {
        // URL parsing failed
      }
    }
  };

  window.addEventListener('popstate', () => {
    dispatchNavEvent('popState', window.location.href);
  });

  window.addEventListener('hashchange', () => {
    dispatchNavEvent('hashChange', window.location.href);
  });

  console.log('[Like Cake] Fallback navigation interceptor injected');
}

// === Public API ===

/**
 * Inject API interceptor into main world via chrome.scripting (CSP-safe).
 * Only call this when CDP is unavailable.
 */
export const injectApiInterceptor = async (tabId: number): Promise<boolean> => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN' as chrome.scripting.ExecutionWorld,
      func: apiInterceptorMain,
    });
    console.log(`[Like Cake] Fallback API interceptor injected into tab ${tabId}`);
    return true;
  } catch (error) {
    console.error('[Like Cake] Fallback API injection failed:', error);
    return false;
  }
};

/**
 * Inject navigation interceptor into main world via chrome.scripting (CSP-safe).
 * Only call this when CDP + webNavigation are insufficient.
 */
export const injectNavigationPatch = async (tabId: number): Promise<boolean> => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN' as chrome.scripting.ExecutionWorld,
      func: navigationPatchMain,
    });
    console.log(`[Like Cake] Fallback navigation patch injected into tab ${tabId}`);
    return true;
  } catch (error) {
    console.error('[Like Cake] Fallback navigation injection failed:', error);
    return false;
  }
};

/**
 * Signal injected scripts to stop recording (via CustomEvent).
 */
export const cleanupInjectedScripts = async (tabId: number): Promise<void> => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN' as chrome.scripting.ExecutionWorld,
      func: () => {
        window.dispatchEvent(new CustomEvent('__like_cake_stop_recording__'));
      },
    });
  } catch {
    // Tab may have been closed
  }
};
