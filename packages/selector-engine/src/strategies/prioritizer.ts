import type { Selector, SelectorStrategy } from '@like-cake/ast-types';
import { CssGenerator, RoleGenerator, TestIdGenerator, XPathGenerator } from '../generators';
import type { ElementInfo, GeneratorOptions, SelectorGenerator, SelectorResult } from '../types';

/**
 * Default priority order for selector strategies
 * Higher priority = more stable and maintainable
 */
export const SELECTOR_PRIORITY: readonly SelectorStrategy[] = [
  'testId',
  'role',
  'css',
  'xpath',
] as const;

/**
 * Options for the selector prioritizer
 */
export interface PrioritizerOptions extends GeneratorOptions {
  /** Custom priority order (optional) */
  priority?: SelectorStrategy[];
  /** Minimum score threshold (0-100) */
  minScore?: number;
  /** Only return unique selectors */
  requireUnique?: boolean;
  /** Maximum number of fallback selectors to generate */
  maxFallbacks?: number;
}

/**
 * Result from the prioritizer with all generated selectors
 */
export interface PrioritizedResult {
  /** Best selector based on priority and score */
  best: SelectorResult;
  /** All generated selectors in priority order */
  all: SelectorResult[];
  /** Fallback selectors if best selector fails */
  fallbacks: SelectorResult[];
}

/**
 * Selector Prioritizer - orchestrates selector generation with priority-based selection
 */
export class SelectorPrioritizer {
  private generators: Map<SelectorStrategy, SelectorGenerator>;

  constructor() {
    this.generators = new Map<SelectorStrategy, SelectorGenerator>();
    this.generators.set('testId', new TestIdGenerator());
    this.generators.set('role', new RoleGenerator());
    this.generators.set('css', new CssGenerator());
    this.generators.set('xpath', new XPathGenerator());
  }

  /**
   * Generate the best selector for an element
   */
  getBestSelector(element: ElementInfo, options?: PrioritizerOptions): SelectorResult | null {
    const result = this.prioritize(element, options);
    return result?.best ?? null;
  }

  /**
   * Generate all selectors with prioritization
   */
  prioritize(element: ElementInfo, options?: PrioritizerOptions): PrioritizedResult | null {
    const opts: Required<PrioritizerOptions> = {
      priority: [...SELECTOR_PRIORITY],
      minScore: 0,
      requireUnique: false,
      maxFallbacks: 2,
      maxDepth: 5,
      preferShort: true,
      testIdAttribute: 'data-testid',
      ignoreClasses: [],
      ignoreAttributes: ['style', 'class', 'id'],
      ...options,
    };

    const results: SelectorResult[] = [];

    // Generate selectors in priority order
    for (const strategy of opts.priority) {
      const generator = this.generators.get(strategy);
      if (!generator) continue;

      if (!generator.canGenerate(element)) continue;

      const result = generator.generate(element, opts);
      if (result && result.score >= opts.minScore) {
        if (!opts.requireUnique || result.isUnique) {
          results.push(result);
        }
      }
    }

    if (results.length === 0) {
      return null;
    }

    // Sort by priority order, then by score
    const priorityIndex = new Map(opts.priority.map((s, i) => [s, i]));
    results.sort((a, b) => {
      const priorityDiff =
        (priorityIndex.get(a.selector.strategy) ?? 999) -
        (priorityIndex.get(b.selector.strategy) ?? 999);
      if (priorityDiff !== 0) return priorityDiff;
      return b.score - a.score;
    });

    const best = results[0];
    const fallbacks = results.slice(1, opts.maxFallbacks + 1);

    return {
      best,
      all: results,
      fallbacks,
    };
  }

  /**
   * Generate a selector using a specific strategy
   */
  generateWithStrategy(
    element: ElementInfo,
    strategy: SelectorStrategy,
    options?: GeneratorOptions
  ): SelectorResult | null {
    const generator = this.generators.get(strategy);
    if (!generator) {
      return null;
    }

    if (!generator.canGenerate(element)) {
      return null;
    }

    return generator.generate(element, options);
  }

  /**
   * Check which strategies can generate selectors for an element
   */
  getAvailableStrategies(element: ElementInfo): SelectorStrategy[] {
    const available: SelectorStrategy[] = [];

    for (const [strategy, generator] of this.generators) {
      if (generator.canGenerate(element)) {
        available.push(strategy);
      }
    }

    return available;
  }

  /**
   * Register a custom generator
   */
  registerGenerator(generator: SelectorGenerator): void {
    this.generators.set(generator.strategy, generator);
  }
}

/**
 * Quick function to get the best selector for an element
 */
export function getBestSelector(
  element: ElementInfo,
  options?: PrioritizerOptions
): Selector | null {
  const prioritizer = new SelectorPrioritizer();
  const result = prioritizer.getBestSelector(element, options);
  return result?.selector ?? null;
}

/**
 * Convert a Selector to a CSS selector string for querying
 */
export function selectorToQueryString(selector: Selector): string {
  switch (selector.strategy) {
    case 'testId':
      return `[data-testid="${selector.value}"]`;
    case 'role': {
      // Role selectors need special handling in test frameworks
      // Return a basic attribute selector as fallback
      if ('name' in selector && selector.name) {
        return `[role="${selector.role}"][aria-label="${selector.name}"]`;
      }
      return `[role="${selector.role}"]`;
    }
    case 'css':
      return selector.value;
    case 'xpath':
      // XPath can't be converted to CSS directly
      // Return a placeholder that indicates XPath should be used
      return `xpath:${selector.value}`;
  }
}
