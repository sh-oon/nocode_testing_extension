import type { ScenarioMeta } from './meta';
import type { Step } from './step';

/**
 * Complete test scenario
 */
export interface Scenario {
  /** Unique scenario identifier */
  id: string;
  /** Human-readable scenario name */
  name?: string;
  /** Detailed description */
  description?: string;
  /** Scenario metadata */
  meta: ScenarioMeta;
  /** Ordered list of steps */
  steps: Step[];
  /** Setup steps to run before main steps */
  setup?: Step[];
  /** Teardown steps to run after main steps */
  teardown?: Step[];
  /** Variables that can be used in step values */
  variables?: Record<string, string | number | boolean>;
}

/**
 * Minimal scenario for quick creation
 */
export interface ScenarioInput {
  id?: string;
  name?: string;
  description?: string;
  meta: Partial<ScenarioMeta> & Pick<ScenarioMeta, 'url' | 'viewport'>;
  steps: Step[];
  setup?: Step[];
  teardown?: Step[];
  variables?: Record<string, string | number | boolean>;
}

/**
 * Scenario with execution results
 */
export interface ScenarioResult extends Scenario {
  /** Step-by-step execution results */
  stepResults: StepResult[];
  /** Overall execution summary */
  summary: ExecutionSummary;
}

/**
 * Individual step execution result
 */
export interface StepResult {
  /** Reference to step ID */
  stepId: string;
  /** Step index in the scenario */
  index: number;
  /** Execution status */
  status: 'passed' | 'failed' | 'skipped';
  /** Execution duration in milliseconds */
  duration: number;
  /** Error information if failed */
  error?: {
    message: string;
    stack?: string;
  };
  /** Screenshot path if captured */
  screenshotPath?: string;
  /** DOM snapshot path if captured */
  snapshotPath?: string;
  /** API response data if assertApi step */
  apiResponse?: {
    status: number;
    headers: Record<string, string>;
    body?: unknown;
    responseTime: number;
  };
}

/**
 * Execution summary
 */
export interface ExecutionSummary {
  /** Total number of steps */
  totalSteps: number;
  /** Number of passed steps */
  passed: number;
  /** Number of failed steps */
  failed: number;
  /** Number of skipped steps */
  skipped: number;
  /** Total execution duration */
  duration: number;
  /** Whether scenario passed overall */
  success: boolean;
}
