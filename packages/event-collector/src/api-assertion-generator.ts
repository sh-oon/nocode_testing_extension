import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { AssertApiStep, HttpMethod } from '@like-cake/ast-types';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for API assertion generation during idle periods.
 */
export interface ApiAssertionConfig {
  /** URL patterns to exclude (analytics, tracking, etc.) */
  excludePatterns: RegExp[];
  /** Maximum number of assertions to generate per idle period. Default: 2 */
  maxAssertions: number;
}

/**
 * Temporal context describing the idle period boundaries.
 */
export interface ApiAssertionContext {
  /** Timestamp of the last user event before idle */
  lastEventTimestamp: number;
  /** Timestamp when idle was detected */
  idleDetectedAt: number;
}

// ============================================================================
// Default Exclude Patterns
// ============================================================================

/**
 * Default URL patterns to exclude from assertion generation.
 * Covers analytics services, tracking pixels, dev-server artifacts,
 * static assets, and common auth token refresh endpoints.
 */
export const DEFAULT_EXCLUDE_PATTERNS: RegExp[] = [
  /google-analytics/i,
  /googletagmanager/i,
  /facebook\.com\/tr/i,
  /analytics/i,
  /tracking/i,
  /beacon/i,
  /hot-update/i,
  /__vite/i,
  /__webpack/i,
  /\.map$/i,
  /favicon\.ico/i,
  /\.woff2?$/i,
  /\.ttf$/i,
  /\/auth\/refresh/i,
  /\/token$/i,
];

// ============================================================================
// Internal Helpers
// ============================================================================

/** HTTP methods considered state-changing */
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Check whether a status code represents a client or server error (4xx/5xx).
 */
function isErrorStatus(status: number): boolean {
  return status >= 400;
}

/**
 * Extract the pathname (+ query string) from a full URL, stripping the origin.
 * Falls back to returning the input as-is when parsing fails.
 */
function extractUrlPattern(fullUrl: string): string {
  try {
    const parsed = new URL(fullUrl);
    return parsed.pathname + parsed.search;
  } catch {
    return fullUrl;
  }
}

/**
 * Calculate the timestamp at which a response completed.
 * Defined as `request.timestamp + response.responseTime`.
 */
function getResponseCompletionTime(call: CapturedApiCall): number {
  if (!call.response) {
    return 0;
  }
  return call.request.timestamp + call.response.responseTime;
}

/**
 * Derive a sorting priority for a qualifying API call.
 * Lower numbers = higher priority.
 *   0 – state-changing method (POST/PUT/PATCH/DELETE)
 *   1 – error status on any method
 *   2 – everything else
 */
function getPriority(call: CapturedApiCall): number {
  const method = call.request.method.toUpperCase();
  if (STATE_CHANGING_METHODS.has(method)) {
    return 0;
  }
  if (call.response && isErrorStatus(call.response.status)) {
    return 1;
  }
  return 2;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Filter API calls that are relevant to a given idle period.
 *
 * A call is considered relevant when:
 * - It has a response (not pending, no error)
 * - Its response completed between `lastEventTimestamp` and `idleDetectedAt`
 * - Its URL does not match any of the configured exclude patterns
 * - It is not a duplicate URL within the same period (first occurrence wins)
 */
export function getRelevantApiCalls(
  allCalls: CapturedApiCall[],
  context: ApiAssertionContext,
  config: Partial<ApiAssertionConfig> = {},
): CapturedApiCall[] {
  const excludePatterns = config.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS;
  const seenUrls = new Set<string>();
  const relevant: CapturedApiCall[] = [];

  for (const call of allCalls) {
    // Skip pending or errored requests, or those without a response
    if (call.pending || call.error || !call.response) {
      continue;
    }

    // Check temporal window
    const completionTime = getResponseCompletionTime(call);
    if (completionTime < context.lastEventTimestamp || completionTime > context.idleDetectedAt) {
      continue;
    }

    // Exclude matching URL patterns
    const url = call.request.url;
    if (excludePatterns.some((pattern) => pattern.test(url))) {
      continue;
    }

    // Deduplicate by URL (keep first occurrence)
    if (seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);

    relevant.push(call);
  }

  return relevant;
}

/**
 * Generate `AssertApiStep` objects from a list of relevant API calls.
 *
 * Rules:
 * - State-changing methods (POST, PUT, PATCH, DELETE) always qualify.
 * - Any call with an error status (4xx/5xx) qualifies regardless of method.
 * - GET requests with 2xx responses are skipped (considered noise / data fetching).
 * - Results are sorted by priority (state-changing > error > other) and capped
 *   at `config.maxAssertions` (default 2).
 */
export function generateApiAssertions(
  relevantCalls: CapturedApiCall[],
  config: Partial<ApiAssertionConfig> = {},
): AssertApiStep[] {
  const maxAssertions = config.maxAssertions ?? 2;

  // Filter to only qualifying calls
  const qualifying = relevantCalls.filter((call) => {
    const method = call.request.method.toUpperCase();
    const status = call.response?.status ?? 0;

    // State-changing methods always qualify
    if (STATE_CHANGING_METHODS.has(method)) {
      return true;
    }

    // Error statuses qualify regardless of method
    if (isErrorStatus(status)) {
      return true;
    }

    // Everything else (e.g. GET 2xx) is noise
    return false;
  });

  // Sort by priority (lower = higher priority), preserving original order as tiebreaker
  const sorted = qualifying
    .map((call, index) => ({ call, priority: getPriority(call), index }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ call }) => call);

  // Limit to maxAssertions
  const limited = sorted.slice(0, maxAssertions);

  // Generate AssertApiStep for each qualifying call
  return limited.map((call) => {
    const method = call.request.method.toUpperCase() as HttpMethod;
    const status = call.response!.status;
    const urlPattern = extractUrlPattern(call.request.url);

    return {
      type: 'assertApi' as const,
      match: {
        url: urlPattern,
        method,
      },
      expect: {
        status,
      },
      waitFor: true,
      description: `Auto: ${method} ${urlPattern} → ${status}`,
    };
  });
}
