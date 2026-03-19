/**
 * Scenario → TestModel auto-generator
 *
 * Converts a recorded Scenario into a TestModel by:
 * 1. Classifying steps as UI actions or verifications
 * 2. Creating states at action boundaries
 * 3. Grouping consecutive verifications into state verifications
 * 4. Deduplicating ElementBindings
 */

import type { Scenario, Step } from '@like-cake/ast-types';
import { getEventById } from '../catalogs/events';
import type { BoundVerification, ModelState, ModelTransition, TestModel } from '../types/model';
import { ElementBindingRegistry } from './binding-utils';
import { convertStepToEvent } from './step-to-event';
import { convertStepToVerification } from './step-to-verification';
import type { ScenarioToModelResult, UnmappedStep } from './types';

/** Step types that represent UI actions (cause state transitions) */
const ACTION_TYPES = new Set([
  'navigate',
  'click',
  'type',
  'keypress',
  'wait',
  'hover',
  'scroll',
  'select',
  'mouseOut',
  'dragAndDrop',
  'fileUpload',
  'historyBack',
  'historyForward',
]);

/** Step types that represent verifications (added to current state) */
const VERIFICATION_TYPES = new Set(['assertElement', 'assertApi', 'assertPage', 'assertStyle']);

let idCounter = 0;
const nextId = (): string => `s${Date.now()}-${++idCounter}`;

/** Generate a state name based on the triggering event */
const generateStateName = (
  eventId: string,
  step: Step,
  nameCounters: Map<string, number>
): string => {
  let baseName: string;

  if (step.type === 'navigate') {
    try {
      const url = new URL(step.url);
      baseName = `Page: ${url.hostname}${url.pathname}`;
    } catch {
      baseName = `Page: ${step.url}`;
    }
  } else {
    const entry = getEventById(eventId);
    baseName = `After ${entry?.label ?? eventId}`;
  }

  const count = (nameCounters.get(baseName) ?? 0) + 1;
  nameCounters.set(baseName, count);

  return count > 1 ? `${baseName} (${count})` : baseName;
};

/**
 * Convert a Scenario into a TestModel.
 *
 * @param scenario - Recorded scenario with steps
 * @param options - Optional model metadata overrides
 * @returns TestModel + list of unmapped steps
 */
export const convertScenarioToModel = (
  scenario: Scenario,
  options?: { modelName?: string; modelDescription?: string }
): ScenarioToModelResult => {
  const registry = new ElementBindingRegistry();
  const unmappedSteps: UnmappedStep[] = [];
  const nameCounters = new Map<string, number>();

  // Create initial state
  const initialState: ModelState = {
    id: nextId(),
    name: '시작',
    verifications: [],
    isInitial: true,
  };

  const states: ModelState[] = [initialState];
  const transitions: ModelTransition[] = [];
  let currentState = initialState;
  const pendingVerifications: BoundVerification[] = [];

  const flushVerifications = () => {
    if (pendingVerifications.length > 0) {
      currentState.verifications.push(...pendingVerifications);
      pendingVerifications.length = 0;
    }
  };

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];

    if (ACTION_TYPES.has(step.type)) {
      const result = convertStepToEvent(step, registry);
      if (!result) {
        unmappedSteps.push({ index: i, step, reason: `Unsupported action type: ${step.type}` });
        continue;
      }

      // Flush pending verifications to current state
      flushVerifications();

      // Create new state
      const newState: ModelState = {
        id: nextId(),
        name: generateStateName(result.boundEvent.eventId, step, nameCounters),
        verifications: [],
      };
      states.push(newState);

      // Create transition
      transitions.push({
        id: `t-${currentState.id}-${newState.id}`,
        sourceStateId: currentState.id,
        targetStateId: newState.id,
        event: result.boundEvent,
      });

      currentState = newState;
    } else if (VERIFICATION_TYPES.has(step.type)) {
      const result = convertStepToVerification(step, registry);
      if (!result) {
        unmappedSteps.push({
          index: i,
          step,
          reason: `Unsupported verification type: ${step.type}`,
        });
        continue;
      }
      pendingVerifications.push(result.boundVerification);
    } else {
      unmappedSteps.push({
        index: i,
        step,
        reason: `Step type "${step.type}" has no catalog mapping`,
      });
    }
  }

  // Flush remaining verifications
  flushVerifications();

  // Mark last state as final
  if (states.length > 0) {
    states[states.length - 1].isFinal = true;
  }

  // Derive baseUrl from scenario meta or first navigate step
  const baseUrl = scenario.meta?.url ?? '';

  const now = Date.now();
  const model: TestModel = {
    id: `model-${now}`,
    name: options?.modelName ?? scenario.name ?? 'Imported Model',
    description: options?.modelDescription ?? scenario.description,
    states,
    transitions,
    elementBindings: registry.getAll(),
    baseUrl,
    meta: { createdAt: now, updatedAt: now, version: 1 },
  };

  return { model, unmappedSteps };
};
