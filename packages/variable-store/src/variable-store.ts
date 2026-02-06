/**
 * VariableStore - Core class for managing flow variables
 *
 * Features:
 * - Nested path access (user.profile.name)
 * - Template interpolation ({{variable}})
 * - JSONPath extraction from API responses
 * - Condition evaluation for flow branching
 */

import { JSONPath } from 'jsonpath-plus';
import type {
  Condition,
  ConditionOperator,
  ConditionResult,
  CompoundCondition,
  VariableStoreOptions,
  VariableValue,
} from './types';

/**
 * Check whether a regex pattern is safe from catastrophic backtracking (ReDoS).
 *
 * Heuristics applied:
 * 1. Pattern must be shorter than 500 characters.
 * 2. Pattern must be syntactically valid.
 * 3. Reject patterns with nested quantifiers (e.g. `(a+)+`, `(a*)*`, `(a+)*`, `([^a]+)+`).
 */
function isRegexSafe(pattern: string): boolean {
  // Length guard
  if (pattern.length >= 500) {
    return false;
  }

  // Syntax check
  try {
    new RegExp(pattern);
  } catch {
    return false;
  }

  // Detect nested quantifiers: a group that itself contains a quantifier, followed
  // by an outer quantifier.  This catches patterns like (a+)+, (.*?)*, ([^x]+){2,}, etc.
  const nestedQuantifier = /\([^)]*[+*]\)*[+*{]/;
  if (nestedQuantifier.test(pattern)) {
    return false;
  }

  return true;
}

export class VariableStore {
  private variables: Map<string, VariableValue> = new Map();
  private readonly throwOnMissing: boolean;
  private readonly interpolationPrefix: string;
  private readonly interpolationSuffix: string;

  constructor(options: VariableStoreOptions = {}) {
    this.throwOnMissing = options.throwOnMissing ?? false;
    this.interpolationPrefix = options.interpolationPrefix ?? '{{';
    this.interpolationSuffix = options.interpolationSuffix ?? '}}';

    if (options.initialVariables) {
      for (const [key, value] of Object.entries(options.initialVariables)) {
        this.set(key, value);
      }
    }
  }

  /**
   * Set a variable value
   * Supports nested paths: set('user.name', 'John')
   */
  set(name: string, value: VariableValue): void {
    if (name.includes('.')) {
      this.setNested(name, value);
    } else {
      this.variables.set(name, value);
    }
  }

  /**
   * Get a variable value
   * Supports nested paths: get('user.profile.name')
   * Supports JSONPath: get('$.user.addresses[0].city')
   */
  get(path: string): VariableValue {
    // Handle JSONPath expressions
    if (path.startsWith('$.')) {
      return this.getByJsonPath(path);
    }

    // Handle simple path
    if (!path.includes('.')) {
      return this.variables.get(path) ?? null;
    }

    // Handle nested path
    return this.getNested(path);
  }

  /**
   * Check if a variable exists
   */
  has(name: string): boolean {
    const value = this.get(name);
    return value !== null && value !== undefined;
  }

  /**
   * Delete a variable
   */
  delete(name: string): boolean {
    return this.variables.delete(name);
  }

  /**
   * Clear all variables
   */
  clear(): void {
    this.variables.clear();
  }

  /**
   * Get all variables as a plain object
   */
  getAll(): Record<string, VariableValue> {
    const result: Record<string, VariableValue> = {};
    for (const [key, value] of this.variables) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Merge variables from another object
   */
  merge(variables: Record<string, VariableValue>): void {
    for (const [key, value] of Object.entries(variables)) {
      this.set(key, value);
    }
  }

  /**
   * Interpolate template string with variables
   * Replaces {{varName}} with variable values
   *
   * @example
   * store.set('name', 'John');
   * store.interpolate('Hello, {{name}}!'); // 'Hello, John!'
   */
  interpolate(template: string): string {
    const pattern = new RegExp(
      `${this.escapeRegex(this.interpolationPrefix)}([^}]+)${this.escapeRegex(this.interpolationSuffix)}`,
      'g',
    );

    return template.replace(pattern, (match, path: string) => {
      const trimmedPath = path.trim();
      const value = this.get(trimmedPath);

      if (value === null || value === undefined) {
        if (this.throwOnMissing) {
          throw new Error(`Variable not found: ${trimmedPath}`);
        }
        return match; // Keep original placeholder
      }

      if (typeof value === 'object') {
        return JSON.stringify(value);
      }

      return String(value);
    });
  }

  /**
   * Extract value from data using JSONPath
   */
  extractJsonPath(data: unknown, jsonPath: string): VariableValue {
    try {
      const results = JSONPath({ path: jsonPath, json: data as object });
      if (results.length === 0) {
        return null;
      }
      return results.length === 1 ? results[0] : results;
    } catch {
      return null;
    }
  }

  /**
   * Extract and store a variable from data
   */
  extractAndStore(name: string, data: unknown, jsonPath: string, defaultValue?: VariableValue): VariableValue {
    const extracted = this.extractJsonPath(data, jsonPath);
    const value = extracted ?? defaultValue ?? null;
    this.set(name, value);
    return value;
  }

  /**
   * Evaluate a condition for flow branching
   */
  evaluateCondition(condition: Condition): ConditionResult {
    try {
      // Resolve left operand
      const leftValue = this.resolveOperand(condition.left);

      // For unary operators
      if (condition.operator === 'exists') {
        return {
          result: leftValue !== null && leftValue !== undefined,
          leftValue,
        };
      }

      if (condition.operator === 'isEmpty') {
        return {
          result: this.isEmpty(leftValue),
          leftValue,
        };
      }

      // For binary operators, resolve right operand
      const rightValue = condition.right !== undefined ? this.resolveOperand(condition.right) : undefined;

      const result = this.compareValues(leftValue, condition.operator, rightValue);

      return {
        result,
        leftValue,
        rightValue,
      };
    } catch (error) {
      return {
        result: false,
        leftValue: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Evaluate a compound condition (AND/OR logic)
   */
  evaluateCompoundCondition(compound: CompoundCondition): boolean {
    const results = compound.conditions.map((cond) => {
      if ('logic' in cond) {
        return this.evaluateCompoundCondition(cond);
      }
      return this.evaluateCondition(cond).result;
    });

    if (compound.logic === 'and') {
      return results.every(Boolean);
    }
    return results.some(Boolean);
  }

  /**
   * Create a snapshot of current variables
   */
  snapshot(): Record<string, VariableValue> {
    return JSON.parse(JSON.stringify(this.getAll()));
  }

  /**
   * Restore variables from a snapshot
   */
  restore(snapshot: Record<string, VariableValue>): void {
    this.clear();
    this.merge(snapshot);
  }

  // Private methods

  private setNested(path: string, value: VariableValue): void {
    const parts = path.split('.');
    const rootKey = parts[0];

    let current = this.variables.get(rootKey);
    if (current === null || current === undefined || typeof current !== 'object') {
      current = {};
    }

    // Navigate to the nested location and set value
    let obj = current as Record<string, VariableValue>;
    for (let i = 1; i < parts.length - 1; i++) {
      const key = parts[i];
      if (obj[key] === null || obj[key] === undefined || typeof obj[key] !== 'object') {
        obj[key] = {};
      }
      obj = obj[key] as Record<string, VariableValue>;
    }

    obj[parts[parts.length - 1]] = value;
    this.variables.set(rootKey, current);
  }

  private getNested(path: string): VariableValue {
    const parts = path.split('.');
    let current: VariableValue = this.variables.get(parts[0]) ?? null;

    for (let i = 1; i < parts.length; i++) {
      if (current === null || current === undefined) {
        return null;
      }
      if (typeof current !== 'object' || Array.isArray(current)) {
        // Handle array index access
        if (Array.isArray(current)) {
          const index = Number.parseInt(parts[i], 10);
          if (!Number.isNaN(index)) {
            current = current[index] ?? null;
            continue;
          }
        }
        return null;
      }
      current = (current as Record<string, VariableValue>)[parts[i]] ?? null;
    }

    return current;
  }

  private getByJsonPath(path: string): VariableValue {
    // Create a virtual root object from all variables
    const root = this.getAll();
    return this.extractJsonPath(root, path);
  }

  private resolveOperand(operand: string): VariableValue {
    const trimmed = operand.trim();

    // Check if it's a variable reference
    if (trimmed.startsWith(this.interpolationPrefix) && trimmed.endsWith(this.interpolationSuffix)) {
      const varPath = trimmed.slice(this.interpolationPrefix.length, -this.interpolationSuffix.length).trim();
      return this.get(varPath);
    }

    // Try to parse as JSON (for numbers, booleans, arrays, objects)
    try {
      return JSON.parse(trimmed);
    } catch {
      // Return as string literal
      return trimmed;
    }
  }

  private compareValues(left: VariableValue, operator: ConditionOperator, right?: VariableValue): boolean {
    switch (operator) {
      case 'eq':
        return this.deepEqual(left, right ?? null);

      case 'ne':
        return !this.deepEqual(left, right ?? null);

      case 'gt':
        return Number(left) > Number(right);

      case 'gte':
        return Number(left) >= Number(right);

      case 'lt':
        return Number(left) < Number(right);

      case 'lte':
        return Number(left) <= Number(right);

      case 'contains':
        return String(left).includes(String(right));

      case 'startsWith':
        return String(left).startsWith(String(right));

      case 'endsWith':
        return String(left).endsWith(String(right));

      case 'matches': {
        const pattern = String(right);
        if (!isRegexSafe(pattern)) {
          throw new Error(`Unsafe regex pattern rejected: ${pattern.length >= 500 ? 'pattern too long' : 'potential ReDoS risk'}`);
        }
        const regex = new RegExp(pattern);
        return regex.test(String(left));
      }

      case 'exists':
        return left !== null && left !== undefined;

      case 'isEmpty':
        return this.isEmpty(left);

      default:
        return false;
    }
  }

  private isEmpty(value: VariableValue): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string') {
      return value.length === 0;
    }
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }
    return false;
  }

  private deepEqual(a: VariableValue, b: VariableValue): boolean {
    if (a === b) return true;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object' && typeof b === 'object') {
      if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((val, i) => this.deepEqual(val, b[i]));
      }

      if (Array.isArray(a) || Array.isArray(b)) return false;

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;

      return keysA.every((key) => this.deepEqual((a as Record<string, VariableValue>)[key], (b as Record<string, VariableValue>)[key]));
    }

    return false;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
