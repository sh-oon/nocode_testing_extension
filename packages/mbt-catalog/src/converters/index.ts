// Types

// Binding utilities
export {
  createElementBindingFromSelector,
  ElementBindingRegistry,
  serializeSelector,
} from './binding-utils';
// Forward converters (catalog → step)
export { convertBoundEventToStep } from './event-to-step';
export { convertModelToXStateMachineConfig } from './model-to-xstate';
export { convertTestPathToScenario } from './path-to-scenario';
export { convertScenarioToModel } from './scenario-to-model';
// Reverse converters (step → catalog)
export { convertStepToEvent } from './step-to-event';
export { convertStepToVerification } from './step-to-verification';
export type {
  ConversionResult,
  ScenarioToModelResult,
  StepToEventResult,
  StepToVerificationResult,
  TestPath,
  TestPathNode,
  UnmappedStep,
  UnsupportedMappingError,
  XStateGuard,
  XStateMachineConfig,
  XStateStateConfig,
  XStateTransitionConfig,
} from './types';
export { convertBoundVerificationToStep } from './verification-to-step';
