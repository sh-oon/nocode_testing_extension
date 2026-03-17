/**
 * BoundEvent → Step converter
 *
 * Converts catalog-bound events into executable step-player Steps.
 * All 15 catalog events are now mapped (Phase 4 completed).
 */

import type { SelectorInput, Step } from '@like-cake/ast-types';
import type { ElementBinding } from '../types/element-binding';
import type { BoundEvent } from '../types/model';
import type { ConversionResult } from './types';

/** Resolve an ElementBinding's selector by ID */
const resolveSelector = (
  elementBindingId: string | null,
  elementBindings: ElementBinding[],
): SelectorInput | undefined => {
  if (elementBindingId === null) return undefined;
  const binding = elementBindings.find((b) => b.id === elementBindingId);
  return binding?.selector;
};

/**
 * Convert a BoundEvent to an executable Step.
 *
 * @param boundEvent - The catalog event with resolved params
 * @param elementBindings - Available element bindings for selector resolution
 * @returns ConversionResult with either a Step or an UnsupportedMappingError
 */
export const convertBoundEventToStep = (
  boundEvent: BoundEvent,
  elementBindings: ElementBinding[],
): ConversionResult => {
  const { eventId, params } = boundEvent;
  const selector = resolveSelector(boundEvent.elementBindingId, elementBindings);

  const step = convertMappedEvent(eventId, params, selector);
  if (step === undefined) {
    return {
      ok: false,
      error: {
        catalogEntryId: eventId,
        catalogType: 'event',
        message: `Unknown event ID "${eventId}".`,
      },
    };
  }

  return { ok: true, step };
};

/** Map a known event to its Step representation */
const convertMappedEvent = (
  eventId: string,
  params: Record<string, unknown>,
  selector: SelectorInput | undefined,
): Step | undefined => {
  switch (eventId) {
    case 'click':
      return { type: 'click', selector: selector! };

    case 'doubleClick':
      return { type: 'click', selector: selector!, clickCount: 2 };

    case 'hover':
      return { type: 'hover', selector: selector! };

    case 'mouseout':
      return { type: 'mouseOut', selector: selector! };

    case 'dragAndDrop':
      return { type: 'dragAndDrop', selector: selector!, dropTarget: params.dropTarget as string };

    case 'scroll':
      return {
        type: 'scroll',
        ...(selector !== undefined && { selector }),
        position: {
          x: (params.x as number) ?? 0,
          y: (params.y as number) ?? 0,
        },
      };

    case 'type':
      return {
        type: 'type',
        selector: selector!,
        value: params.value as string,
        ...(params.clear !== undefined && { clear: params.clear as boolean }),
        ...(params.delay !== undefined && params.delay !== 0 && { delay: params.delay as number }),
      };

    case 'clear':
      return { type: 'type', selector: selector!, value: '', clear: true };

    case 'keypress':
      return {
        type: 'keypress',
        key: params.key as string,
        ...(selector !== undefined && { selector }),
        ...(params.modifiers !== undefined &&
          params.modifiers !== '' && { modifiers: [params.modifiers] as Array<'Alt' | 'Control' | 'Meta' | 'Shift'> }),
      };

    case 'select':
      return { type: 'select', selector: selector!, values: params.value as string };

    case 'fileUpload':
      return { type: 'fileUpload', selector: selector!, filePaths: params.filePath as string };

    case 'navigate':
      return {
        type: 'navigate',
        url: params.url as string,
        ...(params.waitUntil !== undefined && { waitUntil: params.waitUntil as 'load' | 'domcontentloaded' | 'networkidle2' }),
      };

    case 'historyBack':
      return { type: 'historyBack' };

    case 'historyForward':
      return { type: 'historyForward' };

    case 'wait':
      return {
        type: 'wait',
        strategy: 'time',
        duration: params.duration as number,
      };

    default:
      return undefined;
  }
};
