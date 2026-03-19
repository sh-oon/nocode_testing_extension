/**
 * @like-cake/step-player
 *
 * Step playback engine for Extension and Puppeteer.
 * Executes recorded scenarios with support for pause/resume and step-by-step debugging.
 */

// Actionability
export {
  ACTION_CHECKS,
  type ActionabilityChecks,
  type ActionabilityFailure,
  type ActionabilityResult,
  checkActionability,
} from './actionability';
// Adapters
export { ExtensionAdapter } from './adapters/extension-adapter';
export {
  type CDPSessionLike,
  PuppeteerAdapter,
  type PuppeteerAdapterConfig,
  type PuppeteerPageLike,
} from './adapters/puppeteer-adapter';
// Executors
export {
  executeAssertApi,
  executeAssertElement,
  executeAssertPage,
  executeAssertStyle,
  executeClick,
  executeDragAndDrop,
  executeFileUpload,
  executeHistoryBack,
  executeHistoryForward,
  executeHover,
  executeKeypress,
  executeMouseOut,
  executeNavigate,
  executeScroll,
  executeSelect,
  executeSnapshotDom,
  executeStep,
  executeType,
  executeWait,
  getExecutor,
  registerExecutor,
} from './executors';
// Player
export { createPlayer, StepPlayer } from './player';
// Types
export type {
  ClickOptions,
  ExecutionContext,
  FoundElement,
  NavigationOptions,
  PlaybackAdapter,
  PlaybackMode,
  PlaybackResult,
  Player,
  PlayerConfig,
  PlayerEvent,
  PlayerEventListener,
  PlayerEventType,
  PlayerState,
  ScrollOptions,
  StepExecutionResult,
  StepExecutor,
  TypeOptions,
  WaitOptions,
} from './types';
export { DEFAULT_PLAYER_CONFIG } from './types';
