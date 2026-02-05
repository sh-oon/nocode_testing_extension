import type { CapturedApiCall } from '@like-cake/api-interceptor';
import deepDiff from 'deep-diff';

type Diff<LHS, RHS> = deepDiff.Diff<LHS, RHS>;
const { diff } = deepDiff;
import type {
  ApiCallDiffResult,
  ApiDiffConfig,
  ApiDiffResult,
  DiffChange,
  DiffKind,
  DiffSeverity,
} from './types';
import { DEFAULT_API_DIFF_CONFIG } from './types';

/**
 * Converts deep-diff kind to our DiffKind
 */
function convertKind(deepDiffKind: string): DiffKind {
  switch (deepDiffKind) {
    case 'N':
      return 'added';
    case 'D':
      return 'deleted';
    case 'E':
      return 'modified';
    case 'A':
      return 'array';
    default:
      return 'modified';
  }
}

/**
 * Checks if a path matches any of the ignore patterns
 */
function shouldIgnorePath(path: string[], ignorePatterns: string[]): boolean {
  const pathStr = path.join('.');

  for (const pattern of ignorePatterns) {
    // Handle wildcard patterns
    if (pattern.includes('*')) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      if (regex.test(pathStr)) {
        return true;
      }
    } else if (pathStr === pattern || pathStr.startsWith(`${pattern}.`)) {
      return true;
    }
  }

  return false;
}

/**
 * Converts deep-diff results to our DiffChange format
 */
function convertDiffs(
  diffs: Diff<unknown, unknown>[] | undefined,
  prefix: string[],
  ignorePaths: string[]
): DiffChange[] {
  if (!diffs) {
    return [];
  }

  const changes: DiffChange[] = [];

  for (const d of diffs) {
    const path = [...prefix, ...(d.path || []).map(String)];

    // Skip ignored paths
    if (shouldIgnorePath(path, ignorePaths)) {
      continue;
    }

    const kind = convertKind(d.kind);
    const description = generateDescription(d, path);

    if (d.kind === 'A') {
      // Array change - recurse into the item
      const arrayPath = [...path, String(d.index)];
      if (d.item) {
        const itemChanges = convertDiffs([d.item], arrayPath, ignorePaths);
        changes.push(...itemChanges);
      }
    } else {
      changes.push({
        kind,
        path,
        lhs: 'lhs' in d ? d.lhs : undefined,
        rhs: 'rhs' in d ? d.rhs : undefined,
        description,
      });
    }
  }

  return changes;
}

/**
 * Generates a human-readable description of a change
 */
function generateDescription(d: Diff<unknown, unknown>, path: string[]): string {
  const pathStr = path.join('.');

  switch (d.kind) {
    case 'N':
      return `Added ${pathStr}: ${formatValue(d.rhs)}`;
    case 'D':
      return `Deleted ${pathStr}: ${formatValue(d.lhs)}`;
    case 'E':
      return `Changed ${pathStr} from ${formatValue(d.lhs)} to ${formatValue(d.rhs)}`;
    case 'A':
      return `Array ${pathStr} changed at index ${d.index}`;
    default:
      return `Changed ${pathStr}`;
  }
}

/**
 * Formats a value for display
 */
function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string')
    return `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"`;
  if (typeof value === 'object') return JSON.stringify(value).substring(0, 100);
  return String(value);
}

/**
 * Determines severity based on differences
 */
function determineSeverity(
  statusChanged: boolean,
  requestDiffs: DiffChange[],
  responseDiffs: DiffChange[]
): DiffSeverity {
  if (statusChanged) {
    return 'error';
  }
  if (responseDiffs.length > 0) {
    return 'warning';
  }
  if (requestDiffs.length > 0) {
    return 'info';
  }
  return 'info';
}

/**
 * Prepares request object for comparison based on config
 */
function prepareRequestForComparison(
  call: CapturedApiCall,
  config: Required<ApiDiffConfig>
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    url: call.request.url,
    method: call.request.method,
  };

  if (config.compareRequestBodies && call.request.body !== undefined) {
    result.body = call.request.body;
  }

  if (config.compareHeaders) {
    const headers = { ...call.request.headers };
    for (const header of config.ignoreHeaders) {
      delete headers[header.toLowerCase()];
    }
    result.headers = headers;
  }

  return result;
}

/**
 * Prepares response object for comparison based on config
 */
function prepareResponseForComparison(
  call: CapturedApiCall,
  config: Required<ApiDiffConfig>
): Record<string, unknown> | undefined {
  if (!call.response) {
    return undefined;
  }

  const result: Record<string, unknown> = {
    status: call.response.status,
  };

  if (config.compareResponseBodies && call.response.body !== undefined) {
    result.body = call.response.body;
  }

  if (config.compareHeaders) {
    const headers = { ...call.response.headers };
    for (const header of config.ignoreHeaders) {
      delete headers[header.toLowerCase()];
    }
    result.headers = headers;
  }

  return result;
}

/**
 * Matches API calls between baseline and actual based on URL and method
 */
function matchApiCalls(
  baseline: CapturedApiCall[],
  actual: CapturedApiCall[]
): {
  matched: Array<{ baseline: CapturedApiCall; actual: CapturedApiCall }>;
  missing: CapturedApiCall[];
  extra: CapturedApiCall[];
} {
  const matched: Array<{ baseline: CapturedApiCall; actual: CapturedApiCall }> = [];
  const actualUsed = new Set<number>();
  const missing: CapturedApiCall[] = [];

  // Match by URL and method
  for (const baselineCall of baseline) {
    const actualIndex = actual.findIndex(
      (a, i) =>
        !actualUsed.has(i) &&
        normalizeUrl(a.request.url) === normalizeUrl(baselineCall.request.url) &&
        a.request.method === baselineCall.request.method
    );

    if (actualIndex !== -1) {
      matched.push({ baseline: baselineCall, actual: actual[actualIndex] });
      actualUsed.add(actualIndex);
    } else {
      missing.push(baselineCall);
    }
  }

  // Find extra calls
  const extra = actual.filter((_, i) => !actualUsed.has(i));

  return { matched, missing, extra };
}

/**
 * Normalizes URL for comparison (removes dynamic parts if needed)
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common dynamic query params
    parsed.searchParams.delete('_');
    parsed.searchParams.delete('timestamp');
    parsed.searchParams.delete('t');
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Compares a single API call between baseline and actual
 */
function compareApiCall(
  baseline: CapturedApiCall,
  actual: CapturedApiCall,
  config: Required<ApiDiffConfig>
): ApiCallDiffResult {
  const baselineRequest = prepareRequestForComparison(baseline, config);
  const actualRequest = prepareRequestForComparison(actual, config);
  const baselineResponse = prepareResponseForComparison(baseline, config);
  const actualResponse = prepareResponseForComparison(actual, config);

  // Compare requests
  const requestRawDiffs = diff(baselineRequest, actualRequest);
  const requestDiffs = convertDiffs(requestRawDiffs, ['request'], config.ignorePaths);

  // Compare responses
  const responseRawDiffs = diff(baselineResponse, actualResponse);
  const responseDiffs = convertDiffs(responseRawDiffs, ['response'], config.ignorePaths);

  // Check status change
  const statusChanged = baseline.response?.status !== actual.response?.status;

  // Determine pass/fail
  const hasDiffs = requestDiffs.length > 0 || responseDiffs.length > 0 || statusChanged;
  const passed = config.strict ? !hasDiffs : !statusChanged && responseDiffs.length === 0;

  return {
    requestId: baseline.request.id,
    url: baseline.request.url,
    method: baseline.request.method,
    passed,
    severity: determineSeverity(statusChanged, requestDiffs, responseDiffs),
    requestDiffs,
    responseDiffs,
    statusChanged,
    baselineStatus: baseline.response?.status,
    actualStatus: actual.response?.status,
  };
}

/**
 * Compares API calls between baseline and actual recordings
 */
export function compareApiCalls(
  baseline: CapturedApiCall[],
  actual: CapturedApiCall[],
  userConfig: ApiDiffConfig = {}
): ApiDiffResult {
  const config: Required<ApiDiffConfig> = {
    ...DEFAULT_API_DIFF_CONFIG,
    ...userConfig,
  };

  // Match API calls
  const { matched, missing, extra } = matchApiCalls(baseline, actual);

  // Compare matched calls
  const calls: ApiCallDiffResult[] = matched.map(({ baseline: b, actual: a }) =>
    compareApiCall(b, a, config)
  );

  // Calculate totals
  const totalDiffs =
    calls.reduce((sum, c) => sum + c.requestDiffs.length + c.responseDiffs.length, 0) +
    missing.length +
    extra.length;

  const differentCount = calls.filter((c) => !c.passed).length;

  // Overall pass/fail
  const passed =
    calls.every((c) => c.passed) &&
    (config.strict ? missing.length === 0 && extra.length === 0 : missing.length === 0);

  return {
    calls,
    missingCalls: missing,
    extraCalls: extra,
    totalDiffs,
    passed,
    summary: {
      total: baseline.length,
      matched: matched.length,
      different: differentCount,
      missing: missing.length,
      extra: extra.length,
    },
  };
}

/**
 * Creates a detailed diff report as a string
 */
export function formatApiDiffReport(result: ApiDiffResult): string {
  const lines: string[] = [];

  lines.push('=== API Comparison Report ===');
  lines.push('');
  lines.push(`Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push(`Total API Calls: ${result.summary.total}`);
  lines.push(`Matched: ${result.summary.matched}`);
  lines.push(`Different: ${result.summary.different}`);
  lines.push(`Missing: ${result.summary.missing}`);
  lines.push(`Extra: ${result.summary.extra}`);
  lines.push('');

  if (result.calls.length > 0) {
    lines.push('--- Call Details ---');
    for (const call of result.calls) {
      lines.push('');
      lines.push(`[${call.passed ? '✓' : '✗'}] ${call.method} ${call.url}`);

      if (call.statusChanged) {
        lines.push(`  Status: ${call.baselineStatus} → ${call.actualStatus}`);
      }

      for (const d of call.requestDiffs) {
        lines.push(`  Request: ${d.description}`);
      }

      for (const d of call.responseDiffs) {
        lines.push(`  Response: ${d.description}`);
      }
    }
  }

  if (result.missingCalls.length > 0) {
    lines.push('');
    lines.push('--- Missing Calls (in baseline, not in actual) ---');
    for (const call of result.missingCalls) {
      lines.push(`  ${call.request.method} ${call.request.url}`);
    }
  }

  if (result.extraCalls.length > 0) {
    lines.push('');
    lines.push('--- Extra Calls (in actual, not in baseline) ---');
    for (const call of result.extraCalls) {
      lines.push(`  ${call.request.method} ${call.request.url}`);
    }
  }

  return lines.join('\n');
}
