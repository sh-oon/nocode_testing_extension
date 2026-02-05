/**
 * @like-cake/diff-engine
 *
 * Comparison engine for API responses, DOM structures, and screenshots.
 * Provides unified diffing capabilities for E2E test validation.
 */

import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { DomSnapshot } from '@like-cake/dom-serializer';
import { compareApiCalls, formatApiDiffReport } from './api-diff';
import { compareDomSnapshots, formatDomDiffReport } from './dom-diff';
import type { ApiDiffConfig, ComparisonResult, DomDiffConfig, VisualDiffConfig } from './types';
import { compareScreenshots, formatVisualDiffReport } from './visual-diff';

// Re-export individual comparers
export {
  compareApiCalls,
  formatApiDiffReport,
} from './api-diff';
export {
  areDomSnapshotsEqual,
  compareDomSnapshots,
  formatDomDiffReport,
} from './dom-diff';
// Re-export types
export * from './types';
export {
  areScreenshotsEqual,
  compareScreenshots,
  createOverlayImage,
  createSideBySideImage,
  formatVisualDiffReport,
} from './visual-diff';

/**
 * Configuration for the unified comparison
 */
export interface CompareOptions {
  /** API diff configuration */
  apiConfig?: ApiDiffConfig;
  /** DOM diff configuration */
  domConfig?: DomDiffConfig;
  /** Visual diff configuration */
  visualConfig?: VisualDiffConfig;
  /** Scenario or test ID for metadata */
  scenarioId?: string;
  /** Step index for metadata */
  stepIndex?: number;
}

/**
 * Baseline data for comparison
 */
export interface BaselineData {
  /** Captured API calls */
  apiCalls?: CapturedApiCall[];
  /** DOM snapshot */
  domSnapshot?: DomSnapshot;
  /** Screenshot (base64 PNG) */
  screenshot?: string;
  /** Baseline identifier */
  id?: string;
}

/**
 * Actual data for comparison
 */
export interface ActualData {
  /** Captured API calls */
  apiCalls?: CapturedApiCall[];
  /** DOM snapshot */
  domSnapshot?: DomSnapshot;
  /** Screenshot (base64 PNG) */
  screenshot?: string;
  /** Actual run identifier */
  id?: string;
}

/**
 * Performs a unified comparison of API calls, DOM snapshots, and screenshots.
 * Only compares data types that are present in both baseline and actual.
 *
 * @param baseline - The baseline (expected) data
 * @param actual - The actual (recorded) data
 * @param options - Configuration options for comparison
 * @returns Comparison result with all diff results
 *
 * @example
 * ```typescript
 * const result = compare(
 *   { apiCalls: baselineApiCalls, domSnapshot: baselineDom, screenshot: baselineScreenshot },
 *   { apiCalls: actualApiCalls, domSnapshot: actualDom, screenshot: actualScreenshot },
 *   { apiConfig: { strict: true } }
 * );
 *
 * if (!result.passed) {
 *   console.log('Differences found:', result);
 * }
 * ```
 */
export function compare(
  baseline: BaselineData,
  actual: ActualData,
  options: CompareOptions = {}
): ComparisonResult {
  const result: ComparisonResult = {
    passed: true,
    timestamp: Date.now(),
    metadata: {
      baselineId: baseline.id,
      actualId: actual.id,
      scenarioId: options.scenarioId,
      stepIndex: options.stepIndex,
    },
  };

  // Compare API calls if both are present
  if (baseline.apiCalls && actual.apiCalls) {
    result.api = compareApiCalls(baseline.apiCalls, actual.apiCalls, options.apiConfig);
    if (!result.api.passed) {
      result.passed = false;
    }
  }

  // Compare DOM snapshots if both are present
  if (baseline.domSnapshot && actual.domSnapshot) {
    result.dom = compareDomSnapshots(baseline.domSnapshot, actual.domSnapshot, options.domConfig);
    if (!result.dom.passed) {
      result.passed = false;
    }
  }

  // Compare screenshots if both are present
  if (baseline.screenshot && actual.screenshot) {
    result.visual = compareScreenshots(
      baseline.screenshot,
      actual.screenshot,
      options.visualConfig
    );
    if (!result.visual.passed) {
      result.passed = false;
    }
  }

  return result;
}

/**
 * Creates a formatted text report of all comparison results
 */
export function formatComparisonReport(result: ComparisonResult): string {
  const lines: string[] = [];
  const separator = '═'.repeat(50);

  lines.push(separator);
  lines.push('         COMPARISON REPORT');
  lines.push(separator);
  lines.push('');
  lines.push(`Overall Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push(`Timestamp: ${new Date(result.timestamp).toISOString()}`);

  if (result.metadata?.scenarioId) {
    lines.push(`Scenario: ${result.metadata.scenarioId}`);
  }
  if (result.metadata?.stepIndex !== undefined) {
    lines.push(`Step: ${result.metadata.stepIndex}`);
  }

  lines.push('');

  if (result.api) {
    lines.push(separator);
    lines.push(formatApiDiffReport(result.api));
  }

  if (result.dom) {
    lines.push('');
    lines.push(separator);
    lines.push(formatDomDiffReport(result.dom));
  }

  if (result.visual) {
    lines.push('');
    lines.push(separator);
    lines.push(formatVisualDiffReport(result.visual));
  }

  lines.push('');
  lines.push(separator);

  return lines.join('\n');
}

/**
 * Utility to create a summary object for quick status check
 */
export function getComparisonSummary(result: ComparisonResult): {
  passed: boolean;
  apiPassed: boolean | null;
  domPassed: boolean | null;
  visualPassed: boolean | null;
  totalDiffs: number;
} {
  return {
    passed: result.passed,
    apiPassed: result.api?.passed ?? null,
    domPassed: result.dom?.passed ?? null,
    visualPassed: result.visual?.passed ?? null,
    totalDiffs:
      (result.api?.totalDiffs ?? 0) +
      (result.dom?.totalDiffs ?? 0) +
      (result.visual && !result.visual.passed ? 1 : 0),
  };
}

/**
 * Checks if any comparison was performed
 */
export function hasComparisons(result: ComparisonResult): boolean {
  return result.api !== undefined || result.dom !== undefined || result.visual !== undefined;
}
