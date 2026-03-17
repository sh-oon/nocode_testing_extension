/**
 * Step → BoundVerification reverse converter
 *
 * Inverts verification-to-step.ts: takes an assertion Step and produces
 * the corresponding BoundVerification + ElementBinding.
 * All 22 catalog verifications are covered.
 */

import type { Step } from '@like-cake/ast-types';
import type { StepToVerificationResult } from './types';
import { ElementBindingRegistry } from './binding-utils';

/**
 * Convert an assertion Step to a BoundVerification + ElementBinding.
 *
 * @param step - An assertion step (assertElement, assertApi, assertPage, assertStyle)
 * @param registry - Shared binding registry for deduplication
 * @returns Conversion result or null if the step type is not an assertion
 */
export const convertStepToVerification = (
  step: Step,
  registry: ElementBindingRegistry,
): StepToVerificationResult | null => {
  switch (step.type) {
    case 'assertElement': {
      const binding = registry.getOrCreate(step.selector, 'assert target');
      const base = {
        elementBindingId: binding.id,
        critical: true,
      };

      switch (step.assertion.type) {
        case 'visible':
          return { boundVerification: { ...base, verificationId: 'visible', params: {} }, elementBinding: binding };

        case 'hidden':
          return { boundVerification: { ...base, verificationId: 'hidden', params: {} }, elementBinding: binding };

        case 'exists':
          return { boundVerification: { ...base, verificationId: 'exists', params: {} }, elementBinding: binding };

        case 'notExists':
          return { boundVerification: { ...base, verificationId: 'notExists', params: {} }, elementBinding: binding };

        case 'count': {
          const params: Record<string, unknown> = { value: step.assertion.value };
          if (step.assertion.operator !== undefined) params.operator = step.assertion.operator;
          return { boundVerification: { ...base, verificationId: 'count', params }, elementBinding: binding };
        }

        case 'text': {
          const { value, contains } = step.assertion;
          if (value === '' && contains === false) {
            return { boundVerification: { ...base, verificationId: 'elementEmpty', params: {} }, elementBinding: binding };
          }
          if (contains) {
            return { boundVerification: { ...base, verificationId: 'textContains', params: { value } }, elementBinding: binding };
          }
          return { boundVerification: { ...base, verificationId: 'textEquals', params: { value } }, elementBinding: binding };
        }

        case 'attribute': {
          const { name, value } = step.assertion;
          // Special-case known attribute names
          if (name === 'checked' && value === undefined) {
            return { boundVerification: { ...base, verificationId: 'checkboxChecked', params: {} }, elementBinding: binding };
          }
          if (name === 'disabled' && value === undefined) {
            return { boundVerification: { ...base, verificationId: 'inputDisabled', params: {} }, elementBinding: binding };
          }
          if (name === 'readonly' && value === undefined) {
            return { boundVerification: { ...base, verificationId: 'inputReadonly', params: {} }, elementBinding: binding };
          }
          if (name === 'class' && value !== undefined) {
            return { boundVerification: { ...base, verificationId: 'classNameExists', params: { value } }, elementBinding: binding };
          }
          // Generic attribute
          if (value !== undefined) {
            return { boundVerification: { ...base, verificationId: 'attributeValue', params: { name, value } }, elementBinding: binding };
          }
          return { boundVerification: { ...base, verificationId: 'attributeExists', params: { name } }, elementBinding: binding };
        }

        case 'enabled':
          return { boundVerification: { ...base, verificationId: 'inputEnabled', params: {} }, elementBinding: binding };

        case 'value':
          return { boundVerification: { ...base, verificationId: 'inputValue', params: { value: step.assertion.value } }, elementBinding: binding };

        default:
          return null;
      }
    }

    case 'assertPage': {
      const base = { elementBindingId: null, critical: true };

      switch (step.assertion.type) {
        case 'url': {
          const params: Record<string, unknown> = { url: step.assertion.value };
          if (step.assertion.matchType !== undefined) params.matchType = step.assertion.matchType;
          return { boundVerification: { ...base, verificationId: 'currentUrl', params }, elementBinding: null };
        }

        case 'title':
          return { boundVerification: { ...base, verificationId: 'pageTitle', params: { title: step.assertion.value } }, elementBinding: null };

        case 'documentLoaded':
          return { boundVerification: { ...base, verificationId: 'documentExists', params: {} }, elementBinding: null };

        default:
          return null;
      }
    }

    case 'assertStyle': {
      const binding = registry.getOrCreate(step.selector, 'style target');
      return {
        boundVerification: {
          verificationId: 'cssStyle',
          elementBindingId: binding.id,
          params: { property: step.property, value: step.value },
          critical: true,
        },
        elementBinding: binding,
      };
    }

    case 'assertApi': {
      const base = { elementBindingId: null, critical: true };

      if (step.waitFor) {
        const params: Record<string, unknown> = { url: step.match.url };
        if (step.match.method !== undefined) params.method = step.match.method;
        return { boundVerification: { ...base, verificationId: 'apiCalled', params }, elementBinding: null };
      }

      const params: Record<string, unknown> = { url: step.match.url };
      if (step.match.method !== undefined) params.method = step.match.method;
      if (step.expect?.status !== undefined) params.status = step.expect.status;
      if (step.expect?.jsonPath !== undefined) {
        const entries = Object.entries(step.expect.jsonPath);
        if (entries.length > 0) {
          params.jsonPath = entries[0][0];
          params.expectedValue = entries[0][1];
        }
      }
      return { boundVerification: { ...base, verificationId: 'apiResponse', params }, elementBinding: null };
    }

    default:
      return null;
  }
};
