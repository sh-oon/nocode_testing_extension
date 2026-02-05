import type { CapturedApiCall } from '@like-cake/api-interceptor';

/**
 * Types of differences that can be detected
 */
export type DiffKind = 'added' | 'deleted' | 'modified' | 'array' | 'moved';

/**
 * Single difference in a comparison
 */
export interface DiffChange {
  /** Type of change */
  kind: DiffKind;
  /** Path to the changed value (dot notation) */
  path: string[];
  /** Previous value (for modified/deleted) */
  lhs?: unknown;
  /** New value (for modified/added) */
  rhs?: unknown;
  /** Index for array changes */
  index?: number;
  /** Human-readable description of the change */
  description: string;
}

/**
 * Severity level for diff results
 */
export type DiffSeverity = 'info' | 'warning' | 'error';

/**
 * API diff result for a single API call comparison
 */
export interface ApiCallDiffResult {
  /** Request ID being compared */
  requestId: string;
  /** URL of the API call */
  url: string;
  /** HTTP method */
  method: string;
  /** Whether the comparison passed */
  passed: boolean;
  /** Overall severity */
  severity: DiffSeverity;
  /** Differences in request */
  requestDiffs: DiffChange[];
  /** Differences in response */
  responseDiffs: DiffChange[];
  /** Status code changed */
  statusChanged: boolean;
  /** Baseline status */
  baselineStatus?: number;
  /** Actual status */
  actualStatus?: number;
}

/**
 * Complete API diff result
 */
export interface ApiDiffResult {
  /** Individual API call comparisons */
  calls: ApiCallDiffResult[];
  /** API calls in baseline but not in actual */
  missingCalls: CapturedApiCall[];
  /** API calls in actual but not in baseline */
  extraCalls: CapturedApiCall[];
  /** Total number of differences */
  totalDiffs: number;
  /** Whether all comparisons passed */
  passed: boolean;
  /** Summary statistics */
  summary: {
    total: number;
    matched: number;
    different: number;
    missing: number;
    extra: number;
  };
}

/**
 * DOM diff result for structural comparison
 */
export interface DomDiffResult {
  /** Whether the comparison passed */
  passed: boolean;
  /** List of structural differences */
  differences: DomDiffChange[];
  /** Total number of differences */
  totalDiffs: number;
  /** Delta object from jsondiffpatch (for advanced use) */
  delta?: unknown;
  /** Summary statistics */
  summary: {
    added: number;
    removed: number;
    modified: number;
    moved: number;
  };
}

/**
 * Single DOM difference
 */
export interface DomDiffChange {
  /** Type of change */
  kind: DiffKind;
  /** XPath or CSS-like path to the element */
  path: string;
  /** Element tag name */
  tagName?: string;
  /** What changed (attribute, text, structure) */
  changeType: 'attribute' | 'text' | 'element' | 'structure';
  /** Attribute name if attribute changed */
  attributeName?: string;
  /** Previous value */
  oldValue?: unknown;
  /** New value */
  newValue?: unknown;
  /** Human-readable description */
  description: string;
}

/**
 * Visual diff result for screenshot comparison
 */
export interface VisualDiffResult {
  /** Whether the comparison passed (within threshold) */
  passed: boolean;
  /** Percentage of different pixels (0-100) */
  diffPercentage: number;
  /** Number of different pixels */
  diffPixelCount: number;
  /** Total number of pixels compared */
  totalPixels: number;
  /** Diff image as base64 (highlights differences) */
  diffImage?: string;
  /** Dimensions match */
  dimensionsMatch: boolean;
  /** Baseline dimensions */
  baselineDimensions: { width: number; height: number };
  /** Actual dimensions */
  actualDimensions: { width: number; height: number };
  /** Threshold used for comparison */
  threshold: number;
}

/**
 * Combined comparison result
 */
export interface ComparisonResult {
  /** API comparison results */
  api?: ApiDiffResult;
  /** DOM comparison results */
  dom?: DomDiffResult;
  /** Visual comparison results */
  visual?: VisualDiffResult;
  /** Overall pass/fail */
  passed: boolean;
  /** Timestamp of comparison */
  timestamp: number;
  /** Comparison metadata */
  metadata?: {
    baselineId?: string;
    actualId?: string;
    scenarioId?: string;
    stepIndex?: number;
  };
}

/**
 * Configuration for API diff
 */
export interface ApiDiffConfig {
  /** Paths to ignore in comparison (supports wildcards) */
  ignorePaths?: string[];
  /** Whether to compare request bodies */
  compareRequestBodies?: boolean;
  /** Whether to compare response bodies */
  compareResponseBodies?: boolean;
  /** Whether to compare headers */
  compareHeaders?: boolean;
  /** Headers to ignore */
  ignoreHeaders?: string[];
  /** Whether strict mode (fail on any difference) */
  strict?: boolean;
  /** Custom comparator for specific paths */
  customComparators?: Record<string, (a: unknown, b: unknown) => boolean>;
}

/**
 * Configuration for DOM diff
 */
export interface DomDiffConfig {
  /** Attributes to ignore */
  ignoreAttributes?: string[];
  /** Elements to ignore (CSS selectors) */
  ignoreSelectors?: string[];
  /** Whether to compare text content */
  compareText?: boolean;
  /** Whether to compare computed styles */
  compareStyles?: boolean;
  /** Style properties to compare (if compareStyles is true) */
  styleProperties?: string[];
  /** Whether to ignore whitespace-only text differences */
  ignoreWhitespace?: boolean;
  /** Maximum depth to compare */
  maxDepth?: number;
}

/**
 * Configuration for visual diff
 */
export interface VisualDiffConfig {
  /** Pixel difference threshold (0-1, default: 0.1) */
  threshold?: number;
  /** Percentage threshold for pass/fail (default: 1%) */
  diffThreshold?: number;
  /** Whether to include anti-aliased pixels in diff */
  includeAntiAlias?: boolean;
  /** Alpha channel threshold */
  alpha?: number;
  /** Color of diff highlight in output image */
  diffColor?: { r: number; g: number; b: number };
  /** Mask areas to ignore (rectangles) */
  ignoreMasks?: Array<{ x: number; y: number; width: number; height: number }>;
}

/**
 * Default configurations
 */
export const DEFAULT_API_DIFF_CONFIG: Required<ApiDiffConfig> = {
  ignorePaths: [],
  compareRequestBodies: true,
  compareResponseBodies: true,
  compareHeaders: false,
  ignoreHeaders: ['date', 'x-request-id', 'x-correlation-id', 'etag', 'last-modified'],
  strict: false,
  customComparators: {},
};

export const DEFAULT_DOM_DIFF_CONFIG: Required<DomDiffConfig> = {
  ignoreAttributes: ['data-reactid', 'data-react-checksum', 'data-testid'],
  ignoreSelectors: ['script', 'noscript', 'style'],
  compareText: true,
  compareStyles: false,
  styleProperties: [],
  ignoreWhitespace: true,
  maxDepth: Number.POSITIVE_INFINITY,
};

export const DEFAULT_VISUAL_DIFF_CONFIG: Required<VisualDiffConfig> = {
  threshold: 0.1,
  diffThreshold: 1,
  includeAntiAlias: false,
  alpha: 0.1,
  diffColor: { r: 255, g: 0, b: 255 },
  ignoreMasks: [],
};
