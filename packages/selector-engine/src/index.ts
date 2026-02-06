// Re-export types from ast-types for convenience
export type {
  CssSelector,
  RoleSelector,
  Selector,
  SelectorCandidate,
  SelectorInput,
  SelectorStrategy,
  TestIdSelector,
  XPathSelector,
} from '@like-cake/ast-types';
// Export generators
export {
  buildAbsoluteXPath,
  CssGenerator,
  extractTestId,
  getElementRole,
  isDynamicClass,
  RoleGenerator,
  TestIdGenerator,
  XPathGenerator,
} from './generators';
// Export strategies
export {
  getBestSelector,
  type PrioritizedResult,
  type PrioritizerOptions,
  SELECTOR_PRIORITY,
  SelectorPrioritizer,
  selectorToQueryString,
} from './strategies';
// Export internal types
export type {
  ElementInfo,
  GeneratorOptions,
  SelectorGenerator,
  SelectorResult,
} from './types';
export { DEFAULT_GENERATOR_OPTIONS } from './types';
// Export utilities
export {
  calculateCompositeScore,
  calculateStabilityScore,
  compareSelectorResults,
  DEFAULT_WEIGHTS,
  isSelectorStable,
  rankByStability,
  rankSelectorResults,
  type ScoreWeights,
  type ValidationResult,
  validateSelector,
  validateSelectorObject,
  validateSelectorString,
} from './utils';
