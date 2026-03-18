// Core runner

// Comparison runner (step-player + diff-engine integration)
export {
  type Baseline,
  type ComparisonResult,
  ComparisonRunner,
  type ComparisonRunnerOptions,
  captureBaseline,
  runScenarioWithComparison,
} from './comparison-runner';
// Reporters
export {
  type ComparisonJsonReport,
  generateComparisonJsonReport,
  generateJsonReport,
  generateJunitReport,
  reportAllComparisonsToConsole,
  reportAllToConsole,
  reportComparisonToConsole,
  reportToConsole,
  writeComparisonJsonReport,
  writeJsonReport,
  writeJunitReport,
} from './reporters';
export { type RunnerEventListener, runScenario, ScenarioRunner } from './runner';
// Types
export type {
  ApiRequestData,
  ApiResponseData,
  CliRunOptions,
  LabeledSnapshot,
  ObservedApiCall,
  RunnerOptions,
  ScenarioExecutionResult,
} from './types';
// Re-export canonical DomSnapshot from dom-serializer for downstream consumers
export type { DomSnapshot } from '@like-cake/dom-serializer';
