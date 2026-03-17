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
  ApiObserver,
  ApiRequestData,
  ApiResponseData,
  CliRunOptions,
  DomSnapshot,
  ObservedApiCall,
  RunnerOptions,
  ScenarioExecutionResult,
} from './types';
