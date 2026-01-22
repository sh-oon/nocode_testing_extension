import type { EventHandler, KeyboardEventData, ModifierKeys } from '../types';
import { extractElementInfo, shouldIgnoreElement } from '../utils/element-info';
import { generateEventId } from '../utils/helpers';

/**
 * Keys that should always be captured
 */
const CAPTURE_KEYS = [
  'Enter',
  'Tab',
  'Escape',
  'Backspace',
  'Delete',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
];

/**
 * Check if a key event should be captured
 */
function shouldCaptureKey(event: KeyboardEvent): boolean {
  // Always capture special keys
  if (CAPTURE_KEYS.includes(event.key)) {
    return true;
  }

  // Capture keyboard shortcuts (Ctrl/Cmd + key)
  if (event.ctrlKey || event.metaKey) {
    return true;
  }

  // Don't capture regular typing in input fields
  const target = event.target as HTMLElement;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  ) {
    return false;
  }

  return false;
}

/**
 * Create a keyboard event listener
 */
export function createKeyboardListener(
  handler: EventHandler,
  options: {
    ignoreSelectors: string[];
  }
): (event: KeyboardEvent) => void {
  return (event: KeyboardEvent) => {
    // Only capture keydown for most purposes
    if (event.type !== 'keydown') return;

    // Check if this key should be captured
    if (!shouldCaptureKey(event)) return;

    const target = event.target as Element;

    // Check if should be ignored
    if (target && shouldIgnoreElement(target, options.ignoreSelectors)) {
      return;
    }

    // Extract element info (may be document.body if no specific target)
    const elementInfo = target ? extractElementInfo(target) : extractElementInfo(document.body);

    const modifiers: ModifierKeys = {
      alt: event.altKey,
      ctrl: event.ctrlKey,
      meta: event.metaKey,
      shift: event.shiftKey,
    };

    const rawEvent: KeyboardEventData = {
      type: 'keydown',
      id: generateEventId(),
      timestamp: Date.now(),
      target: elementInfo,
      url: window.location.href,
      key: event.key,
      code: event.code,
      modifiers,
    };

    handler(rawEvent);
  };
}

/**
 * Attach keyboard listener to document
 */
export function attachKeyboardListener(
  handler: EventHandler,
  options: {
    ignoreSelectors: string[];
  }
): () => void {
  const listener = createKeyboardListener(handler, options);

  document.addEventListener('keydown', listener, { capture: true });

  return () => {
    document.removeEventListener('keydown', listener, { capture: true });
  };
}

/**
 * Format key combination for display
 */
export function formatKeyCombination(event: KeyboardEventData): string {
  const parts: string[] = [];

  if (event.modifiers.ctrl) parts.push('Ctrl');
  if (event.modifiers.alt) parts.push('Alt');
  if (event.modifiers.shift) parts.push('Shift');
  if (event.modifiers.meta) parts.push('Cmd');

  parts.push(event.key);

  return parts.join('+');
}
