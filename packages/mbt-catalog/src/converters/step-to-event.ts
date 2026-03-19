/**
 * Step → BoundEvent reverse converter
 *
 * Inverts event-to-step.ts: takes a UI action Step and produces
 * the corresponding BoundEvent + ElementBinding.
 * All 15 catalog events are covered.
 */

import type { Step } from '@like-cake/ast-types';
import type { ElementBindingRegistry } from './binding-utils';
import type { StepToEventResult } from './types';

/**
 * Convert a UI action Step to a BoundEvent + ElementBinding.
 *
 * @param step - A UI action step (navigate, click, type, etc.)
 * @param registry - Shared binding registry for deduplication
 * @returns Conversion result or null if the step type is not a UI action
 */
export const convertStepToEvent = (
  step: Step,
  registry: ElementBindingRegistry
): StepToEventResult | null => {
  switch (step.type) {
    case 'click': {
      const binding = registry.getOrCreate(step.selector, 'click target');
      const isDouble = (step.clickCount ?? 1) >= 2;
      return {
        boundEvent: {
          eventId: isDouble ? 'doubleClick' : 'click',
          elementBindingId: binding.id,
          params: {},
        },
        elementBinding: binding,
      };
    }

    case 'hover': {
      const binding = registry.getOrCreate(step.selector, 'hover target');
      return {
        boundEvent: { eventId: 'hover', elementBindingId: binding.id, params: {} },
        elementBinding: binding,
      };
    }

    case 'mouseOut': {
      const binding = registry.getOrCreate(step.selector, 'mouseout target');
      return {
        boundEvent: { eventId: 'mouseout', elementBindingId: binding.id, params: {} },
        elementBinding: binding,
      };
    }

    case 'dragAndDrop': {
      const binding = registry.getOrCreate(step.selector, 'drag source');
      return {
        boundEvent: {
          eventId: 'dragAndDrop',
          elementBindingId: binding.id,
          params: { dropTarget: step.dropTarget },
        },
        elementBinding: binding,
      };
    }

    case 'scroll': {
      const binding = step.selector ? registry.getOrCreate(step.selector, 'scroll target') : null;
      return {
        boundEvent: {
          eventId: 'scroll',
          elementBindingId: binding?.id ?? null,
          params: {
            x: step.position?.x ?? 0,
            y: step.position?.y ?? 0,
          },
        },
        elementBinding: binding,
      };
    }

    case 'type': {
      const binding = registry.getOrCreate(step.selector, 'input target');
      const isClear = step.value === '' && step.clear === true;
      if (isClear) {
        return {
          boundEvent: { eventId: 'clear', elementBindingId: binding.id, params: {} },
          elementBinding: binding,
        };
      }
      const params: Record<string, unknown> = { value: step.value };
      if (step.clear !== undefined) params.clear = step.clear;
      if (step.delay !== undefined && step.delay !== 0) params.delay = step.delay;
      return {
        boundEvent: { eventId: 'type', elementBindingId: binding.id, params },
        elementBinding: binding,
      };
    }

    case 'keypress': {
      const binding = step.selector ? registry.getOrCreate(step.selector, 'keypress target') : null;
      const params: Record<string, unknown> = { key: step.key };
      if (step.modifiers && step.modifiers.length > 0) {
        params.modifiers = step.modifiers[0];
      }
      return {
        boundEvent: {
          eventId: 'keypress',
          elementBindingId: binding?.id ?? null,
          params,
        },
        elementBinding: binding,
      };
    }

    case 'select': {
      const binding = registry.getOrCreate(step.selector, 'select target');
      const value = Array.isArray(step.values) ? step.values[0] : step.values;
      return {
        boundEvent: {
          eventId: 'select',
          elementBindingId: binding.id,
          params: { value },
        },
        elementBinding: binding,
      };
    }

    case 'fileUpload': {
      const binding = registry.getOrCreate(step.selector, 'file input');
      const filePath = Array.isArray(step.filePaths) ? step.filePaths[0] : step.filePaths;
      return {
        boundEvent: {
          eventId: 'fileUpload',
          elementBindingId: binding.id,
          params: { filePath },
        },
        elementBinding: binding,
      };
    }

    case 'navigate':
      return {
        boundEvent: {
          eventId: 'navigate',
          elementBindingId: null,
          params: {
            url: step.url,
            ...(step.waitUntil !== undefined && { waitUntil: step.waitUntil }),
          },
        },
        elementBinding: null,
      };

    case 'historyBack':
      return {
        boundEvent: { eventId: 'historyBack', elementBindingId: null, params: {} },
        elementBinding: null,
      };

    case 'historyForward':
      return {
        boundEvent: { eventId: 'historyForward', elementBindingId: null, params: {} },
        elementBinding: null,
      };

    case 'wait':
      return {
        boundEvent: {
          eventId: 'wait',
          elementBindingId: null,
          params: { duration: step.duration ?? 1000 },
        },
        elementBinding: null,
      };

    default:
      return null;
  }
};
