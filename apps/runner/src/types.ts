import type { ExecutionSummary, Step, StepResult } from '@like-cake/ast-types';
import type { Browser, CDPSession, Page } from 'puppeteer';

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
 * Execution context passed to step executors
 */
export interface ExecutionContext {
  /** Puppeteer page instance */
  page: Page;
  /** Puppeteer browser instance */
  browser: Browser;
  /** CDP session for low-level operations */
  cdpSession: CDPSession;
  /** Runner options */
  options: RunnerOptions;
  /** Scenario variables */
  variables: Record<string, string | number | boolean>;
  /** API observer for tracking requests */
  apiObserver: ApiObserver;
  /** Current step index */
  stepIndex: number;
  /** Scenario ID */
  scenarioId: string;
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
 * API observer interface
 */
export interface ApiObserver {
  /** Start observing API calls */
  start(): void;
  /** Stop observing and return collected calls */
  stop(): ObservedApiCall[];
  /** Find matching API calls */
  findMatching(urlPattern: string, method?: string): ObservedApiCall[];
  /** Wait for a matching API call */
  waitFor(urlPattern: string, method?: string, timeout?: number): Promise<ObservedApiCall>;
  /** Clear collected calls */
  clear(): void;
}

/**
 * DOM snapshot data
 */
export interface DomSnapshot {
  /** Snapshot label */
  label: string;
  /** Captured documents */
  documents: unknown[];
  /** Captured strings */
  strings: string[];
  /** Timestamp */
  timestamp: number;
  /** Screenshot path if captured */
  screenshotPath?: string;
}

/**
 * Step executor function signature
 */
export type StepExecutor<T extends Step = Step> = (
  step: T,
  context: ExecutionContext
) => Promise<Partial<StepResult>>;

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
  /** Captured DOM snapshots */
  snapshots: DomSnapshot[];
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
