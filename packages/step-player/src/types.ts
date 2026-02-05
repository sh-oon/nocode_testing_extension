import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type {
  ExecutionSummary,
  Scenario,
  SelectorInput,
  Step,
  StepResult,
} from '@like-cake/ast-types';
import type { DomSnapshot, ScreenshotResult } from '@like-cake/dom-serializer';

/**
 * Player execution state
 */
export type PlayerState = 'idle' | 'playing' | 'paused' | 'stopped' | 'completed' | 'error';

/**
 * Player execution mode
 */
export type PlaybackMode = 'normal' | 'step-by-step' | 'fast';

/**
 * Element found by adapter
 */
export interface FoundElement {
  /** Whether element was found */
  found: boolean;
  /** Element reference (adapter-specific) */
  element?: unknown;
  /** Element bounding rect */
  boundingRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Element is visible */
  isVisible?: boolean;
  /** Element text content */
  textContent?: string;
  /** Element attributes */
  attributes?: Record<string, string>;
}

/**
 * Wait options for adapter methods
 */
export interface WaitOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Polling interval in milliseconds */
  interval?: number;
}

/**
 * Navigation options
 */
export interface NavigationOptions {
  /** Wait until condition */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Click options
 */
export interface ClickOptions {
  /** Mouse button */
  button?: 'left' | 'right' | 'middle';
  /** Number of clicks */
  clickCount?: number;
  /** Position within element */
  position?: { x: number; y: number };
  /** Modifier keys */
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
}

/**
 * Type options
 */
export interface TypeOptions {
  /** Clear existing content */
  clear?: boolean;
  /** Delay between keystrokes */
  delay?: number;
}

/**
 * Scroll options
 */
export interface ScrollOptions {
  /** Scroll behavior */
  behavior?: 'auto' | 'smooth';
  /** Scroll position */
  position?: { x?: number; y?: number };
}

/**
 * Playback adapter interface - abstracts browser interaction
 */
export interface PlaybackAdapter {
  /** Adapter name for identification */
  readonly name: string;

  /**
   * Initialize the adapter
   */
  initialize(): Promise<void>;

  /**
   * Cleanup resources
   */
  destroy(): Promise<void>;

  /**
   * Navigate to a URL
   */
  navigate(url: string, options?: NavigationOptions): Promise<void>;

  /**
   * Find an element using selector
   */
  findElement(selector: SelectorInput, options?: WaitOptions): Promise<FoundElement>;

  /**
   * Click on an element
   */
  click(selector: SelectorInput, options?: ClickOptions): Promise<void>;

  /**
   * Type text into an element
   */
  type(selector: SelectorInput, text: string, options?: TypeOptions): Promise<void>;

  /**
   * Press a keyboard key
   */
  keypress(key: string, selector?: SelectorInput, modifiers?: string[]): Promise<void>;

  /**
   * Hover over an element
   */
  hover(selector: SelectorInput, position?: { x: number; y: number }): Promise<void>;

  /**
   * Scroll to element or position
   */
  scroll(selector?: SelectorInput, options?: ScrollOptions): Promise<void>;

  /**
   * Select option(s) from a dropdown
   */
  select(selector: SelectorInput, values: string | string[]): Promise<void>;

  /**
   * Wait for a condition
   */
  waitForSelector(
    selector: SelectorInput,
    state?: 'visible' | 'hidden' | 'attached' | 'detached',
    options?: WaitOptions
  ): Promise<void>;

  /**
   * Wait for navigation
   */
  waitForNavigation(options?: NavigationOptions): Promise<void>;

  /**
   * Wait for network idle
   */
  waitForNetworkIdle(options?: WaitOptions): Promise<void>;

  /**
   * Wait for specific duration
   */
  wait(duration: number): Promise<void>;

  /**
   * Get current URL
   */
  getCurrentUrl(): Promise<string>;

  /**
   * Get page title
   */
  getTitle(): Promise<string>;

  /**
   * Capture DOM snapshot
   */
  captureSnapshot(options?: {
    computedStyles?: string[];
    fullPage?: boolean;
  }): Promise<DomSnapshot>;

  /**
   * Capture screenshot
   */
  captureScreenshot(options?: { fullPage?: boolean }): Promise<ScreenshotResult>;

  /**
   * Get captured API calls
   */
  getApiCalls(): CapturedApiCall[];

  /**
   * Clear captured API calls
   */
  clearApiCalls(): void;

  /**
   * Start API interception
   */
  startApiInterception(): Promise<void>;

  /**
   * Stop API interception
   */
  stopApiInterception(): Promise<void>;

  /**
   * Check element assertion
   */
  assertElement(
    selector: SelectorInput,
    assertion: {
      type: string;
      value?: unknown;
      name?: string;
      contains?: boolean;
      operator?: string;
    }
  ): Promise<{ passed: boolean; message: string }>;
}

/**
 * Step executor function type
 */
export type StepExecutor<T extends Step = Step> = (
  step: T,
  adapter: PlaybackAdapter,
  context: ExecutionContext
) => Promise<StepExecutionResult>;

/**
 * Context available during step execution
 */
export interface ExecutionContext {
  /** Current scenario being executed */
  scenario: Scenario;
  /** Current step index */
  stepIndex: number;
  /** Variables for substitution */
  variables: Record<string, string | number | boolean>;
  /** Captured API calls so far */
  apiCalls: CapturedApiCall[];
  /** DOM snapshots taken */
  snapshots: Array<{ label: string; snapshot: DomSnapshot; screenshot?: ScreenshotResult }>;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** Default timeout for steps */
  defaultTimeout: number;
  /** Playback speed multiplier */
  speedMultiplier: number;
}

/**
 * Result of executing a single step
 */
export interface StepExecutionResult {
  /** Execution status */
  status: 'passed' | 'failed' | 'skipped';
  /** Execution duration in ms */
  duration: number;
  /** Error if failed */
  error?: {
    message: string;
    stack?: string;
  };
  /** Screenshot captured (if any) */
  screenshot?: ScreenshotResult;
  /** DOM snapshot captured (if any) */
  snapshot?: DomSnapshot;
  /** API response (for assertApi steps) */
  apiResponse?: {
    status: number;
    headers: Record<string, string>;
    body?: unknown;
    responseTime: number;
  };
}

/**
 * Playback result for entire scenario
 */
export interface PlaybackResult {
  /** Scenario ID */
  scenarioId: string;
  /** Step execution results */
  stepResults: StepResult[];
  /** All captured API calls during playback */
  apiCalls: CapturedApiCall[];
  /** All DOM snapshots taken */
  snapshots: Array<{ label: string; snapshot: DomSnapshot; screenshot?: ScreenshotResult }>;
  /** Execution summary */
  summary: ExecutionSummary;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Overall success */
  success: boolean;
}

/**
 * Player configuration
 */
export interface PlayerConfig {
  /** Default timeout for steps (ms) */
  defaultTimeout?: number;
  /** Delay between steps (ms) */
  stepDelay?: number;
  /** Playback speed (1 = normal, 2 = double speed) */
  speed?: number;
  /** Capture screenshots on failure */
  screenshotOnFailure?: boolean;
  /** Continue on step failure */
  continueOnFailure?: boolean;
  /** Maximum retries for flaky steps */
  maxRetries?: number;
  /** Pause on failure */
  pauseOnFailure?: boolean;
}

/**
 * Default player configuration
 */
export const DEFAULT_PLAYER_CONFIG: Required<PlayerConfig> = {
  defaultTimeout: 30000,
  stepDelay: 0,
  speed: 1,
  screenshotOnFailure: true,
  continueOnFailure: false,
  maxRetries: 0,
  pauseOnFailure: false,
};

/**
 * Player event types
 */
export type PlayerEventType =
  | 'stateChange'
  | 'stepStart'
  | 'stepComplete'
  | 'stepError'
  | 'playbackStart'
  | 'playbackComplete'
  | 'playbackError'
  | 'apiCallCaptured'
  | 'snapshotCaptured';

/**
 * Player event data
 */
export interface PlayerEvent {
  type: PlayerEventType;
  timestamp: number;
  data: {
    state?: PlayerState;
    step?: Step;
    stepIndex?: number;
    result?: StepExecutionResult;
    error?: Error;
    apiCall?: CapturedApiCall;
    snapshot?: { label: string; snapshot: DomSnapshot; screenshot?: ScreenshotResult };
    summary?: ExecutionSummary;
  };
}

/**
 * Player event listener
 */
export type PlayerEventListener = (event: PlayerEvent) => void;

/**
 * Player interface
 */
export interface Player {
  /** Current player state */
  readonly state: PlayerState;
  /** Current step index (-1 if not started) */
  readonly currentStepIndex: number;
  /** Load a scenario for playback */
  load(scenario: Scenario): void;
  /** Start or resume playback */
  play(): Promise<PlaybackResult>;
  /** Pause playback */
  pause(): void;
  /** Stop playback */
  stop(): void;
  /** Execute single step and pause */
  step(): Promise<StepExecutionResult | null>;
  /** Jump to specific step */
  goToStep(index: number): void;
  /** Subscribe to events */
  on(event: PlayerEventType, listener: PlayerEventListener): void;
  /** Unsubscribe from events */
  off(event: PlayerEventType, listener: PlayerEventListener): void;
  /** Update configuration */
  updateConfig(config: Partial<PlayerConfig>): void;
  /** Get current playback result (partial) */
  getResult(): Partial<PlaybackResult>;
}
