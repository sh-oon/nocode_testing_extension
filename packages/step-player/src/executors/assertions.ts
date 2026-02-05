import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { AssertApiStep, AssertElementStep } from '@like-cake/ast-types';
import type { ExecutionContext, PlaybackAdapter, StepExecutionResult } from '../types';

/**
 * Matches a URL against a pattern
 */
function matchUrl(url: string, pattern: string, isRegex?: boolean): boolean {
  if (isRegex) {
    try {
      const regex = new RegExp(pattern);
      return regex.test(url);
    } catch {
      return false;
    }
  }

  // Simple string matching (supports wildcards)
  if (pattern.includes('*')) {
    const regexPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${regexPattern}$`).test(url);
  }

  return url.includes(pattern);
}

/**
 * Finds matching API call from captured calls
 */
function findMatchingApiCall(
  apiCalls: CapturedApiCall[],
  match: { url: string; method?: string; urlIsRegex?: boolean }
): CapturedApiCall | undefined {
  return apiCalls.find((call) => {
    // Match URL
    if (!matchUrl(call.request.url, match.url, match.urlIsRegex)) {
      return false;
    }

    // Match method if specified
    if (match.method && call.request.method.toUpperCase() !== match.method.toUpperCase()) {
      return false;
    }

    return true;
  });
}

/**
 * Gets a value from an object using JSONPath-like syntax
 */
function getByJsonPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') {
    return undefined;
  }

  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Validates status code against expectation
 */
function validateStatus(actual: number, expected: number | { min: number; max: number }): boolean {
  if (typeof expected === 'number') {
    return actual === expected;
  }
  return actual >= expected.min && actual <= expected.max;
}

/**
 * Execute an assertApi step
 */
export async function executeAssertApi(
  step: AssertApiStep,
  adapter: PlaybackAdapter,
  context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();
  const timeout = step.timeout ?? context.defaultTimeout;

  try {
    let matchingCall: CapturedApiCall | undefined;

    if (step.waitFor) {
      // Wait for matching API call
      const endTime = Date.now() + timeout;

      while (Date.now() < endTime) {
        const allCalls = [...context.apiCalls, ...adapter.getApiCalls()];
        matchingCall = findMatchingApiCall(allCalls, step.match);

        if (matchingCall?.response) {
          break;
        }

        await adapter.wait(100);
      }

      if (!matchingCall || !matchingCall.response) {
        return {
          status: 'failed',
          duration: Date.now() - startTime,
          error: {
            message: `No matching API call found for ${step.match.method ?? 'ANY'} ${step.match.url} within timeout`,
          },
        };
      }
    } else {
      // Look for existing matching call
      const allCalls = [...context.apiCalls, ...adapter.getApiCalls()];
      matchingCall = findMatchingApiCall(allCalls, step.match);

      if (!matchingCall) {
        return {
          status: 'failed',
          duration: Date.now() - startTime,
          error: {
            message: `No matching API call found for ${step.match.method ?? 'ANY'} ${step.match.url}`,
          },
        };
      }
    }

    // Validate expectations
    if (step.expect && matchingCall.response) {
      const response = matchingCall.response;

      // Validate status
      if (step.expect.status !== undefined) {
        if (!validateStatus(response.status, step.expect.status)) {
          const expected =
            typeof step.expect.status === 'number'
              ? step.expect.status
              : `${step.expect.status.min}-${step.expect.status.max}`;
          return {
            status: 'failed',
            duration: Date.now() - startTime,
            error: {
              message: `Status code mismatch: expected ${expected}, got ${response.status}`,
            },
            apiResponse: {
              status: response.status,
              headers: response.headers,
              body: response.body,
              responseTime: response.responseTime,
            },
          };
        }
      }

      // Validate JSONPath assertions
      if (step.expect.jsonPath) {
        for (const [path, expectedValue] of Object.entries(step.expect.jsonPath)) {
          const actualValue = getByJsonPath(response.body, path);

          if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
            return {
              status: 'failed',
              duration: Date.now() - startTime,
              error: {
                message: `JSONPath assertion failed: ${path} expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
              },
              apiResponse: {
                status: response.status,
                headers: response.headers,
                body: response.body,
                responseTime: response.responseTime,
              },
            };
          }
        }
      }

      // Validate headers
      if (step.expect.headers) {
        for (const [header, expectedValue] of Object.entries(step.expect.headers)) {
          const actualValue = response.headers[header.toLowerCase()];

          if (actualValue !== expectedValue) {
            return {
              status: 'failed',
              duration: Date.now() - startTime,
              error: {
                message: `Header assertion failed: ${header} expected "${expectedValue}", got "${actualValue}"`,
              },
              apiResponse: {
                status: response.status,
                headers: response.headers,
                body: response.body,
                responseTime: response.responseTime,
              },
            };
          }
        }
      }

      // Validate response time
      if (step.expect.responseTime !== undefined) {
        if (response.responseTime > step.expect.responseTime) {
          return {
            status: 'failed',
            duration: Date.now() - startTime,
            error: {
              message: `Response time exceeded: expected < ${step.expect.responseTime}ms, got ${response.responseTime}ms`,
            },
            apiResponse: {
              status: response.status,
              headers: response.headers,
              body: response.body,
              responseTime: response.responseTime,
            },
          };
        }
      }
    }

    // All assertions passed
    return {
      status: 'passed',
      duration: Date.now() - startTime,
      apiResponse: matchingCall.response
        ? {
            status: matchingCall.response.status,
            headers: matchingCall.response.headers,
            body: matchingCall.response.body,
            responseTime: matchingCall.response.responseTime,
          }
        : undefined,
    };
  } catch (error) {
    return {
      status: 'failed',
      duration: Date.now() - startTime,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

/**
 * Execute an assertElement step
 */
export async function executeAssertElement(
  step: AssertElementStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    const result = await adapter.assertElement(step.selector, {
      type: step.assertion.type,
      value: 'value' in step.assertion ? step.assertion.value : undefined,
      name: 'name' in step.assertion ? step.assertion.name : undefined,
      contains: 'contains' in step.assertion ? step.assertion.contains : undefined,
      operator: 'operator' in step.assertion ? step.assertion.operator : undefined,
    });

    if (!result.passed) {
      return {
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          message: result.message,
        },
      };
    }

    return {
      status: 'passed',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'failed',
      duration: Date.now() - startTime,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}
