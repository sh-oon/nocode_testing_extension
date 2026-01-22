import type { HTTPRequest, HTTPResponse, Page } from 'puppeteer';
import type { ApiObserver, ApiRequestData, ApiResponseData, ObservedApiCall } from '../types';

/**
 * Create an API observer that tracks network requests and responses
 */
export function createApiObserver(page: Page): ApiObserver {
  const calls: ObservedApiCall[] = [];
  const pendingRequests = new Map<string, ObservedApiCall>();
  let isObserving = false;

  const handleRequest = (request: HTTPRequest) => {
    // Only track API requests (XHR/Fetch)
    const resourceType = request.resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      return;
    }

    const requestData: ApiRequestData = {
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      postData: request.postData(),
      timestamp: Date.now(),
    };

    const call: ObservedApiCall = { request: requestData };
    pendingRequests.set(request.url() + request.method(), call);
  };

  const handleResponse = async (response: HTTPResponse) => {
    const request = response.request();
    const resourceType = request.resourceType();
    if (resourceType !== 'xhr' && resourceType !== 'fetch') {
      return;
    }

    const key = request.url() + request.method();
    const call = pendingRequests.get(key);

    if (call) {
      const startTime = call.request.timestamp;

      let body: unknown;
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          body = await response.json();
        } else {
          body = await response.text();
        }
      } catch {
        // Ignore body parsing errors
      }

      const responseData: ApiResponseData = {
        url: response.url(),
        status: response.status(),
        headers: response.headers(),
        body,
        responseTime: Date.now() - startTime,
        timestamp: Date.now(),
      };

      call.response = responseData;
      calls.push(call);
      pendingRequests.delete(key);
    }
  };

  return {
    start() {
      if (isObserving) return;
      isObserving = true;
      page.on('request', handleRequest);
      page.on('response', handleResponse);
    },

    stop() {
      if (!isObserving) return [];
      isObserving = false;
      page.off('request', handleRequest);
      page.off('response', handleResponse);

      // Return collected calls
      const result = [...calls];
      return result;
    },

    findMatching(urlPattern: string, method?: string) {
      const isRegex = urlPattern.startsWith('/') && urlPattern.endsWith('/');
      const pattern = isRegex ? new RegExp(urlPattern.slice(1, -1)) : null;

      return calls.filter((call) => {
        const urlMatch = pattern
          ? pattern.test(call.request.url)
          : call.request.url.includes(urlPattern);

        const methodMatch = !method || call.request.method === method;

        return urlMatch && methodMatch;
      });
    },

    async waitFor(urlPattern: string, method?: string, timeout = 30000) {
      const startTime = Date.now();
      const isRegex = urlPattern.startsWith('/') && urlPattern.endsWith('/');
      const pattern = isRegex ? new RegExp(urlPattern.slice(1, -1)) : null;

      return new Promise<ObservedApiCall>((resolve, reject) => {
        const checkInterval = setInterval(() => {
          // Check if we've exceeded timeout
          if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            reject(new Error(`Timeout waiting for API call: ${method ?? 'ANY'} ${urlPattern}`));
            return;
          }

          // Check for matching call
          const match = calls.find((call) => {
            const urlMatch = pattern
              ? pattern.test(call.request.url)
              : call.request.url.includes(urlPattern);

            const methodMatch = !method || call.request.method === method;

            return urlMatch && methodMatch && call.response;
          });

          if (match) {
            clearInterval(checkInterval);
            resolve(match);
          }
        }, 100);
      });
    },

    clear() {
      calls.length = 0;
      pendingRequests.clear();
    },
  };
}
