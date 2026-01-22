import type { EventHandler, ScrollEventData } from '../types';
import { extractElementInfo, shouldIgnoreElement } from '../utils/element-info';
import { debounce, generateEventId } from '../utils/helpers';

/**
 * Create a scroll event listener
 */
export function createScrollListener(
  handler: EventHandler,
  options: {
    ignoreSelectors: string[];
    debounceMs: number;
  }
): (event: Event) => void {
  let lastScrollPosition = { x: 0, y: 0 };

  const processScrollEvent = (event: Event) => {
    const target = event.target as Element | Document;

    let scrollElement: Element;
    let position: { x: number; y: number };

    if (target === document || target === document.documentElement) {
      // Document scroll
      scrollElement = document.documentElement;
      position = {
        x: window.scrollX,
        y: window.scrollY,
      };
    } else if (target instanceof Element) {
      // Element scroll
      scrollElement = target;
      position = {
        x: target.scrollLeft,
        y: target.scrollTop,
      };

      // Check if should be ignored
      if (shouldIgnoreElement(scrollElement, options.ignoreSelectors)) {
        return;
      }
    } else {
      return;
    }

    // Calculate delta
    const delta = {
      x: position.x - lastScrollPosition.x,
      y: position.y - lastScrollPosition.y,
    };

    lastScrollPosition = position;

    // Ignore very small scrolls
    if (Math.abs(delta.x) < 10 && Math.abs(delta.y) < 10) {
      return;
    }

    const elementInfo = extractElementInfo(scrollElement);

    const rawEvent: ScrollEventData = {
      type: 'scroll',
      id: generateEventId(),
      timestamp: Date.now(),
      target: elementInfo,
      url: window.location.href,
      position,
      delta,
    };

    handler(rawEvent);
  };

  return debounce(processScrollEvent, options.debounceMs);
}

/**
 * Attach scroll listener to document
 */
export function attachScrollListener(
  handler: EventHandler,
  options: {
    ignoreSelectors: string[];
    debounceMs: number;
  }
): () => void {
  const listener = createScrollListener(handler, options);

  // Listen on window for document scrolls
  window.addEventListener('scroll', listener, { capture: true, passive: true });

  return () => {
    window.removeEventListener('scroll', listener, { capture: true });
  };
}
