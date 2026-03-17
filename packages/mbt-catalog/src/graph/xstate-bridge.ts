/**
 * XState isolation layer
 *
 * This is the ONLY file in the codebase that imports xstate.
 * It converts the plain XStateMachineConfig to a real xstate machine
 * and extracts raw graph paths using xstate/graph traversal utilities.
 */

import { setup } from 'xstate';
import { getShortestPaths, getSimplePaths } from 'xstate/graph';
import type { XStateMachineConfig } from '../converters/types';
import type { TraversalStrategy } from './types';

/** A single transition in a raw graph path */
export interface RawGraphSegment {
  /** The event type that triggered this transition (= transition ID in our model) */
  eventType: string;
  /** The target state reached after this transition */
  targetStateId: string;
}

/** A complete path through the state machine */
export interface RawGraphPath {
  /** Ordered list of state IDs visited (length = segments.length + 1) */
  stateIds: string[];
  /** Ordered transitions taken */
  segments: RawGraphSegment[];
}

/**
 * Create an xstate machine from a plain config and extract all paths.
 *
 * Guards are registered as no-op `() => true` so all branches are explored.
 * The `xstate.init` bootstrap event is filtered out from returned paths.
 *
 * @param config - Plain XState machine config (from convertModelToXStateMachineConfig)
 * @param strategy - 'shortest' (Dijkstra) or 'simple' (all acyclic paths via DFS)
 * @returns Array of raw graph paths normalized to our format
 */
export const extractRawPaths = (
  config: XStateMachineConfig,
  strategy: TraversalStrategy,
): RawGraphPath[] => {
  // Strip entry actions — we only need graph topology for path traversal,
  // not action execution. xstate v5 expects action functions, not plain strings.
  const strippedStates: Record<string, Record<string, unknown>> = {};
  for (const [key, stateConfig] of Object.entries(config.states)) {
    const { entry: _entry, ...rest } = stateConfig;
    strippedStates[key] = rest;
  }

  // biome-ignore lint/suspicious/noExplicitAny: xstate internal types are complex; we control the input shape
  const machine = setup({
    guards: {
      flowCondition: () => true,
    },
  }).createMachine({
    id: config.id,
    initial: config.initial,
    context: config.context,
    states: strippedStates,
  } as any);

  const xstatePaths =
    strategy === 'shortest' ? getShortestPaths(machine) : getSimplePaths(machine);

  return xstatePaths.map(normalizeXStatePath);
};

/**
 * Normalize an xstate/graph path into our RawGraphPath format.
 *
 * xstate v5 path structure:
 * - path.state.value = final state reached
 * - path.steps[] = { state: { value: stateId }, event: { type: eventType } }
 *   where step.state.value is the state AFTER the event
 *   first step always has event.type = 'xstate.init'
 */
const normalizeXStatePath = (path: {
  state: { value: unknown };
  steps: Array<{ state: { value: unknown }; event: { type: string } }>;
}): RawGraphPath => {
  const stateIds: string[] = [];
  const segments: RawGraphSegment[] = [];

  for (const step of path.steps) {
    const stateId = String(step.state.value);

    if (step.event.type === 'xstate.init') {
      // First step — record the initial state
      stateIds.push(stateId);
    } else {
      // Subsequent steps — record transition + target state
      segments.push({
        eventType: step.event.type,
        targetStateId: stateId,
      });
      stateIds.push(stateId);
    }
  }

  return { stateIds, segments };
};
