/**
 * Selector strategy types in priority order
 * data-testid > role/aria-label > CSS selector > XPath fallback
 */
export type SelectorStrategy = 'testId' | 'role' | 'css' | 'xpath';

/**
 * Base selector interface
 */
export interface BaseSelector {
  /** The selector strategy used */
  strategy: SelectorStrategy;
  /** The actual selector value */
  value: string;
}

/**
 * Test ID selector (highest priority)
 */
export interface TestIdSelector extends BaseSelector {
  strategy: 'testId';
  /** The data-testid value */
  value: string;
}

/**
 * Role-based selector with accessible name
 */
export interface RoleSelector extends BaseSelector {
  strategy: 'role';
  /** ARIA role (e.g., 'button', 'textbox') */
  role: string;
  /** Accessible name (aria-label or text content) */
  name?: string;
}

/**
 * CSS selector
 */
export interface CssSelector extends BaseSelector {
  strategy: 'css';
  value: string;
}

/**
 * XPath selector (fallback)
 */
export interface XPathSelector extends BaseSelector {
  strategy: 'xpath';
  value: string;
}

/**
 * Union of all selector types
 */
export type Selector = TestIdSelector | RoleSelector | CssSelector | XPathSelector;

/**
 * Simplified selector that can be a string or full Selector object
 * String format: "[data-testid=email]" for backward compatibility
 */
export type SelectorInput = string | Selector;
