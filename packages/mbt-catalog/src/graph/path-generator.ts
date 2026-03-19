/**
 * Path generator — TestModel → TestPath[]
 *
 * Orchestrates the conversion from TestModel to structured TestPath objects
 * by bridging the XState graph traversal output with the MBT model types.
 */

import { convertModelToXStateMachineConfig } from '../converters/model-to-xstate';
import type { TestPath, TestPathNode } from '../converters/types';
import type { ModelState, ModelTransition, TestModel } from '../types/model';
import type { PathGenerationOptions, PathGenerationResult } from './types';
import type { RawGraphPath } from './xstate-bridge';
import { extractRawPaths } from './xstate-bridge';

/**
 * Generate test paths from a TestModel.
 *
 * @param model - The complete test model
 * @param options - Traversal strategy, limits, and filters
 * @returns Generated paths with metadata and warnings
 */
export const generateTestPaths = (
  model: TestModel,
  options?: PathGenerationOptions
): PathGenerationResult => {
  const strategy = options?.strategy ?? 'shortest';
  const maxPaths = options?.maxPaths ?? 0;
  const requireFinalState = options?.requireFinalState ?? true;

  // Phase 2 converter: TestModel → plain XState config
  const config = convertModelToXStateMachineConfig(model);

  // XState bridge: config → raw graph paths
  const rawPaths = extractRawPaths(config, strategy);

  // Build O(1) lookup maps
  const stateMap = new Map(model.states.map((s) => [s.id, s]));
  const transitionMap = buildTransitionLookup(model.transitions);

  // Convert raw paths → TestPath[]
  const warnings: string[] = [];
  let paths = rawPaths
    .map((raw, idx) => rawPathToTestPath(raw, idx, model.id, stateMap, transitionMap))
    .filter((p): p is TestPath => p !== undefined);

  // Filter: must reach a final state
  if (requireFinalState) {
    const finalStateIds = new Set(model.states.filter((s) => s.isFinal).map((s) => s.id));
    const before = paths.length;
    paths = paths.filter((p) => {
      const lastStateNode = findLastStateNode(p.nodes);
      return lastStateNode !== undefined && finalStateIds.has(lastStateNode.id);
    });
    const filtered = before - paths.length;
    if (filtered > 0) {
      warnings.push(`Filtered ${filtered} path(s) that did not reach a final state.`);
    }
  }

  const totalFound = paths.length;

  // Apply maxPaths limit
  if (maxPaths > 0 && paths.length > maxPaths) {
    paths = paths.slice(0, maxPaths);
  }

  return { paths, totalFound, strategy, warnings };
};

/** Build a lookup map: eventType (transition.id) → ModelTransition */
const buildTransitionLookup = (transitions: ModelTransition[]): Map<string, ModelTransition> =>
  new Map(transitions.map((t) => [t.id, t]));

/** Find the last state node in a TestPath's node list */
const findLastStateNode = (nodes: TestPathNode[]): ModelState | undefined => {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node.kind === 'state') return node.state;
  }
  return undefined;
};

/**
 * Convert a single RawGraphPath to a TestPath by interleaving state/transition nodes.
 * Returns undefined if any state or transition can't be resolved (shouldn't happen).
 */
const rawPathToTestPath = (
  raw: RawGraphPath,
  index: number,
  modelId: string,
  stateMap: Map<string, ModelState>,
  transitionMap: Map<string, ModelTransition>
): TestPath | undefined => {
  const nodes: TestPathNode[] = [];

  for (let i = 0; i < raw.stateIds.length; i++) {
    const state = stateMap.get(raw.stateIds[i]);
    if (state === undefined) return undefined;
    nodes.push({ kind: 'state', state });

    // After each state except the last, there's a transition segment
    if (i < raw.segments.length) {
      const transition = transitionMap.get(raw.segments[i].eventType);
      if (transition === undefined) return undefined;
      nodes.push({ kind: 'transition', transition });
    }
  }

  // Human-readable name: state names joined with →
  const name = raw.stateIds.map((id) => stateMap.get(id)?.name ?? id).join(' → ');

  return {
    id: `${modelId}_path_${index}`,
    name,
    modelId,
    nodes,
  };
};
