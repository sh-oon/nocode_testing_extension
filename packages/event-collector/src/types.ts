import type { Step } from '@like-cake/ast-types';
import type { ElementInfo } from '@like-cake/selector-engine';

/**
 * Raw event types that can be collected
 */
export type RawEventType =
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'blur'
  | 'focus'
  | 'keydown'
  | 'keyup'
  | 'keypress'
  | 'submit'
  | 'scroll'
  | 'select'
  | 'mouseenter'
  | 'mouseleave'
  | 'navigation';

/**
 * Base raw event interface
 */
export interface BaseRawEvent {
  /** Event type */
  type: RawEventType;
  /** Timestamp when event occurred */
  timestamp: number;
  /** Target element info */
  target: ElementInfo;
  /** URL where event occurred */
  url: string;
  /** Unique event ID */
  id: string;
}

/**
 * Mouse event data
 */
export interface MouseEventData extends BaseRawEvent {
  type: 'click' | 'dblclick';
  /** Mouse button (0: left, 1: middle, 2: right) */
  button: number;
  /** Click position relative to element */
  position: { x: number; y: number };
  /** Modifier keys held during click */
  modifiers: ModifierKeys;
}

/**
 * Input/Change event data
 */
export interface InputEventData extends BaseRawEvent {
  type: 'input' | 'change' | 'blur';
  /** Current input value */
  value: string;
  /** Previous input value (if available) */
  previousValue?: string;
  /** Input type (text, password, email, etc.) */
  inputType?: string;
  /** Whether this is a sensitive field (password, etc.) */
  isSensitive: boolean;
}

/**
 * Keyboard event data
 */
export interface KeyboardEventData extends BaseRawEvent {
  type: 'keydown' | 'keyup' | 'keypress';
  /** Key pressed */
  key: string;
  /** Key code */
  code: string;
  /** Modifier keys held */
  modifiers: ModifierKeys;
}

/**
 * Scroll event data
 */
export interface ScrollEventData extends BaseRawEvent {
  type: 'scroll';
  /** Scroll position */
  position: { x: number; y: number };
  /** Scroll delta */
  delta?: { x: number; y: number };
}

/**
 * Select (dropdown) event data
 */
export interface SelectEventData extends BaseRawEvent {
  type: 'select';
  /** Selected value(s) */
  values: string[];
  /** Selected option text(s) */
  optionTexts: string[];
}

/**
 * Navigation event data
 */
export interface NavigationEventData extends Omit<BaseRawEvent, 'target'> {
  type: 'navigation';
  /** New URL */
  toUrl: string;
  /** Previous URL */
  fromUrl?: string;
  /** Navigation type */
  navigationType: 'push' | 'replace' | 'pop' | 'reload';
  /** Target is optional for navigation events */
  target?: ElementInfo;
}

/**
 * Modifier keys state
 */
export interface ModifierKeys {
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

/**
 * Union of all raw event types
 */
export type RawEvent =
  | MouseEventData
  | InputEventData
  | KeyboardEventData
  | ScrollEventData
  | SelectEventData
  | NavigationEventData;

/**
 * Event collector configuration
 */
export interface CollectorConfig {
  /** Whether to capture click events */
  captureClicks: boolean;
  /** Whether to capture input events */
  captureInputs: boolean;
  /** Whether to capture keyboard events */
  captureKeyboard: boolean;
  /** Whether to capture scroll events */
  captureScroll: boolean;
  /** Whether to capture navigation events */
  captureNavigation: boolean;
  /** Debounce delay for input events (ms) */
  inputDebounceMs: number;
  /** Debounce delay for scroll events (ms) */
  scrollDebounceMs: number;
  /** Selector for elements to ignore */
  ignoreSelectors: string[];
  /** Custom test id attribute */
  testIdAttribute: string;
}

/**
 * Default collector configuration
 */
export const DEFAULT_COLLECTOR_CONFIG: CollectorConfig = {
  captureClicks: true,
  captureInputs: true,
  captureKeyboard: true,
  captureScroll: true,
  captureNavigation: true,
  inputDebounceMs: 300,
  scrollDebounceMs: 150,
  ignoreSelectors: [],
  testIdAttribute: 'data-testid',
};

/**
 * Event handler callback
 */
export type EventHandler = (event: RawEvent) => void;

/**
 * Step transformer function
 */
export type StepTransformer = (event: RawEvent) => Step | null;
