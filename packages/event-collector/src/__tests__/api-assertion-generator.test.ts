import { describe, expect, it } from 'vitest';
import type { CapturedApiCall } from '@like-cake/api-interceptor';
import {
  DEFAULT_EXCLUDE_PATTERNS,
  generateApiAssertions,
  getRelevantApiCalls,
  type ApiAssertionConfig,
  type ApiAssertionContext,
} from '../api-assertion-generator';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Factory for creating mock CapturedApiCall objects with sensible defaults.
 * Override any nested property via partial overrides.
 */
function createMockApiCall(overrides: {
  url?: string;
  method?: string;
  requestTimestamp?: number;
  responseTime?: number;
  status?: number;
  statusText?: string;
  pending?: boolean;
  error?: string;
  responseBody?: unknown;
  hasResponse?: boolean;
} = {}): CapturedApiCall {
  const {
    url = 'https://api.example.com/users',
    method = 'GET',
    requestTimestamp = 1000,
    responseTime = 200,
    status = 200,
    statusText = 'OK',
    pending = false,
    error,
    responseBody,
    hasResponse = true,
  } = overrides;

  return {
    request: {
      id: `req-${Math.random().toString(36).slice(2, 8)}`,
      url,
      method,
      headers: { 'content-type': 'application/json' },
      timestamp: requestTimestamp,
      initiator: 'fetch' as const,
    },
    response: hasResponse
      ? {
          status,
          statusText,
          headers: { 'content-type': 'application/json' },
          body: responseBody,
          responseTime,
          bodySize: 256,
        }
      : undefined,
    pending,
    error,
  };
}

/**
 * Default context: idle window from 1000ms to 3000ms.
 * A call with requestTimestamp=1000 and responseTime=200 completes at 1200,
 * which falls inside this window.
 */
const defaultContext: ApiAssertionContext = {
  lastEventTimestamp: 1000,
  idleDetectedAt: 3000,
};

/** Config with no exclusions for isolated testing */
const noExcludeConfig: Partial<ApiAssertionConfig> = {
  excludePatterns: [],
};

// ============================================================================
// getRelevantApiCalls
// ============================================================================

describe('getRelevantApiCalls', () => {
  it('should include calls with responses completed within the idle window', () => {
    const call = createMockApiCall({
      requestTimestamp: 1000,
      responseTime: 500, // completes at 1500
    });

    const result = getRelevantApiCalls([call], defaultContext, noExcludeConfig);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(call);
  });

  it('should exclude pending calls (no response)', () => {
    const call = createMockApiCall({
      pending: true,
      hasResponse: false,
    });

    const result = getRelevantApiCalls([call], defaultContext, noExcludeConfig);
    expect(result).toHaveLength(0);
  });

  it('should exclude calls with errors', () => {
    const call = createMockApiCall({
      error: 'Network error',
      hasResponse: false,
    });

    const result = getRelevantApiCalls([call], defaultContext, noExcludeConfig);
    expect(result).toHaveLength(0);
  });

  it('should exclude calls without a response object', () => {
    const call = createMockApiCall({
      hasResponse: false,
    });

    const result = getRelevantApiCalls([call], defaultContext, noExcludeConfig);
    expect(result).toHaveLength(0);
  });

  it('should exclude calls whose response completed before the idle window', () => {
    const call = createMockApiCall({
      requestTimestamp: 500,
      responseTime: 100, // completes at 600, before lastEventTimestamp=1000
    });

    const result = getRelevantApiCalls([call], defaultContext, noExcludeConfig);
    expect(result).toHaveLength(0);
  });

  it('should exclude calls whose response completed after the idle window', () => {
    const call = createMockApiCall({
      requestTimestamp: 2500,
      responseTime: 600, // completes at 3100, after idleDetectedAt=3000
    });

    const result = getRelevantApiCalls([call], defaultContext, noExcludeConfig);
    expect(result).toHaveLength(0);
  });

  it('should include calls at the exact boundary of the idle window', () => {
    const callAtStart = createMockApiCall({
      url: 'https://api.example.com/start',
      requestTimestamp: 800,
      responseTime: 200, // completes at exactly 1000
    });
    const callAtEnd = createMockApiCall({
      url: 'https://api.example.com/end',
      requestTimestamp: 2500,
      responseTime: 500, // completes at exactly 3000
    });

    const result = getRelevantApiCalls(
      [callAtStart, callAtEnd],
      defaultContext,
      noExcludeConfig,
    );
    expect(result).toHaveLength(2);
  });

  it('should exclude analytics URLs with default patterns', () => {
    const analyticsCall = createMockApiCall({
      url: 'https://www.google-analytics.com/collect?v=1',
      requestTimestamp: 1000,
      responseTime: 100,
    });

    const result = getRelevantApiCalls([analyticsCall], defaultContext);
    expect(result).toHaveLength(0);
  });

  it('should exclude googletagmanager URLs', () => {
    const gtmCall = createMockApiCall({
      url: 'https://www.googletagmanager.com/gtm.js?id=GTM-XXXX',
      requestTimestamp: 1000,
      responseTime: 100,
    });

    const result = getRelevantApiCalls([gtmCall], defaultContext);
    expect(result).toHaveLength(0);
  });

  it('should exclude hot-update URLs', () => {
    const hotUpdate = createMockApiCall({
      url: 'https://localhost:3000/main.hot-update.json',
      requestTimestamp: 1000,
      responseTime: 50,
    });

    const result = getRelevantApiCalls([hotUpdate], defaultContext);
    expect(result).toHaveLength(0);
  });

  it('should exclude __vite dev server URLs', () => {
    const viteCall = createMockApiCall({
      url: 'https://localhost:5173/__vite/client',
      requestTimestamp: 1000,
      responseTime: 50,
    });

    const result = getRelevantApiCalls([viteCall], defaultContext);
    expect(result).toHaveLength(0);
  });

  it('should exclude __webpack dev server URLs', () => {
    const webpackCall = createMockApiCall({
      url: 'https://localhost:3000/__webpack/hmr',
      requestTimestamp: 1000,
      responseTime: 50,
    });

    const result = getRelevantApiCalls([webpackCall], defaultContext);
    expect(result).toHaveLength(0);
  });

  it('should exclude font file URLs', () => {
    const woff2Call = createMockApiCall({
      url: 'https://cdn.example.com/fonts/Inter.woff2',
      requestTimestamp: 1000,
      responseTime: 50,
    });

    const result = getRelevantApiCalls([woff2Call], defaultContext);
    expect(result).toHaveLength(0);
  });

  it('should exclude auth refresh and token URLs', () => {
    const refreshCall = createMockApiCall({
      url: 'https://api.example.com/auth/refresh',
      requestTimestamp: 1000,
      responseTime: 100,
    });
    const tokenCall = createMockApiCall({
      url: 'https://auth.example.com/oauth/token',
      requestTimestamp: 1100,
      responseTime: 100,
    });

    const result = getRelevantApiCalls([refreshCall, tokenCall], defaultContext);
    expect(result).toHaveLength(0);
  });

  it('should deduplicate by URL, keeping only the first occurrence', () => {
    const first = createMockApiCall({
      url: 'https://api.example.com/data',
      requestTimestamp: 1000,
      responseTime: 100,
      status: 200,
    });
    const duplicate = createMockApiCall({
      url: 'https://api.example.com/data',
      requestTimestamp: 1200,
      responseTime: 100,
      status: 200,
    });

    const result = getRelevantApiCalls([first, duplicate], defaultContext, noExcludeConfig);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(first);
  });

  it('should use custom exclude patterns when provided', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/internal/health',
      requestTimestamp: 1000,
      responseTime: 100,
    });

    const result = getRelevantApiCalls([call], defaultContext, {
      excludePatterns: [/\/internal\//i],
    });
    expect(result).toHaveLength(0);
  });

  it('should use DEFAULT_EXCLUDE_PATTERNS when no config is provided', () => {
    const trackingCall = createMockApiCall({
      url: 'https://tracking.example.com/event',
      requestTimestamp: 1000,
      responseTime: 100,
    });

    const result = getRelevantApiCalls([trackingCall], defaultContext);
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// generateApiAssertions
// ============================================================================

describe('generateApiAssertions', () => {
  it('should generate an assertApi step for a POST 200 call', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/users',
      method: 'POST',
      status: 200,
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions).toHaveLength(1);
    expect(assertions[0]).toEqual({
      type: 'assertApi',
      match: { url: '/users', method: 'POST' },
      expect: { status: 200 },
      waitFor: true,
      description: 'Auto: POST /users → 200',
    });
  });

  it('should NOT generate an assertion for a GET 200 call (data fetch noise)', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/users',
      method: 'GET',
      status: 200,
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions).toHaveLength(0);
  });

  it('should generate an assertApi step for a DELETE 204 call', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/users/42',
      method: 'DELETE',
      status: 204,
      statusText: 'No Content',
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions).toHaveLength(1);
    expect(assertions[0]).toMatchObject({
      type: 'assertApi',
      match: { url: '/users/42', method: 'DELETE' },
      expect: { status: 204 },
      waitFor: true,
    });
  });

  it('should generate an assertApi step for a PUT 200 call', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/users/42',
      method: 'PUT',
      status: 200,
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions).toHaveLength(1);
    expect(assertions[0]).toMatchObject({
      type: 'assertApi',
      match: { url: '/users/42', method: 'PUT' },
      expect: { status: 200 },
      waitFor: true,
    });
  });

  it('should generate an assertApi step for a PATCH call', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/users/42',
      method: 'PATCH',
      status: 200,
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions).toHaveLength(1);
    expect(assertions[0]).toMatchObject({
      match: { url: '/users/42', method: 'PATCH' },
    });
  });

  it('should generate an assertApi step for a GET 404 (error status)', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/users/999',
      method: 'GET',
      status: 404,
      statusText: 'Not Found',
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions).toHaveLength(1);
    expect(assertions[0]).toMatchObject({
      type: 'assertApi',
      match: { url: '/users/999', method: 'GET' },
      expect: { status: 404 },
      waitFor: true,
    });
  });

  it('should generate an assertApi step for a GET 500 (server error)', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/crash',
      method: 'GET',
      status: 500,
      statusText: 'Internal Server Error',
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions).toHaveLength(1);
    expect(assertions[0]).toMatchObject({
      type: 'assertApi',
      match: { url: '/crash', method: 'GET' },
      expect: { status: 500 },
    });
  });

  it('should extract URL pattern by stripping the origin and keeping path + query', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/v2/items?page=1&limit=20',
      method: 'POST',
      status: 201,
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions).toHaveLength(1);
    expect(assertions[0].match.url).toBe('/v2/items?page=1&limit=20');
  });

  it('should fallback to original URL when URL parsing fails', () => {
    const call = createMockApiCall({
      url: 'not-a-valid-url',
      method: 'POST',
      status: 200,
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions).toHaveLength(1);
    expect(assertions[0].match.url).toBe('not-a-valid-url');
  });

  it('should auto-generate a description string', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/orders',
      method: 'POST',
      status: 201,
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions[0].description).toBe('Auto: POST /orders → 201');
  });

  it('should set waitFor to true on all generated assertions', () => {
    const call = createMockApiCall({
      url: 'https://api.example.com/orders',
      method: 'POST',
      status: 200,
    });

    const assertions = generateApiAssertions([call]);
    expect(assertions[0].waitFor).toBe(true);
  });

  describe('priority and maxAssertions', () => {
    it('should limit output to maxAssertions (default 2)', () => {
      const calls = [
        createMockApiCall({ url: 'https://api.example.com/a', method: 'POST', status: 200 }),
        createMockApiCall({ url: 'https://api.example.com/b', method: 'PUT', status: 200 }),
        createMockApiCall({ url: 'https://api.example.com/c', method: 'DELETE', status: 204 }),
      ];

      const assertions = generateApiAssertions(calls);
      expect(assertions).toHaveLength(2);
    });

    it('should respect a custom maxAssertions limit', () => {
      const calls = [
        createMockApiCall({ url: 'https://api.example.com/a', method: 'POST', status: 200 }),
        createMockApiCall({ url: 'https://api.example.com/b', method: 'PUT', status: 200 }),
        createMockApiCall({ url: 'https://api.example.com/c', method: 'DELETE', status: 204 }),
      ];

      const assertions = generateApiAssertions(calls, { maxAssertions: 5 });
      expect(assertions).toHaveLength(3);
    });

    it('should prioritize state-changing methods over error responses', () => {
      const calls = [
        createMockApiCall({ url: 'https://api.example.com/error', method: 'GET', status: 500 }),
        createMockApiCall({ url: 'https://api.example.com/create', method: 'POST', status: 201 }),
        createMockApiCall({ url: 'https://api.example.com/missing', method: 'GET', status: 404 }),
      ];

      const assertions = generateApiAssertions(calls, { maxAssertions: 2 });
      expect(assertions).toHaveLength(2);
      // POST should come first (state-changing, priority 0)
      expect(assertions[0].match.method).toBe('POST');
      // Then error status (priority 1), first error in input order
      expect(assertions[1].match.method).toBe('GET');
      expect(assertions[1].expect?.status).toBe(500);
    });

    it('should preserve original order among calls with the same priority', () => {
      const calls = [
        createMockApiCall({ url: 'https://api.example.com/first', method: 'POST', status: 200 }),
        createMockApiCall({ url: 'https://api.example.com/second', method: 'PUT', status: 200 }),
        createMockApiCall({ url: 'https://api.example.com/third', method: 'DELETE', status: 204 }),
      ];

      const assertions = generateApiAssertions(calls, { maxAssertions: 3 });
      expect(assertions[0].match.url).toBe('/first');
      expect(assertions[1].match.url).toBe('/second');
      expect(assertions[2].match.url).toBe('/third');
    });
  });

  it('should return an empty array when no calls qualify', () => {
    const calls = [
      createMockApiCall({ url: 'https://api.example.com/data', method: 'GET', status: 200 }),
      createMockApiCall({ url: 'https://api.example.com/list', method: 'GET', status: 200 }),
    ];

    const assertions = generateApiAssertions(calls);
    expect(assertions).toHaveLength(0);
  });

  it('should return an empty array for an empty input', () => {
    const assertions = generateApiAssertions([]);
    expect(assertions).toHaveLength(0);
  });
});

// ============================================================================
// DEFAULT_EXCLUDE_PATTERNS
// ============================================================================

describe('DEFAULT_EXCLUDE_PATTERNS', () => {
  it('should be a non-empty array of RegExp', () => {
    expect(Array.isArray(DEFAULT_EXCLUDE_PATTERNS)).toBe(true);
    expect(DEFAULT_EXCLUDE_PATTERNS.length).toBeGreaterThan(0);
    for (const pattern of DEFAULT_EXCLUDE_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp);
    }
  });

  const matchCases: [string, string][] = [
    ['google-analytics', 'https://www.google-analytics.com/collect'],
    ['googletagmanager', 'https://www.googletagmanager.com/gtm.js'],
    ['facebook tracking', 'https://www.facebook.com/tr?ev=PageView'],
    ['analytics keyword', 'https://api.example.com/analytics/event'],
    ['tracking keyword', 'https://tracking.example.com/pixel'],
    ['beacon keyword', 'https://beacon.example.com/ping'],
    ['hot-update', 'https://localhost:3000/main.hot-update.json'],
    ['__vite', 'https://localhost:5173/__vite/client'],
    ['__webpack', 'https://localhost:3000/__webpack/hmr'],
    ['.map file', 'https://cdn.example.com/app.js.map'],
    ['favicon.ico', 'https://example.com/favicon.ico'],
    ['.woff2 font', 'https://fonts.example.com/inter.woff2'],
    ['.woff font', 'https://fonts.example.com/inter.woff'],
    ['.ttf font', 'https://fonts.example.com/inter.ttf'],
    ['/auth/refresh', 'https://api.example.com/auth/refresh'],
    ['/token endpoint', 'https://auth.example.com/oauth/token'],
  ];

  for (const [label, url] of matchCases) {
    it(`should match ${label} URL: ${url}`, () => {
      const matched = DEFAULT_EXCLUDE_PATTERNS.some((p) => p.test(url));
      expect(matched).toBe(true);
    });
  }

  it('should NOT match a normal API URL', () => {
    const normalUrl = 'https://api.example.com/v1/users';
    const matched = DEFAULT_EXCLUDE_PATTERNS.some((p) => p.test(normalUrl));
    expect(matched).toBe(false);
  });
});

// ============================================================================
// Integration: getRelevantApiCalls + generateApiAssertions
// ============================================================================

describe('end-to-end: filter then generate', () => {
  it('should produce assertions only for qualifying calls within the idle window', () => {
    const calls = [
      // Inside window, POST 201 -> qualifies
      createMockApiCall({
        url: 'https://api.example.com/orders',
        method: 'POST',
        requestTimestamp: 1000,
        responseTime: 300,
        status: 201,
      }),
      // Inside window, GET 200 -> does NOT qualify (noise)
      createMockApiCall({
        url: 'https://api.example.com/products',
        method: 'GET',
        requestTimestamp: 1100,
        responseTime: 200,
        status: 200,
      }),
      // Inside window, GET 404 -> qualifies (error)
      createMockApiCall({
        url: 'https://api.example.com/missing',
        method: 'GET',
        requestTimestamp: 1200,
        responseTime: 100,
        status: 404,
      }),
      // Outside window (before) -> excluded
      createMockApiCall({
        url: 'https://api.example.com/early',
        method: 'POST',
        requestTimestamp: 500,
        responseTime: 100,
        status: 200,
      }),
      // Analytics -> excluded by default patterns
      createMockApiCall({
        url: 'https://www.google-analytics.com/collect',
        method: 'POST',
        requestTimestamp: 1500,
        responseTime: 100,
        status: 200,
      }),
      // Pending -> excluded
      createMockApiCall({
        url: 'https://api.example.com/slow',
        method: 'POST',
        requestTimestamp: 2000,
        responseTime: 500,
        pending: true,
        hasResponse: false,
      }),
    ];

    const relevant = getRelevantApiCalls(calls, defaultContext);
    const assertions = generateApiAssertions(relevant, { maxAssertions: 5 });

    // POST /orders and GET /missing should qualify
    expect(assertions).toHaveLength(2);
    expect(assertions[0].match.url).toBe('/orders');
    expect(assertions[0].match.method).toBe('POST');
    expect(assertions[1].match.url).toBe('/missing');
    expect(assertions[1].match.method).toBe('GET');
    expect(assertions[1].expect?.status).toBe(404);
  });
});
