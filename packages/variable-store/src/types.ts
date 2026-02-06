/**
 * Variable Store Types
 * Defines types for flow variable management system
 *
 * Shared types are imported from @like-cake/ast-types to avoid duplication.
 * Backward-compatible aliases (VariableValue, Condition) are re-exported here.
 */

import type {
  ConditionOperator,
  ExtractionSource,
  FlowCondition,
  FlowVariableValue,
  VariableExtraction,
} from '@like-cake/ast-types';

// Re-export shared types from ast-types
export type { ConditionOperator, ExtractionSource, FlowCondition, FlowVariableValue, VariableExtraction };

// Backward-compatible aliases
export type VariableValue = FlowVariableValue;
export type Condition = FlowCondition;

/**
 * Variable definition with metadata
 */
export interface VariableDefinition {
  /** Variable name */
  name: string;
  /** Variable value */
  value: VariableValue;
  /** Variable type hint */
  type: 'string' | 'number' | 'boolean' | 'json';
  /** Optional description */
  description?: string;
  /** Source of the variable (manual, extraction, etc.) */
  source?: 'manual' | 'extraction' | 'computed';
}

/**
 * Compound condition with logical operators
 */
export interface CompoundCondition {
  /** Logical operator */
  logic: 'and' | 'or';
  /** Array of conditions */
  conditions: (Condition | CompoundCondition)[];
}

/**
 * Options for VariableStore initialization
 */
export interface VariableStoreOptions {
  /** Initial variables */
  initialVariables?: Record<string, VariableValue>;
  /** Whether to throw on missing variables during interpolation */
  throwOnMissing?: boolean;
  /** Prefix for variable interpolation (default: '{{') */
  interpolationPrefix?: string;
  /** Suffix for variable interpolation (default: '}}') */
  interpolationSuffix?: string;
}

/**
 * Result of condition evaluation
 */
export interface ConditionResult {
  /** Whether the condition passed */
  result: boolean;
  /** The evaluated left value */
  leftValue: VariableValue;
  /** The evaluated right value (if applicable) */
  rightValue?: VariableValue;
  /** Error if evaluation failed */
  error?: string;
}
