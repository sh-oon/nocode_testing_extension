/**
 * @like-cake/api-interceptor
 *
 * Fetch and XHR interceptor for capturing API requests and responses
 * during E2E test recording.
 */

export {
  clearFetchCalls,
  getFetchCalls,
  getPendingFetchCalls,
  isFetchInterceptorActive,
  startFetchInterceptor,
  stopFetchInterceptor,
  updateFetchInterceptorConfig,
} from './fetch-interceptor';
export {
  extractMethod,
  extractUrl,
  generateRequestId,
  parseBody,
  parseResponseBody,
  serializeHeaders,
} from './serializer';
export * from './types';
export {
  clearXhrCalls,
  getPendingXhrCalls,
  getXhrCalls,
  isXhrInterceptorActive,
  startXhrInterceptor,
  stopXhrInterceptor,
  updateXhrInterceptorConfig,
} from './xhr-interceptor';

import {
  clearFetchCalls,
  getFetchCalls,
  getPendingFetchCalls,
  isFetchInterceptorActive,
  startFetchInterceptor,
  stopFetchInterceptor,
  updateFetchInterceptorConfig,
} from './fetch-interceptor';
import type { ApiInterceptor, ApiInterceptorConfig, CapturedApiCall } from './types';
import {
  clearXhrCalls,
  getPendingXhrCalls,
  getXhrCalls,
  isXhrInterceptorActive,
  startXhrInterceptor,
  stopXhrInterceptor,
  updateXhrInterceptorConfig,
} from './xhr-interceptor';

/**
 * Create a unified API interceptor that intercepts both fetch and XHR
 */
export function createApiInterceptor(config: ApiInterceptorConfig = {}): ApiInterceptor {
  let isRunning = false;

  return {
    start(): void {
      if (isRunning) {
        return;
      }
      startFetchInterceptor(config);
      startXhrInterceptor(config);
      isRunning = true;
    },

    stop(): void {
      if (!isRunning) {
        return;
      }
      stopFetchInterceptor();
      stopXhrInterceptor();
      isRunning = false;
    },

    getCalls(): CapturedApiCall[] {
      const fetchCalls = getFetchCalls();
      const xhrCalls = getXhrCalls();
      // Merge and sort by timestamp
      return [...fetchCalls, ...xhrCalls].sort((a, b) => a.request.timestamp - b.request.timestamp);
    },

    getPendingCalls(): CapturedApiCall[] {
      const fetchPending = getPendingFetchCalls();
      const xhrPending = getPendingXhrCalls();
      return [...fetchPending, ...xhrPending].sort(
        (a, b) => a.request.timestamp - b.request.timestamp
      );
    },

    clear(): void {
      clearFetchCalls();
      clearXhrCalls();
    },

    isActive(): boolean {
      return isFetchInterceptorActive() || isXhrInterceptorActive();
    },

    updateConfig(newConfig: Partial<ApiInterceptorConfig>): void {
      updateFetchInterceptorConfig(newConfig);
      updateXhrInterceptorConfig(newConfig);
    },
  };
}
