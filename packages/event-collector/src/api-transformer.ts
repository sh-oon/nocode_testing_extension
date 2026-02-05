import type { AssertApiStep, HttpMethod } from '@like-cake/ast-types';
import type { CapturedApiCall } from '@like-cake/api-interceptor';

/**
 * Configuration for API to Step transformation
 */
export interface ApiTransformConfig {
  /** Include response body assertions (jsonPath) */
  includeResponseBody?: boolean;
  /** Include response time assertion */
  includeResponseTime?: boolean;
  /** Exclude URLs matching these patterns */
  excludePatterns?: (string | RegExp)[];
  /** Only include URLs matching these patterns */
  includePatterns?: (string | RegExp)[];
  /** Whether to make the step optional (default: false) */
  optional?: boolean;
  /** Whether to wait for matching request (default: true) */
  waitFor?: boolean;
}

const DEFAULT_CONFIG: ApiTransformConfig = {
  includeResponseBody: false,
  includeResponseTime: false,
  excludePatterns: [],
  includePatterns: [],
  optional: false,
  waitFor: true,
};

/**
 * Check if URL matches any pattern in the list
 */
function matchesAnyPattern(url: string, patterns: (string | RegExp)[]): boolean {
  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      if (url.includes(pattern)) return true;
    } else {
      if (pattern.test(url)) return true;
    }
  }
  return false;
}

/**
 * Extract relative URL from full URL
 */
function extractRelativeUrl(fullUrl: string): string {
  try {
    const url = new URL(fullUrl);
    return url.pathname + url.search;
  } catch {
    return fullUrl;
  }
}

/**
 * Transform a single CapturedApiCall to an AssertApiStep
 */
export function transformApiCallToStep(
  apiCall: CapturedApiCall,
  config: ApiTransformConfig = {}
): AssertApiStep | null {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { request, response, pending, error } = apiCall;

  // Skip pending or errored requests
  if (pending || error) {
    return null;
  }

  // Skip if no response
  if (!response) {
    return null;
  }

  // Check exclude patterns
  if (
    mergedConfig.excludePatterns &&
    mergedConfig.excludePatterns.length > 0 &&
    matchesAnyPattern(request.url, mergedConfig.excludePatterns)
  ) {
    return null;
  }

  // Check include patterns (if specified, must match)
  if (
    mergedConfig.includePatterns &&
    mergedConfig.includePatterns.length > 0 &&
    !matchesAnyPattern(request.url, mergedConfig.includePatterns)
  ) {
    return null;
  }

  const relativeUrl = extractRelativeUrl(request.url);

  const step: AssertApiStep = {
    type: 'assertApi',
    match: {
      url: relativeUrl,
      method: request.method.toUpperCase() as HttpMethod,
    },
    expect: {
      status: response.status,
    },
    waitFor: mergedConfig.waitFor,
    ...(mergedConfig.optional && { optional: true }),
  };

  // Add response body assertions if configured and response has body
  if (mergedConfig.includeResponseBody && response.body) {
    // Only include body assertions for JSON responses
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('application/json')) {
      // Create basic jsonPath assertions for top-level properties
      const jsonPath = createBasicJsonPathAssertions(response.body);
      if (Object.keys(jsonPath).length > 0) {
        step.expect = {
          ...step.expect,
          jsonPath,
        };
      }
    }
  }

  // Add response time assertion if configured
  if (mergedConfig.includeResponseTime && response.responseTime) {
    step.expect = {
      ...step.expect,
      // Allow 2x the recorded response time as threshold
      responseTime: Math.ceil(response.responseTime * 2),
    };
  }

  return step;
}

/**
 * Create basic jsonPath assertions for common response patterns
 */
function createBasicJsonPathAssertions(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null) {
    return {};
  }

  const assertions: Record<string, unknown> = {};
  const obj = body as Record<string, unknown>;

  // Check for common success/error indicators
  if ('success' in obj) {
    assertions['$.success'] = obj.success;
  }
  if ('ok' in obj) {
    assertions['$.ok'] = obj.ok;
  }
  if ('error' in obj && obj.error !== undefined) {
    assertions['$.error'] = obj.error;
  }

  // Check for data wrapper patterns
  if ('data' in obj && obj.data !== null) {
    // Just assert data exists, not the full content
    assertions['$.data'] = { $exists: true };
  }

  // Check for pagination patterns
  if ('total' in obj && typeof obj.total === 'number') {
    assertions['$.total'] = { $gte: 0 };
  }
  if ('items' in obj && Array.isArray(obj.items)) {
    assertions['$.items'] = { $isArray: true };
  }

  return assertions;
}

/**
 * Transform multiple CapturedApiCalls to AssertApiSteps
 */
export function transformApiCallsToSteps(
  apiCalls: CapturedApiCall[],
  config: ApiTransformConfig = {}
): AssertApiStep[] {
  const steps: AssertApiStep[] = [];

  for (const apiCall of apiCalls) {
    const step = transformApiCallToStep(apiCall, config);
    if (step) {
      steps.push(step);
    }
  }

  return steps;
}

/**
 * Merge API steps with UI action steps in chronological order
 * This interleaves API assertions after the UI actions that triggered them
 */
export function mergeStepsWithApiAssertions(
  uiSteps: { step: unknown; timestamp?: number }[],
  apiSteps: { step: AssertApiStep; timestamp: number }[]
): unknown[] {
  // Create combined list with timestamps
  const combined = [
    ...uiSteps.map((s, i) => ({
      step: s.step,
      timestamp: s.timestamp ?? i,
      isApi: false,
    })),
    ...apiSteps.map((s) => ({
      step: s.step,
      timestamp: s.timestamp,
      isApi: true,
    })),
  ];

  // Sort by timestamp
  combined.sort((a, b) => a.timestamp - b.timestamp);

  return combined.map((item) => item.step);
}
