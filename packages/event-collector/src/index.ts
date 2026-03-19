// Re-export types from dependencies
export type { ElementInfo } from '@like-cake/selector-engine';
// Export API assertion generator
export {
  type ApiAssertionConfig,
  type ApiAssertionContext,
  DEFAULT_EXCLUDE_PATTERNS,
  generateApiAssertions,
  getRelevantApiCalls,
} from './api-assertion-generator';
// Export API transformer
export {
  type ApiTransformConfig,
  mergeStepsWithApiAssertions,
  transformApiCallsToSteps,
  transformApiCallToStep,
} from './api-transformer';
// Export collector
export {
  type CollectorState,
  createEventCollector,
  EventCollector,
  recordManualEvent,
} from './collector';
// Export DOM mutation tracker
export {
  createDomMutationTracker,
  DomMutationTracker,
  type DomMutationTrackerConfig,
  generateSelector,
  type TrackedMutation,
} from './dom-mutation-tracker';
// Export idle detector
export {
  createIdleDetector,
  type IdleContext,
  IdleDetector,
  type IdleDetectorConfig,
} from './idle-detector';
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
