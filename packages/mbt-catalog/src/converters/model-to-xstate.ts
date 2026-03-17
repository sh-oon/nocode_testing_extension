/**
 * TestModel → XStateMachineConfig converter
 *
 * Converts a TestModel into an XState-compatible plain object config.
 * No xstate runtime dependency — output is a serializable JSON structure
 * that can be fed to `createMachine()` in Phase 3.
 */

import type { TestModel } from '../types/model';
import type { XStateMachineConfig, XStateStateConfig, XStateTransitionConfig } from './types';

/**
 * Convert a TestModel to an XState machine configuration object.
 *
 * @param model - The complete test model with states and transitions
 * @returns Plain XState machine config object
 * @throws Error if no initial state is found
 */
export const convertModelToXStateMachineConfig = (model: TestModel): XStateMachineConfig => {
  const initialState = model.states.find((s) => s.isInitial);
  if (initialState === undefined) {
    throw new Error(`TestModel "${model.id}" has no initial state (isInitial: true).`);
  }

  const states: Record<string, XStateStateConfig> = {};

  for (const modelState of model.states) {
    const stateConfig: XStateStateConfig = {};

    // Verifications → entry actions
    if (modelState.verifications.length > 0) {
      stateConfig.entry = [`verify_${modelState.id}`];
    }

    // Final state marker
    if (modelState.isFinal) {
      stateConfig.type = 'final';
    }

    // State metadata
    stateConfig.meta = {
      name: modelState.name,
      verificationCount: modelState.verifications.length,
    };

    states[modelState.id] = stateConfig;
  }

  // Group transitions by source state, then by event key (transition.id)
  for (const transition of model.transitions) {
    const sourceState = states[transition.sourceStateId];
    if (sourceState === undefined) continue;

    if (sourceState.on === undefined) {
      sourceState.on = {};
    }

    const transitionConfig: XStateTransitionConfig = {
      target: transition.targetStateId,
      meta: { transitionId: transition.id },
    };

    // Guard condition
    if (transition.guard !== undefined) {
      transitionConfig.guard = {
        type: 'flowCondition',
        params: { condition: transition.guard },
      };
    }

    const eventKey = transition.id;
    const existing = sourceState.on[eventKey];

    if (existing === undefined) {
      sourceState.on[eventKey] = transitionConfig;
    } else if (Array.isArray(existing)) {
      existing.push(transitionConfig);
    } else {
      sourceState.on[eventKey] = [existing, transitionConfig];
    }
  }

  return {
    id: model.id,
    initial: initialState.id,
    context: {
      modelId: model.id,
      baseUrl: model.baseUrl,
      variables: model.variables ?? {},
    },
    states,
  };
};
