import type { Selector, SelectorCandidate, SelectorStrategy } from '@like-cake/ast-types';

/**
 * Information extracted from a DOM element for selector generation
 * This is a serializable representation that can be passed from browser context
 */
export interface ElementInfo {
  /** Element tag name (lowercase) */
  tagName: string;
  /** Element id attribute */
  id?: string;
  /** Element class names */
  classNames: string[];
  /** data-testid attribute value */
  testId?: string;
  /** ARIA role (explicit or implicit) */
  role?: string;
  /** Accessible name (aria-label, aria-labelledby, or computed) */
  ariaLabel?: string;
  /** Element text content (trimmed, limited length) */
  textContent?: string;
  /** Element attributes (key-value pairs) */
  attributes: Record<string, string>;
  /** Parent element info for context (limited depth) */
  parent?: ElementInfo;
  /** Index among siblings with same tag */
  siblingIndex?: number;
  /** Total siblings with same tag */
  siblingCount?: number;
  /** XPath from document root */
  xpath?: string;
  /** Multiple selector candidates with stability scores (populated by collector) */
  selectorCandidates?: SelectorCandidate[];
  /** Truncated outer HTML for preview (populated by collector) */
  elementHtml?: string;
}

/**
 * Options for selector generation
 */
export interface GeneratorOptions {
  /** Maximum depth for parent traversal */
  maxDepth?: number;
  /** Prefer shorter selectors */
  preferShort?: boolean;
  /** Custom test id attribute name (default: 'data-testid') */
  testIdAttribute?: string;
  /** Classes to ignore (e.g., dynamic classes) */
  ignoreClasses?: string[];
  /** Attributes to ignore */
  ignoreAttributes?: string[];
}

/**
 * Result of selector generation with confidence score
 */
export interface SelectorResult {
  /** Generated selector */
  selector: Selector;
  /** Confidence score (0-100) */
  score: number;
  /** Whether the selector is unique on the page */
  isUnique: boolean;
  /** Human-readable description of the selector */
  description: string;
}

/**
 * Selector generator interface
 */
export interface SelectorGenerator {
  /** Strategy type this generator produces */
  readonly strategy: SelectorStrategy;
  /** Generate a selector from element info */
  generate(element: ElementInfo, options?: GeneratorOptions): SelectorResult | null;
  /** Check if this generator can handle the element */
  canGenerate(element: ElementInfo): boolean;
}

/**
 * Default generator options
 */
export const DEFAULT_GENERATOR_OPTIONS: Required<GeneratorOptions> = {
  maxDepth: 5,
  preferShort: true,
  testIdAttribute: 'data-testid',
  ignoreClasses: [],
  ignoreAttributes: ['style', 'class', 'id'],
};
