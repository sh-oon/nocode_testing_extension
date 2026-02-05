// Core runner
export { runScenario, ScenarioRunner } from './runner';

// Comparison runner (step-player + diff-engine integration)
export {
  captureBaseline,
  ComparisonRunner,
  runScenarioWithComparison,
  type Baseline,
  type ComparisonResult,
  type ComparisonRunnerOptions,
} from './comparison-runner';

// Executors
export {
  executeAssertApi,
  executeAssertElement,
  executeClick,
  executeHover,
  executeKeypress,
  executeNavigate,
  executeScroll,
  executeSelect,
  executeSnapshotDom,
  executeStep,
  executeType,
  executeWait,
} from './executors';
// Observers
export { createApiObserver } from './observers';
// Reporters
export {
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
  type ComparisonJsonReport,
} from './reporters';
// Types
export type {
  ApiObserver,
  ApiRequestData,
  ApiResponseData,
  CliRunOptions,
  DomSnapshot,
  ExecutionContext,
  ObservedApiCall,
  RunnerOptions,
  ScenarioExecutionResult,
  StepExecutor,
} from './types';
