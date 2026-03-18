import type { ExecutionSummary, StepResult } from '@like-cake/ast-types';
import type { DomSnapshot, ScreenshotResult } from '@like-cake/dom-serializer';

// Re-export StepResult for use in other modules
export type { StepResult };

/**
 * Runner configuration options
 */
export interface RunnerOptions {
  /** Browser launch options */
  headless?: boolean;
  /** Default timeout for steps (ms) */
  defaultTimeout?: number;
  /** Slow motion delay between actions (ms) */
  slowMo?: number;
  /** Directory to save screenshots */
  screenshotDir?: string;
  /** Directory to save DOM snapshots */
  snapshotDir?: string;
  /** Whether to capture screenshots on failure */
  screenshotOnFailure?: boolean;
  /** Base URL for relative navigations */
  baseUrl?: string;
  /** Viewport size override */
  viewport?: { width: number; height: number };
  /** Whether to continue execution on step failure */
  continueOnFailure?: boolean;
  /** Custom user agent */
  userAgent?: string;
}

/**
 * API request/response data
 */
export interface ApiRequestData {
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: number;
}

export interface ApiResponseData {
  url: string;
  status: number;
  headers: Record<string, string>;
  body?: unknown;
  responseTime: number;
  timestamp: number;
}

/**
 * Observed API call (request + response pair)
 */
export interface ObservedApiCall {
  request: ApiRequestData;
  response?: ApiResponseData;
}

/**
 * Labeled DOM snapshot captured during scenario execution.
 * Uses the canonical DomSnapshot from @like-cake/dom-serializer.
 */
export interface LabeledSnapshot {
  label: string;
  snapshot: DomSnapshot;
  screenshot?: ScreenshotResult;
}

/**
 * Scenario execution result
 */
export interface ScenarioExecutionResult {
  /** Scenario info */
  scenarioId: string;
  scenarioName?: string;
  /** Step-by-step results */
  stepResults: StepResult[];
  /** Execution summary */
  summary: ExecutionSummary;
  /** Captured DOM snapshots (canonical DomSnapshot from @like-cake/dom-serializer) */
  snapshots: LabeledSnapshot[];
  /** Observed API calls */
  apiCalls: ObservedApiCall[];
  /** Execution start time */
  startedAt: number;
  /** Execution end time */
  endedAt: number;
}

/**
 * CLI run options
 */
export interface CliRunOptions extends RunnerOptions {
  /** Scenario file path or URL */
  scenario: string;
  /** Output format */
  output?: 'json' | 'console' | 'junit';
  /** Output file path */
  outputFile?: string;
  /** Backend API URL for fetching scenarios */
  apiUrl?: string;
}
