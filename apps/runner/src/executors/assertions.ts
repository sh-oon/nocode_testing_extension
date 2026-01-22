import type { AssertApiStep, AssertElementStep } from '@like-cake/ast-types';
import { JSONPath } from 'jsonpath-plus';
import type { ObservedApiCall, StepExecutor, StepResult } from '../types';
import { findElement, toSelectorString } from './selector-utils';

/**
 * Execute assertApi step
 */
export const executeAssertApi: StepExecutor<AssertApiStep> = async (step, context) => {
  const { apiObserver, options } = context;

  // Build URL pattern
  const urlPattern = step.match.urlIsRegex ? step.match.url : step.match.url;

  // Wait for or find matching API call
  let apiCall: ObservedApiCall | undefined;
  if (step.waitFor) {
    apiCall = await apiObserver.waitFor(
      urlPattern,
      step.match.method,
      step.timeout ?? options.defaultTimeout ?? 30000
    );
  } else {
    const matches = apiObserver.findMatching(urlPattern, step.match.method);
    apiCall = matches[matches.length - 1]; // Get most recent match
  }

  if (!apiCall) {
    throw new Error(`No API call found matching: ${step.match.method ?? 'ANY'} ${urlPattern}`);
  }

  const result: Partial<StepResult> = {
    status: 'passed',
    apiResponse: apiCall.response
      ? {
          status: apiCall.response.status,
          headers: apiCall.response.headers,
          body: apiCall.response.body,
          responseTime: apiCall.response.responseTime,
        }
      : undefined,
  };

  // Validate expectations if provided
  if (step.expect && apiCall.response) {
    const response = apiCall.response;

    // Check status
    if (step.expect.status !== undefined) {
      const expectedStatus = step.expect.status;
      if (typeof expectedStatus === 'number') {
        if (response.status !== expectedStatus) {
          throw new Error(`Expected status ${expectedStatus}, got ${response.status}`);
        }
      } else {
        // Range check
        if (response.status < expectedStatus.min || response.status > expectedStatus.max) {
          throw new Error(
            `Expected status between ${expectedStatus.min}-${expectedStatus.max}, got ${response.status}`
          );
        }
      }
    }

    // Check headers
    if (step.expect.headers) {
      for (const [key, value] of Object.entries(step.expect.headers)) {
        const actualValue = response.headers[key.toLowerCase()];
        if (actualValue !== value) {
          throw new Error(`Expected header "${key}" to be "${value}", got "${actualValue}"`);
        }
      }
    }

    // Check response time
    if (
      step.expect.responseTime !== undefined &&
      response.responseTime > step.expect.responseTime
    ) {
      throw new Error(
        `Response time ${response.responseTime}ms exceeded limit of ${step.expect.responseTime}ms`
      );
    }

    // Check JSONPath assertions
    if (step.expect.jsonPath && response.body) {
      for (const [path, expectedValue] of Object.entries(step.expect.jsonPath)) {
        const results = JSONPath({
          path,
          json: response.body as object,
        });

        if (results.length === 0) {
          throw new Error(`JSONPath "${path}" not found in response`);
        }

        const actualValue = results[0];
        if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
          throw new Error(
            `JSONPath "${path}" expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
          );
        }
      }
    }
  }

  return result;
};

/**
 * Execute assertElement step
 */
export const executeAssertElement: StepExecutor<AssertElementStep> = async (step, context) => {
  const { page, options } = context;
  const selectorString = toSelectorString(step.selector);
  const timeout = step.timeout ?? options.defaultTimeout ?? 30000;

  switch (step.assertion.type) {
    case 'visible': {
      const element = await page.waitForSelector(selectorString, {
        visible: true,
        timeout,
      });
      if (!element) {
        throw new Error(`Element not visible: ${selectorString}`);
      }
      break;
    }

    case 'hidden': {
      await page.waitForSelector(selectorString, {
        hidden: true,
        timeout,
      });
      break;
    }

    case 'exists': {
      const element = await page.$(selectorString);
      if (!element) {
        throw new Error(`Element does not exist: ${selectorString}`);
      }
      break;
    }

    case 'notExists': {
      const element = await page.$(selectorString);
      if (element) {
        throw new Error(`Element exists but should not: ${selectorString}`);
      }
      break;
    }

    case 'text': {
      const element = await findElement(page, step.selector, timeout);
      if (!element) {
        throw new Error(`Element not found: ${selectorString}`);
      }

      const textContent = await element.evaluate((el) => el.textContent || '');
      const expectedText = step.assertion.value;

      if (step.assertion.contains) {
        if (!textContent.includes(expectedText)) {
          throw new Error(`Element text "${textContent}" does not contain "${expectedText}"`);
        }
      } else {
        if (textContent.trim() !== expectedText) {
          throw new Error(`Element text "${textContent.trim()}" does not match "${expectedText}"`);
        }
      }
      break;
    }

    case 'attribute': {
      const element = await findElement(page, step.selector, timeout);
      if (!element) {
        throw new Error(`Element not found: ${selectorString}`);
      }

      const attrValue = await element.evaluate(
        (el, name) => el.getAttribute(name),
        step.assertion.name
      );

      if (step.assertion.value !== undefined) {
        if (attrValue !== step.assertion.value) {
          throw new Error(
            `Attribute "${step.assertion.name}" expected "${step.assertion.value}", got "${attrValue}"`
          );
        }
      } else if (attrValue === null) {
        throw new Error(`Attribute "${step.assertion.name}" not found on element`);
      }
      break;
    }

    case 'count': {
      const elements = await page.$$(selectorString);
      const count = elements.length;
      const expectedCount = step.assertion.value;
      const operator = step.assertion.operator ?? 'eq';

      const operators: Record<string, (a: number, b: number) => boolean> = {
        eq: (a, b) => a === b,
        gt: (a, b) => a > b,
        gte: (a, b) => a >= b,
        lt: (a, b) => a < b,
        lte: (a, b) => a <= b,
      };

      if (!operators[operator](count, expectedCount)) {
        throw new Error(`Element count ${count} does not satisfy ${operator} ${expectedCount}`);
      }
      break;
    }
  }

  return { status: 'passed' };
};
