/**
 * State machine model types for Model-Based Testing
 *
 * A TestModel describes states, transitions, and element bindings.
 * XState will later consume this to generate all possible test paths.
 */

import type { FlowCondition } from '@like-cake/ast-types';
import type { ElementBinding } from './element-binding';

/** A catalog event bound to a specific element and parameterized */
export interface BoundEvent {
  /** Reference to EventCatalogEntry.id */
  eventId: string;
  /** Reference to ElementBinding.id (null when elementRequirement is 'none') */
  elementBindingId: string | null;
  /** Resolved parameter values */
  params: Record<string, unknown>;
}

/** A catalog verification bound to a specific element and parameterized */
export interface BoundVerification {
  /** Reference to VerificationCatalogEntry.id */
  verificationId: string;
  /** Reference to ElementBinding.id (null when elementRequirement is 'none') */
  elementBindingId: string | null;
  /** Resolved parameter values */
  params: Record<string, unknown>;
  /** Whether test should fail when this verification fails */
  critical: boolean;
}

/** A state in the test model */
export interface ModelState {
  /** Unique state identifier */
  id: string;
  /** Human-readable state name */
  name: string;
  /** Verifications to assert when entering this state */
  verifications: BoundVerification[];
  /** Whether this is the initial state */
  isInitial?: boolean;
  /** Whether this is a final (accepting) state */
  isFinal?: boolean;
}

/** A transition between two states */
export interface ModelTransition {
  /** Unique transition identifier */
  id: string;
  /** Source state ID */
  sourceStateId: string;
  /** Target state ID */
  targetStateId: string;
  /** The event that triggers this transition */
  event: BoundEvent;
  /** Optional guard condition (reuses existing FlowCondition) */
  guard?: FlowCondition;
}

/** Complete test model — serializable as a single JSON document */
export interface TestModel {
  /** Unique model identifier */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Optional description */
  description?: string;
  /** All states in the model */
  states: ModelState[];
  /** All transitions between states */
  transitions: ModelTransition[];
  /** Shared element bindings (referenced by ID from events/verifications) */
  elementBindings: ElementBinding[];
  /** Base URL for navigation */
  baseUrl: string;
  /** Shared variables available to all states/transitions */
  variables?: Record<string, string | number | boolean>;
  /** Model metadata */
  meta: {
    createdAt: number;
    updatedAt: number;
    version: number;
  };
}
