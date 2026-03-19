/**
 * Shared assertion logic for assertElement.
 *
 * This module provides both:
 * 1. A TypeScript function for ExtensionAdapter (direct execution)
 * 2. A serialized JS string for PuppeteerAdapter (page.evaluate)
 *
 * Single source of truth — eliminates ~200 lines of duplication.
 */

export interface AssertionInput {
  type: string;
  value?: unknown;
  name?: string;
  contains?: boolean;
  operator?: string;
}

export interface AssertionResult {
  passed: boolean;
  message: string;
}

/**
 * Run element assertion logic.
 * Works in both browser (content script) and page.evaluate contexts.
 */
export function runElementAssertion(
  elements: Element[],
  assertion: AssertionInput
): AssertionResult {
  const element = elements[0] as HTMLElement | undefined;

  const isVisible = (el: Element | undefined): boolean => {
    if (!el || !(el instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  switch (assertion.type) {
    case 'visible':
      return element && isVisible(element)
        ? { passed: true, message: 'Element is visible' }
        : { passed: false, message: 'Element is not visible' };

    case 'hidden':
      return !element || !isVisible(element)
        ? { passed: true, message: 'Element is hidden' }
        : { passed: false, message: 'Element is visible but expected hidden' };

    case 'exists':
      return element
        ? { passed: true, message: 'Element exists' }
        : { passed: false, message: 'Element does not exist' };

    case 'notExists':
      return !element
        ? { passed: true, message: 'Element does not exist as expected' }
        : { passed: false, message: 'Element exists but expected not to' };

    case 'text': {
      const textContent = element?.textContent ?? '';
      const expectedText = String(assertion.value ?? '');

      if (assertion.contains) {
        return textContent.includes(expectedText)
          ? { passed: true, message: `Text contains "${expectedText}"` }
          : {
              passed: false,
              message: `Text does not contain "${expectedText}", actual: "${textContent}"`,
            };
      }
      return textContent.trim() === expectedText.trim()
        ? { passed: true, message: `Text matches "${expectedText}"` }
        : {
            passed: false,
            message: `Text does not match, expected: "${expectedText}", actual: "${textContent}"`,
          };
    }

    case 'attribute': {
      const attrName = assertion.name ?? '';
      const attrValue = element?.getAttribute(attrName) ?? null;

      if (assertion.value === undefined) {
        return attrValue !== null
          ? { passed: true, message: `Attribute "${attrName}" exists` }
          : { passed: false, message: `Attribute "${attrName}" does not exist` };
      }
      return attrValue === assertion.value
        ? { passed: true, message: `Attribute "${attrName}" equals "${String(assertion.value)}"` }
        : {
            passed: false,
            message: `Attribute "${attrName}" mismatch, expected: "${String(assertion.value)}", actual: "${attrValue}"`,
          };
    }

    case 'count': {
      const count = elements.length;
      const expected = Number(assertion.value ?? 0);
      const op = assertion.operator ?? 'eq';

      let passed = false;
      switch (op) {
        case 'eq':
          passed = count === expected;
          break;
        case 'gt':
          passed = count > expected;
          break;
        case 'gte':
          passed = count >= expected;
          break;
        case 'lt':
          passed = count < expected;
          break;
        case 'lte':
          passed = count <= expected;
          break;
      }

      return passed
        ? { passed: true, message: `Element count ${count} ${op} ${expected}` }
        : { passed: false, message: `Element count ${count} is not ${op} ${expected}` };
    }

    case 'enabled': {
      const isDisabled = element?.hasAttribute('disabled') ?? true;
      return !isDisabled
        ? { passed: true, message: 'Element is enabled' }
        : { passed: false, message: 'Element is disabled but expected enabled' };
    }

    case 'value': {
      const inputEl = element as HTMLInputElement | HTMLTextAreaElement | undefined;
      const currentValue = inputEl?.value ?? '';
      const expectedValue = String(assertion.value ?? '');
      return currentValue === expectedValue
        ? { passed: true, message: `Value matches "${expectedValue}"` }
        : {
            passed: false,
            message: `Value mismatch, expected: "${expectedValue}", actual: "${currentValue}"`,
          };
    }

    default:
      return { passed: false, message: `Unknown assertion type: ${assertion.type}` };
  }
}

/**
 * Serialized version of runElementAssertion for page.evaluate().
 * This is a self-contained IIFE string that PuppeteerAdapter can inject.
 */
export const ASSERT_ELEMENT_EVAL_SCRIPT = `(function() {
  var s = arguments[0];
  var a = arguments[1];
  var elements = document.querySelectorAll(s);
  var element = elements[0];

  var isVisible = function(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    var style = window.getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
  };

  switch (a.type) {
    case 'visible':
      return { passed: !!element && isVisible(element), message: element && isVisible(element) ? 'Element is visible' : 'Element is not visible' };
    case 'hidden':
      return { passed: !element || !isVisible(element), message: !element || !isVisible(element) ? 'Element is hidden' : 'Element is visible but expected hidden' };
    case 'exists':
      return { passed: !!element, message: element ? 'Element exists' : 'Element does not exist' };
    case 'notExists':
      return { passed: !element, message: !element ? 'Element does not exist as expected' : 'Element exists but expected not to' };
    case 'text': {
      var text = element ? element.textContent || '' : '';
      var expected = String(a.value || '');
      if (a.contains) {
        return { passed: text.includes(expected), message: text.includes(expected) ? 'Text contains "' + expected + '"' : 'Text does not contain "' + expected + '"' };
      }
      return { passed: text.trim() === expected.trim(), message: text.trim() === expected.trim() ? 'Text matches "' + expected + '"' : 'Text mismatch: "' + text + '" vs "' + expected + '"' };
    }
    case 'attribute': {
      var attrVal = element ? element.getAttribute(a.name || '') : null;
      if (a.value === undefined) {
        return { passed: attrVal !== null, message: attrVal !== null ? 'Attribute "' + a.name + '" exists' : 'Attribute "' + a.name + '" missing' };
      }
      return { passed: attrVal === a.value, message: attrVal === a.value ? 'Attribute matches' : 'Attribute mismatch: "' + attrVal + '" vs "' + a.value + '"' };
    }
    case 'count': {
      var count = elements.length;
      var exp = Number(a.value || 0);
      var op = a.operator || 'eq';
      var passed = false;
      switch (op) { case 'eq': passed = count === exp; break; case 'gt': passed = count > exp; break; case 'gte': passed = count >= exp; break; case 'lt': passed = count < exp; break; case 'lte': passed = count <= exp; break; }
      return { passed: passed, message: 'Count: ' + count + ' ' + op + ' ' + exp + ' = ' + passed };
    }
    case 'enabled': {
      var isDisabled = element ? element.hasAttribute('disabled') : true;
      return { passed: !isDisabled, message: !isDisabled ? 'Element is enabled' : 'Element is disabled' };
    }
    case 'value': {
      var curVal = element ? element.value || '' : '';
      var expVal = String(a.value || '');
      return { passed: curVal === expVal, message: curVal === expVal ? 'Value matches' : 'Value mismatch: "' + curVal + '" vs "' + expVal + '"' };
    }
    default:
      return { passed: false, message: 'Unknown assertion: ' + a.type };
  }
})()`;
