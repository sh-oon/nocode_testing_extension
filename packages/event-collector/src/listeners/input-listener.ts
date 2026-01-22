import type { EventHandler, InputEventData } from '../types';
import { extractElementInfo, shouldIgnoreElement } from '../utils/element-info';
import { debounce, generateEventId } from '../utils/helpers';

/**
 * Sensitive input types that should be masked
 */
const SENSITIVE_INPUT_TYPES = ['password'];

/**
 * Sensitive input names that should be masked
 */
const SENSITIVE_INPUT_NAMES = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'credit_card',
  'creditcard',
  'card_number',
  'cvv',
  'cvc',
  'ssn',
  'social_security',
];

/**
 * Check if an input is sensitive
 */
function isSensitiveInput(element: HTMLInputElement | HTMLTextAreaElement): boolean {
  const type = element.type?.toLowerCase() || '';
  const name = element.name?.toLowerCase() || '';
  const id = element.id?.toLowerCase() || '';

  if (SENSITIVE_INPUT_TYPES.includes(type)) {
    return true;
  }

  for (const pattern of SENSITIVE_INPUT_NAMES) {
    if (name.includes(pattern) || id.includes(pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Get input value (masked if sensitive)
 */
function getInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  isSensitive: boolean
): string {
  const value = element.value;
  if (isSensitive) {
    return '*'.repeat(value.length);
  }
  return value;
}

/**
 * Create an input event listener
 */
export function createInputListener(
  handler: EventHandler,
  options: {
    ignoreSelectors: string[];
    debounceMs: number;
  }
): {
  inputHandler: (event: Event) => void;
  changeHandler: (event: Event) => void;
  blurHandler: (event: Event) => void;
} {
  // Track previous values for change detection
  const previousValues = new WeakMap<Element, string>();

  const processInputEvent = (event: Event, eventType: 'input' | 'change' | 'blur') => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (!target) return;

    // Only handle input and textarea elements
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
      return;
    }

    // Skip certain input types
    if (
      target instanceof HTMLInputElement &&
      ['submit', 'button', 'reset', 'file', 'image'].includes(target.type)
    ) {
      return;
    }

    // Check if should be ignored
    if (shouldIgnoreElement(target, options.ignoreSelectors)) {
      return;
    }

    const isSensitive = isSensitiveInput(target);
    const currentValue = getInputValue(target, isSensitive);
    const previousValue = previousValues.get(target);

    // For blur events, only emit if value changed
    if (eventType === 'blur' && currentValue === previousValue) {
      return;
    }

    // Update previous value
    previousValues.set(target, currentValue);

    const elementInfo = extractElementInfo(target);

    const rawEvent: InputEventData = {
      type: eventType,
      id: generateEventId(),
      timestamp: Date.now(),
      target: elementInfo,
      url: window.location.href,
      value: currentValue,
      previousValue,
      inputType: target instanceof HTMLInputElement ? target.type : 'textarea',
      isSensitive,
    };

    handler(rawEvent);
  };

  // Debounce input events
  const debouncedInputHandler = debounce(
    (event: Event) => processInputEvent(event, 'input'),
    options.debounceMs
  );

  return {
    inputHandler: debouncedInputHandler,
    changeHandler: (event: Event) => processInputEvent(event, 'change'),
    blurHandler: (event: Event) => processInputEvent(event, 'blur'),
  };
}

/**
 * Attach input listeners to document
 */
export function attachInputListener(
  handler: EventHandler,
  options: {
    ignoreSelectors: string[];
    debounceMs: number;
  }
): () => void {
  const { inputHandler, changeHandler, blurHandler } = createInputListener(handler, options);

  document.addEventListener('input', inputHandler, { capture: true });
  document.addEventListener('change', changeHandler, { capture: true });
  document.addEventListener('blur', blurHandler, { capture: true });

  return () => {
    document.removeEventListener('input', inputHandler, { capture: true });
    document.removeEventListener('change', changeHandler, { capture: true });
    document.removeEventListener('blur', blurHandler, { capture: true });
  };
}
