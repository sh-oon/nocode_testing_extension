// Re-export types from dependencies
export type { ElementInfo } from '@like-cake/selector-engine';
// Export collector
export {
  type CollectorState,
  createEventCollector,
  EventCollector,
  recordManualEvent,
} from './collector';
// Export listeners
export {
  attachClickListener,
  attachInputListener,
  attachKeyboardListener,
  attachNavigationListener,
  attachScrollListener,
  createClickListener,
  createInitialNavigationEvent,
  createInputListener,
  createKeyboardListener,
  createNavigationListener,
  createScrollListener,
  formatKeyCombination,
} from './listeners';
// Export transformer
export {
  mergeTypeSteps,
  transformEventsToSteps,
  transformEventToStep,
} from './transformer';
// Export API transformer
export {
  mergeStepsWithApiAssertions,
  transformApiCallsToSteps,
  transformApiCallToStep,
  type ApiTransformConfig,
} from './api-transformer';
// Export API assertion generator
export {
  DEFAULT_EXCLUDE_PATTERNS,
  generateApiAssertions,
  getRelevantApiCalls,
  type ApiAssertionConfig,
  type ApiAssertionContext,
} from './api-assertion-generator';
// Export types
export type {
  BaseRawEvent,
  CollectorConfig,
  EventHandler,
  InputEventData,
  KeyboardEventData,
  ModifierKeys,
  MouseEventData,
  NavigationEventData,
  RawEvent,
  RawEventType,
  ScrollEventData,
  SelectEventData,
  StepTransformer,
} from './types';
export { DEFAULT_COLLECTOR_CONFIG } from './types';
// Export idle detector
export {
  createIdleDetector,
  IdleDetector,
  type IdleContext,
  type IdleDetectorConfig,
} from './idle-detector';
// Export DOM mutation tracker
export {
  createDomMutationTracker,
  DomMutationTracker,
  generateSelector,
  type DomMutationTrackerConfig,
  type TrackedMutation,
} from './dom-mutation-tracker';
// Export utilities
export {
  debounce,
  deepClone,
  extractElementInfo,
  findInteractiveAncestor,
  generateEventId,
  isInteractiveElement,
  shouldIgnoreElement,
  throttle,
} from './utils';
