/**
 * Current AST schema version
 * Follows semver: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes to schema structure
 * - MINOR: New optional fields or step types
 * - PATCH: Bug fixes or clarifications
 */
export const AST_SCHEMA_VERSION = '1.0.0';

/**
 * Minimum compatible schema version
 */
export const MIN_COMPATIBLE_VERSION = '1.0.0';

/**
 * Step type categories
 */
export const STEP_CATEGORIES = {
  UI_ACTION: ['navigate', 'click', 'type', 'keypress', 'wait', 'hover', 'scroll', 'select'],
  ASSERTION: ['assertApi', 'assertElement'],
  OBSERVATION: ['snapshotDom'],
} as const;

/**
 * All step types
 */
export const ALL_STEP_TYPES = [
  ...STEP_CATEGORIES.UI_ACTION,
  ...STEP_CATEGORIES.ASSERTION,
  ...STEP_CATEGORIES.OBSERVATION,
] as const;

/**
 * Selector strategies in priority order
 */
export const SELECTOR_STRATEGIES = ['testId', 'role', 'css', 'xpath'] as const;
