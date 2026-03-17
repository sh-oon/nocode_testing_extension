// Types
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

// Forward converters (catalog → step)
export { convertBoundEventToStep } from './event-to-step';
export { convertBoundVerificationToStep } from './verification-to-step';
export { convertModelToXStateMachineConfig } from './model-to-xstate';
export { convertTestPathToScenario } from './path-to-scenario';

// Reverse converters (step → catalog)
export { convertStepToEvent } from './step-to-event';
export { convertStepToVerification } from './step-to-verification';
export { convertScenarioToModel } from './scenario-to-model';

// Binding utilities
export { ElementBindingRegistry, createElementBindingFromSelector, serializeSelector } from './binding-utils';
