/**
 * API interceptor - injected into main world at document_start
 * Patches fetch and XMLHttpRequest to capture all API calls
 * Buffers calls until recording starts
 */
(function() {
  // Prevent double injection
  if (window.__like_cake_api_injected__) return;
  window.__like_cake_api_injected__ = true;

  // Buffer for API calls before recording starts
  const apiCallBuffer = [];
  const MAX_BUFFER_SIZE = 100;
  let isRecording = false;

  // Generate unique request ID
  const generateId = () => `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  // Dispatch API call event to content script
  const dispatchApiEvent = (apiCall) => {
    window.dispatchEvent(new CustomEvent('__like_cake_api_call__', {
      detail: apiCall
    }));
  };

  // Serialize headers
  const serializeHeaders = (headers) => {
    const result = {};
    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key.toLowerCase()] = value;
      });
    } else if (headers && typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        result[key.toLowerCase()] = String(value);
      }
    }
    return result;
  };

  // Parse body safely
  const parseBody = async (body, contentType) => {
    if (!body) return undefined;

    try {
      if (typeof body === 'string') {
        if (contentType?.includes('application/json')) {
          return JSON.parse(body);
        }
        return body;
      }
      if (body instanceof FormData) {
        const obj = {};
        body.forEach((value, key) => {
          obj[key] = value instanceof File ? `[File: ${value.name}]` : value;
        });
        return obj;
      }
      if (body instanceof URLSearchParams) {
        return Object.fromEntries(body.entries());
      }
      if (body instanceof ArrayBuffer || body instanceof Blob) {
        return '[Binary Data]';
      }
    } catch (e) {
      return String(body).substring(0, 1000);
    }
    return undefined;
  };

  // Check if URL should be ignored
  const shouldIgnore = (url) => {
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
    return ignorePatterns.some(pattern => pattern.test(url));
  };

  // Handle captured API call
  const handleApiCall = (apiCall) => {
    if (isRecording) {
      dispatchApiEvent(apiCall);
    } else {
      // Buffer for later
      apiCallBuffer.push(apiCall);
      if (apiCallBuffer.length > MAX_BUFFER_SIZE) {
        apiCallBuffer.shift();
      }
    }
  };

  // ============================================
  // Patch fetch
  // ============================================
  const originalFetch = window.fetch.bind(window);

  window.fetch = async function(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;

    if (shouldIgnore(url)) {
      return originalFetch(input, init);
    }

    const requestId = generateId();
    const timestamp = Date.now();
    const method = (init.method || 'GET').toUpperCase();

    // Capture request
    const requestHeaders = serializeHeaders(init.headers || (input instanceof Request ? input.headers : {}));
    let requestBody;
    if (init.body) {
      requestBody = await parseBody(init.body, requestHeaders['content-type']);
    }

    const apiCall = {
      request: {
        id: requestId,
        url: new URL(url, window.location.href).href,
        method,
        headers: requestHeaders,
        body: requestBody,
        timestamp,
      },
      response: null,
      error: null,
    };

    try {
      const response = await originalFetch(input, init);

      // Clone response to read body
      const clonedResponse = response.clone();
      let responseBody;

      try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          responseBody = await clonedResponse.json();
        } else if (contentType.includes('text/')) {
          const text = await clonedResponse.text();
          responseBody = text.substring(0, 10000); // Limit size
        }
      } catch (e) {
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
      apiCall.error = error.message || String(error);
      handleApiCall(apiCall);
      throw error;
    }
  };

  // ============================================
  // Patch XMLHttpRequest
  // ============================================
  const OriginalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const requestId = generateId();
    let method = 'GET';
    let url = '';
    let requestHeaders = {};
    let requestBody;
    const timestamp = Date.now();

    // Intercept open
    const originalOpen = xhr.open.bind(xhr);
    xhr.open = function(m, u, ...args) {
      method = (m || 'GET').toUpperCase();
      url = u;
      return originalOpen(m, u, ...args);
    };

    // Intercept setRequestHeader
    const originalSetHeader = xhr.setRequestHeader.bind(xhr);
    xhr.setRequestHeader = function(name, value) {
      requestHeaders[name.toLowerCase()] = value;
      return originalSetHeader(name, value);
    };

    // Intercept send
    const originalSend = xhr.send.bind(xhr);
    xhr.send = function(body) {
      if (shouldIgnore(url)) {
        return originalSend(body);
      }

      requestBody = body;

      const apiCall = {
        request: {
          id: requestId,
          url: new URL(url, window.location.href).href,
          method,
          headers: requestHeaders,
          body: typeof body === 'string' ? body : undefined,
          timestamp,
        },
        response: null,
        error: null,
      };

      xhr.addEventListener('load', function() {
        let responseBody;
        try {
          const contentType = xhr.getResponseHeader('content-type') || '';
          if (contentType.includes('application/json')) {
            responseBody = JSON.parse(xhr.responseText);
          } else if (contentType.includes('text/')) {
            responseBody = xhr.responseText.substring(0, 10000);
          }
        } catch (e) {
          // Parsing failed
        }

        // Parse response headers
        const responseHeaders = {};
        const headerStr = xhr.getAllResponseHeaders();
        if (headerStr) {
          headerStr.split('\r\n').forEach(line => {
            const [key, ...values] = line.split(': ');
            if (key) {
              responseHeaders[key.toLowerCase()] = values.join(': ');
            }
          });
        }

        apiCall.response = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: responseHeaders,
          body: responseBody,
          timestamp: Date.now(),
        };

        handleApiCall(apiCall);
      });

      xhr.addEventListener('error', function() {
        apiCall.error = 'Network error';
        handleApiCall(apiCall);
      });

      return originalSend(body);
    };

    return xhr;
  };

  // Copy static properties
  Object.keys(OriginalXHR).forEach(key => {
    window.XMLHttpRequest[key] = OriginalXHR[key];
  });
  window.XMLHttpRequest.prototype = OriginalXHR.prototype;

  // ============================================
  // Listen for recording state changes
  // ============================================
  window.addEventListener('__like_cake_start_recording__', function() {
    isRecording = true;

    // Flush buffered calls (only recent ones within 10 seconds)
    const now = Date.now();
    const recentCalls = apiCallBuffer.filter(call =>
      now - call.request.timestamp < 10000
    );

    recentCalls.forEach(call => {
      dispatchApiEvent(call);
    });

    // Clear buffer
    apiCallBuffer.length = 0;

    console.log('[Like Cake] API recording started, flushed', recentCalls.length, 'buffered calls');
  });

  window.addEventListener('__like_cake_stop_recording__', function() {
    isRecording = false;
  });

  console.log('[Like Cake] API interceptor injected into main world');
})();
