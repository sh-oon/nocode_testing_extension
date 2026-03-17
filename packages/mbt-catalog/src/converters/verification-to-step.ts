/**
 * BoundVerification → Step converter
 *
 * Converts catalog-bound verifications into AssertElementStep, AssertApiStep,
 * AssertPageStep, or AssertStyleStep.
 * All 22 catalog verifications are now mapped (Phase 4 completed).
 */

import type { SelectorInput, Step } from '@like-cake/ast-types';
import type { ElementBinding } from '../types/element-binding';
import type { BoundVerification } from '../types/model';
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
 * Convert a BoundVerification to an executable Step.
 *
 * @param boundVerification - The catalog verification with resolved params
 * @param elementBindings - Available element bindings for selector resolution
 * @returns ConversionResult with either a Step or an UnsupportedMappingError
 */
export const convertBoundVerificationToStep = (
  boundVerification: BoundVerification,
  elementBindings: ElementBinding[],
): ConversionResult => {
  const { verificationId, params } = boundVerification;
  const selector = resolveSelector(boundVerification.elementBindingId, elementBindings);

  const step = convertMappedVerification(verificationId, params, selector);
  if (step === undefined) {
    return {
      ok: false,
      error: {
        catalogEntryId: verificationId,
        catalogType: 'verification',
        message: `Unknown verification ID "${verificationId}".`,
      },
    };
  }

  return { ok: true, step };
};

/** Map a known verification to its Step representation */
const convertMappedVerification = (
  verificationId: string,
  params: Record<string, unknown>,
  selector: SelectorInput | undefined,
): Step | undefined => {
  switch (verificationId) {
    // ── Element assertions ──
    case 'visible':
      return { type: 'assertElement', selector: selector!, assertion: { type: 'visible' } };

    case 'hidden':
      return { type: 'assertElement', selector: selector!, assertion: { type: 'hidden' } };

    case 'exists':
      return { type: 'assertElement', selector: selector!, assertion: { type: 'exists' } };

    case 'notExists':
      return { type: 'assertElement', selector: selector!, assertion: { type: 'notExists' } };

    case 'count':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: {
          type: 'count',
          value: params.value as number,
          ...(params.operator !== undefined && { operator: params.operator as 'eq' | 'gt' | 'gte' | 'lt' | 'lte' }),
        },
      };

    case 'elementEmpty':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'text', value: '', contains: false },
      };

    // ── Content assertions ──
    case 'textContains':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'text', value: params.value as string, contains: true },
      };

    case 'textEquals':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'text', value: params.value as string, contains: false },
      };

    case 'attributeExists':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'attribute', name: params.name as string },
      };

    case 'attributeValue':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'attribute', name: params.name as string, value: params.value as string },
      };

    case 'classNameExists':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'attribute', name: 'class', value: params.value as string },
      };

    // ── Form assertions ──
    case 'checkboxChecked':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'attribute', name: 'checked' },
      };

    case 'inputDisabled':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'attribute', name: 'disabled' },
      };

    case 'inputEnabled':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'enabled' },
      };

    case 'inputValue':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'value', value: params.value as string },
      };

    case 'inputReadonly':
      return {
        type: 'assertElement',
        selector: selector!,
        assertion: { type: 'attribute', name: 'readonly' },
      };

    // ── Page assertions (Phase 4) ──
    case 'currentUrl':
      return {
        type: 'assertPage',
        assertion: {
          type: 'url',
          value: params.url as string,
          ...(params.matchType !== undefined && { matchType: params.matchType as 'contains' | 'exact' | 'regex' }),
        },
      };

    case 'pageTitle':
      return {
        type: 'assertPage',
        assertion: { type: 'title', value: params.title as string },
      };

    case 'documentExists':
      return {
        type: 'assertPage',
        assertion: { type: 'documentLoaded' },
      };

    case 'cssStyle':
      return {
        type: 'assertStyle',
        selector: selector!,
        property: params.property as string,
        value: params.value as string,
      };

    // ── API assertions ──
    case 'apiResponse': {
      const jsonPath: Record<string, unknown> = {};
      if (params.jsonPath !== undefined && params.expectedValue !== undefined) {
        jsonPath[params.jsonPath as string] = params.expectedValue;
      }
      return {
        type: 'assertApi',
        match: {
          url: params.url as string,
          ...(params.method !== undefined && { method: params.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' }),
        },
        expect: {
          ...(params.status !== undefined && { status: params.status as number }),
          ...(Object.keys(jsonPath).length > 0 && { jsonPath }),
        },
      };
    }

    case 'apiCalled':
      return {
        type: 'assertApi',
        match: {
          url: params.url as string,
          ...(params.method !== undefined && { method: params.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' }),
        },
        waitFor: true,
      };

    default:
      return undefined;
  }
};
