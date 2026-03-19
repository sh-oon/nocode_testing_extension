/**
 * Converter types for MBT catalog → step-player transformation
 *
 * All types here are plain objects with no runtime dependencies.
 * XState config is a serializable plain object (no xstate import needed).
 */

import type { FlowCondition, Step } from '@like-cake/ast-types';
import type { ElementBinding } from '../types/element-binding';
import type {
  BoundEvent,
  BoundVerification,
  ModelState,
  ModelTransition,
  TestModel,
} from '../types/model';

// ── TestPath: 상태머신에서 추출한 경로 ──────────────────────────────────

export type TestPathNode =
  | { kind: 'state'; state: ModelState }
  | { kind: 'transition'; transition: ModelTransition };

export interface TestPath {
  /** Unique path identifier */
  id: string;
  /** Human-readable path name (e.g., "Login → Dashboard → Logout") */
  name: string;
  /** Reference to the source TestModel */
  modelId: string;
  /** Alternating state/transition sequence: [state, transition, state, ...] */
  nodes: TestPathNode[];
}

// ── ConversionResult: ok/error discriminated union ──────────────────────

export interface UnsupportedMappingError {
  /** ID of the catalog entry that failed to convert */
  catalogEntryId: string;
  /** Whether it was an event or verification catalog entry */
  catalogType: 'event' | 'verification';
  /** Human-readable reason for failure */
  message: string;
}

export type ConversionResult<T = Step> =
  | { ok: true; step: T }
  | { ok: false; error: UnsupportedMappingError };

// ── Reverse conversion result types ──────────────────────────────────────

/** Result of converting a UI action Step to a BoundEvent */
export interface StepToEventResult {
  boundEvent: BoundEvent;
  elementBinding: ElementBinding | null;
}

/** Result of converting an assertion Step to a BoundVerification */
export interface StepToVerificationResult {
  boundVerification: BoundVerification;
  elementBinding: ElementBinding | null;
}

/** A step that could not be mapped to a catalog entry */
export interface UnmappedStep {
  index: number;
  step: Step;
  reason: string;
}

/** Result of converting a Scenario to a TestModel */
export interface ScenarioToModelResult {
  model: TestModel;
  unmappedSteps: UnmappedStep[];
}

// ── XState machine config (plain object, no xstate dependency) ──────────

export interface XStateGuard {
  type: 'flowCondition';
  params: { condition: FlowCondition };
}

export interface XStateTransitionConfig {
  target: string;
  guard?: XStateGuard;
  meta?: { transitionId: string };
}

export interface XStateStateConfig {
  /** Action names to execute on state entry (e.g., verification actions) */
  entry?: string[];
  /** Event-keyed transitions */
  on?: Record<string, XStateTransitionConfig | XStateTransitionConfig[]>;
  /** 'final' marks terminal states */
  type?: 'final';
  /** State metadata for debugging and reporting */
  meta?: { name: string; verificationCount: number };
}

export interface XStateMachineConfig {
  id: string;
  initial: string;
  context: {
    modelId: string;
    baseUrl: string;
    variables: Record<string, string | number | boolean>;
  };
  states: Record<string, XStateStateConfig>;
}
