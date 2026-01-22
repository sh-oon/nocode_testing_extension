import type { EventHandler, ModifierKeys, MouseEventData } from '../types';
import {
  extractElementInfo,
  findInteractiveAncestor,
  shouldIgnoreElement,
} from '../utils/element-info';
import { generateEventId } from '../utils/helpers';

/**
 * Create a click event listener
 */
export function createClickListener(
  handler: EventHandler,
  options: {
    ignoreSelectors: string[];
    testIdAttribute: string;
  }
): (event: MouseEvent) => void {
  return (event: MouseEvent) => {
    const target = event.target as Element;
    if (!target) return;

    // Find the interactive element (might be an ancestor)
    const interactiveTarget = findInteractiveAncestor(target) || target;

    // Check if should be ignored
    if (shouldIgnoreElement(interactiveTarget, options.ignoreSelectors)) {
      return;
    }

    // Extract element info
    const elementInfo = extractElementInfo(interactiveTarget);

    // Get modifier keys
    const modifiers: ModifierKeys = {
      alt: event.altKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      shift: event.shiftKey,
    };

    // Get click position relative to element
    const rect = interactiveTarget.getBoundingClientRect();
    const position = {
      x: Math.round(event.clientX - rect.left),
      y: Math.round(event.clientY - rect.top),
    };

    const rawEvent: MouseEventData = {
      type: event.detail === 2 ? 'dblclick' : 'click',
      id: generateEventId(),
      timestamp: Date.now(),
      target: elementInfo,
      url: window.location.href,
      button: event.button,
      position,
      modifiers,
    };

    handler(rawEvent);
  };
}

/**
 * Attach click listener to document
 */
export function attachClickListener(
  handler: EventHandler,
  options: {
    ignoreSelectors: string[];
    testIdAttribute: string;
  }
): () => void {
  const listener = createClickListener(handler, options);

  document.addEventListener('click', listener, { capture: true });

  // Return cleanup function
  return () => {
    document.removeEventListener('click', listener, { capture: true });
  };
}
