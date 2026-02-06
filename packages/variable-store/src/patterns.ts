/**
 * Pattern Presets for No-Code Condition Editing
 *
 * Replaces manual regex/operator selection with user-friendly presets
 * grouped by category: comparison, string, and validation.
 */

import type { ConditionOperator, Condition } from './types';

/**
 * Pattern preset definition
 */
export interface PatternPreset {
  /** Unique preset identifier */
  id: string;
  /** Display label */
  label: string;
  /** Short description */
  description: string;
  /** Category for grouping in UI */
  category: 'comparison' | 'string' | 'validation';
  /** Mapped condition operator */
  operator: ConditionOperator;
  /** Whether the right operand is not needed (unary) */
  unary?: boolean;
  /** Fixed regex pattern (for validation presets) */
  regex?: string;
}

/**
 * All available pattern presets
 */
export const PATTERN_PRESETS: PatternPreset[] = [
  // Comparison
  { id: 'eq', label: 'Equals', description: 'Exact match', category: 'comparison', operator: 'eq' },
  { id: 'ne', label: 'Not Equals', description: 'Not equal to', category: 'comparison', operator: 'ne' },
  { id: 'gt', label: 'Greater Than', description: 'Number comparison (>)', category: 'comparison', operator: 'gt' },
  {
    id: 'gte',
    label: 'Greater or Equal',
    description: 'Number comparison (>=)',
    category: 'comparison',
    operator: 'gte',
  },
  { id: 'lt', label: 'Less Than', description: 'Number comparison (<)', category: 'comparison', operator: 'lt' },
  {
    id: 'lte',
    label: 'Less or Equal',
    description: 'Number comparison (<=)',
    category: 'comparison',
    operator: 'lte',
  },

  // String
  { id: 'contains', label: 'Contains', description: 'Substring match', category: 'string', operator: 'contains' },
  {
    id: 'startsWith',
    label: 'Starts With',
    description: 'Prefix match',
    category: 'string',
    operator: 'startsWith',
  },
  { id: 'endsWith', label: 'Ends With', description: 'Suffix match', category: 'string', operator: 'endsWith' },
  {
    id: 'isEmpty',
    label: 'Is Empty',
    description: 'Null, undefined, or empty string',
    category: 'string',
    operator: 'isEmpty',
    unary: true,
  },
  {
    id: 'exists',
    label: 'Exists',
    description: 'Not null or undefined',
    category: 'string',
    operator: 'exists',
    unary: true,
  },

  // Validation (regex-based)
  {
    id: 'isEmail',
    label: 'Is Email',
    description: 'Valid email format',
    category: 'validation',
    operator: 'matches',
    regex: '^[\\w.-]{1,64}@[\\w.-]{1,255}\\.\\w{2,10}$',
  },
  {
    id: 'isUrl',
    label: 'Is URL',
    description: 'Valid URL format',
    category: 'validation',
    operator: 'matches',
    regex: '^https?://[\\w.-]{1,255}(?:/[\\w./-]{0,2000})?$',
  },
  {
    id: 'isUuid',
    label: 'Is UUID',
    description: 'UUID v4 format',
    category: 'validation',
    operator: 'matches',
    regex: '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  },
  {
    id: 'isPhone',
    label: 'Is Phone',
    description: 'Phone number format',
    category: 'validation',
    operator: 'matches',
    regex: '^\\+?[0-9]{10,15}$',
  },
  {
    id: 'customRegex',
    label: 'Custom Pattern',
    description: 'Write your own regex',
    category: 'validation',
    operator: 'matches',
  },
];

/**
 * Get presets filtered by category
 */
export function getPresetsByCategory(category: PatternPreset['category']): PatternPreset[] {
  return PATTERN_PRESETS.filter((p) => p.category === category);
}

/**
 * Find a preset by its ID
 */
export function getPresetById(id: string): PatternPreset | undefined {
  return PATTERN_PRESETS.find((p) => p.id === id);
}

/**
 * Create a Condition from a preset selection
 */
export function createConditionFromPreset(preset: PatternPreset, left: string, right?: string): Condition {
  return {
    left,
    operator: preset.operator,
    right: preset.regex || right,
  };
}

/**
 * Resolve preset ID from an existing condition
 * Used to restore the correct preset when editing an existing condition
 */
export function resolvePresetFromCondition(condition: Condition): string {
  // Check validation presets first (they have fixed regex)
  if (condition.operator === 'matches' && condition.right) {
    const validationPreset = PATTERN_PRESETS.find((p) => p.regex === condition.right);
    if (validationPreset) return validationPreset.id;
    return 'customRegex';
  }

  // Match by operator for non-regex presets
  const preset = PATTERN_PRESETS.find((p) => p.operator === condition.operator && !p.regex);
  return preset?.id || 'eq';
}
