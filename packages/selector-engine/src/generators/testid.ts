import type { TestIdSelector } from '@like-cake/ast-types';
import {
  DEFAULT_GENERATOR_OPTIONS,
  type ElementInfo,
  type GeneratorOptions,
  type SelectorGenerator,
  type SelectorResult,
} from '../types';

/**
 * Generator for data-testid selectors
 * Highest priority - most stable and maintainable
 */
export class TestIdGenerator implements SelectorGenerator {
  readonly strategy = 'testId' as const;

  canGenerate(element: ElementInfo): boolean {
    return !!element.testId && element.testId.trim().length > 0;
  }

  generate(element: ElementInfo, options?: GeneratorOptions): SelectorResult | null {
    const opts = { ...DEFAULT_GENERATOR_OPTIONS, ...options };

    if (!this.canGenerate(element)) {
      return null;
    }

    const testId = element.testId!.trim();

    const selector: TestIdSelector = {
      strategy: 'testId',
      value: testId,
    };

    return {
      selector,
      score: this.calculateScore(testId, opts),
      isUnique: true, // testId should be unique by convention
      description: `Test ID: ${testId}`,
    };
  }

  private calculateScore(testId: string, _options: Required<GeneratorOptions>): number {
    let score = 100; // Start with max score

    // Penalize very long test IDs
    if (testId.length > 50) {
      score -= 10;
    }

    // Penalize test IDs with special characters (except - and _)
    if (/[^a-zA-Z0-9\-_]/.test(testId)) {
      score -= 5;
    }

    // Bonus for semantic naming patterns
    if (/^(btn|button|input|form|modal|card|nav|header|footer)-/.test(testId)) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Extract test ID from element info
 */
export function extractTestId(
  element: ElementInfo,
  testIdAttribute = 'data-testid'
): string | undefined {
  if (element.testId) {
    return element.testId;
  }

  // Check attributes for custom test id attribute
  const attrName = testIdAttribute.replace(/^data-/, '');
  return element.attributes[testIdAttribute] || element.attributes[attrName];
}
