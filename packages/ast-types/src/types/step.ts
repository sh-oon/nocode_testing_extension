import type { SelectorInput } from './selector';

/**
 * All supported step types
 */
export type StepType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'keypress'
  | 'wait'
  | 'hover'
  | 'scroll'
  | 'select'
  | 'assertApi'
  | 'assertElement'
  | 'snapshotDom';

/**
 * Base step interface with common properties
 */
export interface BaseStep {
  /** Unique step identifier (auto-generated if not provided) */
  id?: string;
  /** Step type discriminator */
  type: StepType;
  /** Human-readable description */
  description?: string;
  /** Timeout override for this step (ms) */
  timeout?: number;
  /** Whether to continue on failure */
  optional?: boolean;
}

// ============================================
// UI Action Steps
// ============================================

/**
 * Navigate to a URL
 */
export interface NavigateStep extends BaseStep {
  type: 'navigate';
  /** URL to navigate to (absolute or relative) */
  url: string;
  /** Wait for specific navigation state */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
}

/**
 * Click on an element
 */
export interface ClickStep extends BaseStep {
  type: 'click';
  /** Target element selector */
  selector: SelectorInput;
  /** Click type */
  button?: 'left' | 'right' | 'middle';
  /** Number of clicks */
  clickCount?: number;
  /** Modifier keys held during click */
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  /** Position within element to click */
  position?: { x: number; y: number };
}

/**
 * Type text into an input
 */
export interface TypeStep extends BaseStep {
  type: 'type';
  /** Target element selector */
  selector: SelectorInput;
  /** Text to type */
  value: string;
  /** Clear existing content before typing */
  clear?: boolean;
  /** Delay between keystrokes (ms) */
  delay?: number;
  /** Whether value contains sensitive data (will be masked in logs) */
  sensitive?: boolean;
}

/**
 * Press a keyboard key
 */
export interface KeypressStep extends BaseStep {
  type: 'keypress';
  /** Key to press (e.g., 'Enter', 'Tab', 'Escape') */
  key: string;
  /** Target element selector (optional, uses focused element if not provided) */
  selector?: SelectorInput;
  /** Modifier keys held during keypress */
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
}

/**
 * Wait for a condition
 */
export interface WaitStep extends BaseStep {
  type: 'wait';
  /** Wait strategy */
  strategy: 'time' | 'selector' | 'navigation' | 'networkIdle' | 'domStable';
  /** Duration to wait (for 'time' strategy) */
  duration?: number;
  /** Selector to wait for (for 'selector' strategy) */
  selector?: SelectorInput;
  /** Visibility state to wait for */
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  /** DOM stability threshold in ms (for 'domStable' strategy). Default: 1500 */
  stabilityThreshold?: number;
}

/**
 * Hover over an element
 */
export interface HoverStep extends BaseStep {
  type: 'hover';
  /** Target element selector */
  selector: SelectorInput;
  /** Position within element */
  position?: { x: number; y: number };
}

/**
 * Scroll to element or position
 */
export interface ScrollStep extends BaseStep {
  type: 'scroll';
  /** Target element selector (optional) */
  selector?: SelectorInput;
  /** Scroll position */
  position?: { x?: number; y?: number };
  /** Scroll behavior */
  behavior?: 'auto' | 'smooth';
}

/**
 * Select option from dropdown
 */
export interface SelectStep extends BaseStep {
  type: 'select';
  /** Target select element */
  selector: SelectorInput;
  /** Option value(s) to select */
  values: string | string[];
}

// ============================================
// Assertion Steps
// ============================================

/**
 * HTTP method types for API assertions
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * API request matching criteria
 */
export interface ApiMatch {
  /** URL pattern (string or regex pattern) */
  url: string;
  /** HTTP method */
  method?: HttpMethod;
  /** Match as regex pattern */
  urlIsRegex?: boolean;
}

/**
 * Expected API response criteria
 */
export interface ApiExpectation {
  /** Expected status code or range */
  status?: number | { min: number; max: number };
  /** JSONPath assertions on response body */
  jsonPath?: Record<string, unknown>;
  /** Expected headers */
  headers?: Record<string, string>;
  /** Maximum response time (ms) */
  responseTime?: number;
}

/**
 * Assert API request/response
 */
export interface AssertApiStep extends BaseStep {
  type: 'assertApi';
  /** Request matching criteria */
  match: ApiMatch;
  /** Expected response criteria */
  expect?: ApiExpectation;
  /** Wait for matching request within timeout */
  waitFor?: boolean;
}

/**
 * Element assertion types
 */
export type ElementAssertion =
  | { type: 'visible' }
  | { type: 'hidden' }
  | { type: 'exists' }
  | { type: 'notExists' }
  | { type: 'text'; value: string; contains?: boolean }
  | { type: 'attribute'; name: string; value?: string }
  | { type: 'count'; value: number; operator?: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' };

/**
 * Assert element state
 */
export interface AssertElementStep extends BaseStep {
  type: 'assertElement';
  /** Target element selector */
  selector: SelectorInput;
  /** Expected state */
  assertion: ElementAssertion;
}

// ============================================
// Observation Steps
// ============================================

/**
 * Capture DOM snapshot
 */
export interface SnapshotDomStep extends BaseStep {
  type: 'snapshotDom';
  /** Label for the snapshot */
  label: string;
  /** Computed styles to capture */
  computedStyles?: string[];
  /** Whether to include full page or visible viewport */
  fullPage?: boolean;
  /** Whether to capture screenshot as well */
  includeScreenshot?: boolean;
}

// ============================================
// Union Types
// ============================================

/**
 * Union of all step types
 */
export type Step =
  | NavigateStep
  | ClickStep
  | TypeStep
  | KeypressStep
  | WaitStep
  | HoverStep
  | ScrollStep
  | SelectStep
  | AssertApiStep
  | AssertElementStep
  | SnapshotDomStep;

/**
 * UI Action step types (user interactions)
 */
export type UIActionStep =
  | NavigateStep
  | ClickStep
  | TypeStep
  | KeypressStep
  | WaitStep
  | HoverStep
  | ScrollStep
  | SelectStep;

/**
 * Assertion step types
 */
export type AssertionStep = AssertApiStep | AssertElementStep;

/**
 * Observation step types
 */
export type ObservationStep = SnapshotDomStep;
