/**
 * @like-cake/variable-store
 *
 * Variable management system for flow execution with:
 * - Nested path access (user.profile.name)
 * - Template interpolation ({{variable}})
 * - JSONPath extraction from API responses
 * - Condition evaluation for flow branching
 */

export * from './patterns';
export * from './types';
export { VariableStore } from './variable-store';
