import type { Selector, SelectorStrategy } from '@like-cake/ast-types';
import type { SelectorResult } from '../types';

/**
 * Weight factors for scoring components
 */
export interface ScoreWeights {
  /** Weight for strategy priority (0-1) */
  strategyPriority: number;
  /** Weight for uniqueness (0-1) */
  uniqueness: number;
  /** Weight for selector length (0-1) */
  length: number;
  /** Weight for readability (0-1) */
  readability: number;
}

/**
 * Default scoring weights
 */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  strategyPriority: 0.4,
  uniqueness: 0.3,
  length: 0.15,
  readability: 0.15,
};

/**
 * Base scores for each strategy type
 */
const STRATEGY_BASE_SCORES: Record<SelectorStrategy, number> = {
  testId: 100,
  role: 85,
  css: 70,
  xpath: 50,
};

/**
 * Calculate a composite score for a selector
 */
export function calculateCompositeScore(
  result: SelectorResult,
  weights: Partial<ScoreWeights> = {}
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const selector = result.selector;

  const strategyScore = STRATEGY_BASE_SCORES[selector.strategy] / 100;
  const uniqueScore = result.isUnique ? 1 : 0.5;
  const lengthScore = calculateLengthScore(selector);
  const readabilityScore = calculateReadabilityScore(selector);

  const composite =
    strategyScore * w.strategyPriority +
    uniqueScore * w.uniqueness +
    lengthScore * w.length +
    readabilityScore * w.readability;

  return Math.round(composite * 100);
}

/**
 * Calculate score based on selector length (shorter is better)
 */
function calculateLengthScore(selector: Selector): number {
  const value = selector.value;
  const length = value.length;

  if (length <= 20) return 1;
  if (length <= 40) return 0.8;
  if (length <= 60) return 0.6;
  if (length <= 100) return 0.4;
  return 0.2;
}

/**
 * Calculate readability score based on selector complexity
 */
function calculateReadabilityScore(selector: Selector): number {
  const value = selector.value;

  // TestId is most readable
  if (selector.strategy === 'testId') {
    return 1;
  }

  // Role with name is readable
  if (selector.strategy === 'role' && 'name' in selector && selector.name) {
    return 0.9;
  }

  // CSS selectors vary in readability
  if (selector.strategy === 'css') {
    // ID selectors are readable
    if (value.startsWith('#')) return 0.85;
    // Class selectors are fairly readable
    if (value.includes('.') && !value.includes(':nth')) return 0.7;
    // Positional selectors are less readable
    if (value.includes(':nth')) return 0.5;
    return 0.6;
  }

  // XPath is least readable
  return 0.3;
}

/**
 * Compare two selector results and return the better one
 */
export function compareSelectorResults(a: SelectorResult, b: SelectorResult): SelectorResult {
  const scoreA = calculateCompositeScore(a);
  const scoreB = calculateCompositeScore(b);

  return scoreA >= scoreB ? a : b;
}

/**
 * Rank multiple selector results from best to worst
 */
export function rankSelectorResults(results: SelectorResult[]): SelectorResult[] {
  return [...results].sort((a, b) => {
    const scoreA = calculateCompositeScore(a);
    const scoreB = calculateCompositeScore(b);
    return scoreB - scoreA;
  });
}
