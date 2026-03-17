/**
 * Element binding types
 *
 * ElementBinding connects a catalog entry to a real DOM element.
 * Bindings are shared at the model level so the same "로그인 버튼" can be
 * referenced by multiple states and transitions.
 */

import type { SelectorCandidate, SelectorInput } from '@like-cake/ast-types';

/** How the element was selected */
export type ElementSelectionMethod = 'cdpInspect' | 'recording' | 'manual';

/** Accessibility information collected during CDP inspect */
export interface AccessibilityInfo {
  /** ARIA role (e.g., 'button', 'textbox') */
  role?: string;
  /** Accessible name */
  name?: string;
  /** Whether the element can receive focus */
  focusable: boolean;
  /** Whether the element is keyboard-accessible */
  keyboardAccessible: boolean;
  /** ARIA attributes on the element */
  ariaAttributes: Record<string, string>;
  /** Computed contrast ratio (for text elements) */
  contrastRatio?: number;
  /** Accessibility violations found */
  violations: Array<{
    rule: string;
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    message: string;
  }>;
}

/** Connects a catalog entry to an actual DOM element */
export interface ElementBinding {
  /** Unique binding identifier */
  id: string;
  /** Primary selector for locating the element */
  selector: SelectorInput;
  /** Alternative selector candidates ranked by stability */
  candidates: SelectorCandidate[];
  /** How the element was originally selected */
  selectionMethod: ElementSelectionMethod;
  /** Human-readable label (e.g., "로그인 버튼", "이메일 입력") */
  label: string;
  /** Truncated outer HTML for preview */
  elementHtml?: string;
  /** Accessibility audit results */
  accessibility?: AccessibilityInfo;
  /** URL of the page where the element was captured */
  pageUrl: string;
  /** Creation timestamp */
  createdAt: number;
}
