export {
  calculateCompositeScore,
  compareSelectorResults,
  DEFAULT_WEIGHTS,
  rankSelectorResults,
  type ScoreWeights,
} from './scorer';
export {
  calculateStabilityScore,
  rankByStability,
} from './stability-scorer';
export {
  isSelectorStable,
  type ValidationResult,
  validateSelector,
  validateSelectorObject,
  validateSelectorString,
} from './validator';
