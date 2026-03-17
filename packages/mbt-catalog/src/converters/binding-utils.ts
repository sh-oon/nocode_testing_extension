/**
 * ElementBinding utilities for reverse mapping
 *
 * Provides creation and deduplication of ElementBindings
 * when converting recorded Steps back into catalog entries.
 */

import type { SelectorInput } from '@like-cake/ast-types';
import type { ElementBinding } from '../types/element-binding';

let counter = 0;
const generateId = (): string => `eb-${Date.now()}-${++counter}`;

/** Serialize a SelectorInput to a stable string key for deduplication */
export const serializeSelector = (selector: SelectorInput): string => {
  if (typeof selector === 'string') return selector;
  switch (selector.strategy) {
    case 'testId':
    case 'css':
    case 'xpath':
      return `${selector.strategy}:${selector.value}`;
    case 'role':
      return `role:${selector.role}:${selector.name ?? ''}`;
    default:
      return JSON.stringify(selector);
  }
};

/** Create an ElementBinding from a SelectorInput */
export const createElementBindingFromSelector = (
  selector: SelectorInput,
  label: string,
  pageUrl = '',
): ElementBinding => ({
  id: generateId(),
  selector,
  candidates: [],
  selectionMethod: 'recording',
  label,
  pageUrl,
  createdAt: Date.now(),
});

/**
 * Registry that deduplicates ElementBindings by selector value.
 * Same selector → same binding ID, so multiple steps referencing
 * the same element share a single binding.
 */
export class ElementBindingRegistry {
  private readonly bindings = new Map<string, ElementBinding>();

  /** Get or create a binding for the given selector */
  getOrCreate(selector: SelectorInput, label: string, pageUrl = ''): ElementBinding {
    const key = serializeSelector(selector);
    const existing = this.bindings.get(key);
    if (existing) return existing;

    const binding = createElementBindingFromSelector(selector, label, pageUrl);
    this.bindings.set(key, binding);
    return binding;
  }

  /** Return all collected bindings */
  getAll(): ElementBinding[] {
    return [...this.bindings.values()];
  }
}
