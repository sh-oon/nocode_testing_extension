import type { Step } from '@like-cake/ast-types';
import {
  attachClickListener,
  attachInputListener,
  attachKeyboardListener,
  attachNavigationListener,
  attachScrollListener,
  createInitialNavigationEvent,
} from './listeners';
import { mergeTypeSteps, transformEventsToSteps, transformEventToStep } from './transformer';
import type { CollectorConfig, EventHandler, RawEvent } from './types';
import { DEFAULT_COLLECTOR_CONFIG } from './types';

/**
 * Event collector state
 */
export type CollectorState = 'idle' | 'recording' | 'paused';

/**
 * Event collector for recording user interactions
 */
export class EventCollector {
  private config: CollectorConfig;
  private state: CollectorState = 'idle';
  private events: RawEvent[] = [];
  private cleanupFunctions: Array<() => void> = [];
  private eventHandler: EventHandler;
  private externalHandlers: Set<EventHandler> = new Set();

  constructor(config: Partial<CollectorConfig> = {}) {
    this.config = { ...DEFAULT_COLLECTOR_CONFIG, ...config };
    this.eventHandler = this.handleEvent.bind(this);
  }

  /**
   * Start recording events
   */
  start(): void {
    if (this.state === 'recording') {
      return;
    }

    this.state = 'recording';
    this.attachListeners();

    // Emit initial navigation event
    if (this.config.captureNavigation) {
      const initialNav = createInitialNavigationEvent();
      this.handleEvent(initialNav);
    }
  }

  /**
   * Stop recording events
   */
  stop(): void {
    if (this.state === 'idle') {
      return;
    }

    this.state = 'idle';
    this.detachListeners();
  }

  /**
   * Pause recording (keep listeners but don't store events)
   */
  pause(): void {
    if (this.state !== 'recording') {
      return;
    }
    this.state = 'paused';
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.state !== 'paused') {
      return;
    }
    this.state = 'recording';
  }

  /**
   * Get current collector state
   */
  getState(): CollectorState {
    return this.state;
  }

  /**
   * Get all recorded raw events
   */
  getEvents(): RawEvent[] {
    return [...this.events];
  }

  /**
   * Get events transformed to AST steps
   */
  getSteps(): Step[] {
    const steps = transformEventsToSteps(this.events);
    return mergeTypeSteps(steps);
  }

  /**
   * Clear all recorded events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Add an external event handler
   */
  onEvent(handler: EventHandler): () => void {
    this.externalHandlers.add(handler);
    return () => {
      this.externalHandlers.delete(handler);
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CollectorConfig>): void {
    const wasRecording = this.state === 'recording';

    if (wasRecording) {
      this.stop();
    }

    this.config = { ...this.config, ...config };

    if (wasRecording) {
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): CollectorConfig {
    return { ...this.config };
  }

  /**
   * Handle incoming event
   */
  private handleEvent(event: RawEvent): void {
    if (this.state !== 'recording') {
      return;
    }

    this.events.push(event);

    // Notify external handlers
    for (const handler of this.externalHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    }
  }

  /**
   * Attach all event listeners based on configuration
   */
  private attachListeners(): void {
    const { config, eventHandler } = this;

    if (config.captureClicks) {
      const cleanup = attachClickListener(eventHandler, {
        ignoreSelectors: config.ignoreSelectors,
        testIdAttribute: config.testIdAttribute,
      });
      this.cleanupFunctions.push(cleanup);
    }

    if (config.captureInputs) {
      const cleanup = attachInputListener(eventHandler, {
        ignoreSelectors: config.ignoreSelectors,
        debounceMs: config.inputDebounceMs,
      });
      this.cleanupFunctions.push(cleanup);
    }

    if (config.captureKeyboard) {
      const cleanup = attachKeyboardListener(eventHandler, {
        ignoreSelectors: config.ignoreSelectors,
      });
      this.cleanupFunctions.push(cleanup);
    }

    if (config.captureScroll) {
      const cleanup = attachScrollListener(eventHandler, {
        ignoreSelectors: config.ignoreSelectors,
        debounceMs: config.scrollDebounceMs,
      });
      this.cleanupFunctions.push(cleanup);
    }

    if (config.captureNavigation) {
      const cleanup = attachNavigationListener(eventHandler);
      this.cleanupFunctions.push(cleanup);
    }
  }

  /**
   * Detach all event listeners
   */
  private detachListeners(): void {
    for (const cleanup of this.cleanupFunctions) {
      cleanup();
    }
    this.cleanupFunctions = [];
  }
}

/**
 * Create a new event collector instance
 */
export function createEventCollector(config: Partial<CollectorConfig> = {}): EventCollector {
  return new EventCollector(config);
}

/**
 * Quick function to record a single event manually
 */
export function recordManualEvent(event: RawEvent): Step | null {
  return transformEventToStep(event);
}
