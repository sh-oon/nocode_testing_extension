import type {
  ClickStep,
  KeypressStep,
  NavigateStep,
  ScrollStep,
  Step,
  TypeStep,
} from '@like-cake/ast-types';
import { getBestSelector } from '@like-cake/selector-engine';
import type {
  InputEventData,
  KeyboardEventData,
  MouseEventData,
  NavigationEventData,
  RawEvent,
  ScrollEventData,
} from './types';

/**
 * Transform a raw event into an AST Step
 */
export function transformEventToStep(event: RawEvent): Step | null {
  switch (event.type) {
    case 'click':
    case 'dblclick':
      return transformClickEvent(event);
    case 'input':
    case 'change':
    case 'blur':
      return transformInputEvent(event);
    case 'keydown':
    case 'keyup':
    case 'keypress':
      return transformKeyboardEvent(event);
    case 'scroll':
      return transformScrollEvent(event);
    case 'navigation':
      return transformNavigationEvent(event);
    default:
      return null;
  }
}

/**
 * Transform click event to ClickStep
 */
function transformClickEvent(event: MouseEventData): ClickStep | null {
  const selector = getBestSelector(event.target);
  if (!selector) return null;

  const modifiers = getModifierArray(event.modifiers);

  const step: ClickStep = {
    type: 'click',
    selector,
    ...(event.button === 1 && { button: 'middle' }),
    ...(event.button === 2 && { button: 'right' }),
    ...(event.type === 'dblclick' && { clickCount: 2 }),
    ...(modifiers.length > 0 && { modifiers }),
  };

  return step;
}

/**
 * Transform input event to TypeStep
 */
function transformInputEvent(event: InputEventData): TypeStep | null {
  // Only transform blur events (final value)
  if (event.type !== 'blur' && event.type !== 'change') {
    return null;
  }

  const selector = getBestSelector(event.target);
  if (!selector) return null;

  // Skip if value is empty
  if (!event.value && !event.previousValue) {
    return null;
  }

  const step: TypeStep = {
    type: 'type',
    selector,
    value: event.value,
    ...(event.isSensitive && { sensitive: true }),
  };

  return step;
}

/**
 * Transform keyboard event to KeypressStep
 */
function transformKeyboardEvent(event: KeyboardEventData): KeypressStep | null {
  // Only capture specific keys
  const captureKeys = ['Enter', 'Tab', 'Escape'];
  const hasModifier = event.modifiers.ctrl || event.modifiers.meta || event.modifiers.alt;

  if (!captureKeys.includes(event.key) && !hasModifier) {
    return null;
  }

  const selector = getBestSelector(event.target);
  const modifiers = getModifierArray(event.modifiers);

  const step: KeypressStep = {
    type: 'keypress',
    key: event.key,
    ...(selector && { selector }),
    ...(modifiers.length > 0 && { modifiers }),
  };

  return step;
}

/**
 * Transform scroll event to ScrollStep
 */
function transformScrollEvent(event: ScrollEventData): ScrollStep | null {
  const selector = getBestSelector(event.target);

  const step: ScrollStep = {
    type: 'scroll',
    ...(selector && { selector }),
    position: {
      ...(event.position.x !== 0 && { x: event.position.x }),
      ...(event.position.y !== 0 && { y: event.position.y }),
    },
  };

  return step;
}

/**
 * Transform navigation event to NavigateStep
 */
function transformNavigationEvent(event: NavigationEventData): NavigateStep {
  // Extract path from URL for relative navigation
  const url = new URL(event.toUrl);
  const path = url.pathname + url.search + url.hash;

  const step: NavigateStep = {
    type: 'navigate',
    url: path || '/',
  };

  return step;
}

/**
 * Convert modifier keys object to array format
 */
function getModifierArray(
  modifiers: MouseEventData['modifiers'] | KeyboardEventData['modifiers']
): Array<'Alt' | 'Control' | 'Meta' | 'Shift'> {
  const result: Array<'Alt' | 'Control' | 'Meta' | 'Shift'> = [];

  if (modifiers.alt) result.push('Alt');
  if (modifiers.ctrl) result.push('Control');
  if (modifiers.meta) result.push('Meta');
  if (modifiers.shift) result.push('Shift');

  return result;
}

/**
 * Batch transform multiple events
 */
export function transformEventsToSteps(events: RawEvent[]): Step[] {
  const steps: Step[] = [];

  for (const event of events) {
    const step = transformEventToStep(event);
    if (step) {
      steps.push(step);
    }
  }

  return steps;
}

/**
 * Merge consecutive type steps on the same element
 */
export function mergeTypeSteps(steps: Step[]): Step[] {
  const result: Step[] = [];

  for (const step of steps) {
    if (step.type !== 'type') {
      result.push(step);
      continue;
    }

    const lastStep = result[result.length - 1];

    // Merge with previous type step if same selector
    if (
      lastStep?.type === 'type' &&
      JSON.stringify(lastStep.selector) === JSON.stringify(step.selector)
    ) {
      // Replace with the newer value
      result[result.length - 1] = step;
    } else {
      result.push(step);
    }
  }

  return result;
}
