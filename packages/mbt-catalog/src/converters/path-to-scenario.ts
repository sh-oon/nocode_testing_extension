/**
 * TestPath → Scenario converter
 *
 * Walks a TestPath's alternating state/transition nodes,
 * converting each to executable Steps and assembling a Scenario.
 * Unsupported mappings are collected in an errors array without halting conversion.
 */

import type { Scenario, Step } from '@like-cake/ast-types';
import type { TestModel } from '../types/model';
import { convertBoundEventToStep } from './event-to-step';
import type { TestPath, UnsupportedMappingError } from './types';
import { convertBoundVerificationToStep } from './verification-to-step';

/**
 * Convert a TestPath into an executable Scenario.
 *
 * @param path - The state machine path (alternating state/transition nodes)
 * @param model - The source TestModel (for element bindings and metadata)
 * @returns Scenario + collected unsupported mapping errors
 */
export const convertTestPathToScenario = (
  path: TestPath,
  model: TestModel
): { scenario: Scenario; errors: UnsupportedMappingError[] } => {
  const steps: Step[] = [];
  const errors: UnsupportedMappingError[] = [];

  for (const node of path.nodes) {
    if (node.kind === 'state') {
      // Convert each verification in the state to a step
      for (const verification of node.state.verifications) {
        const result = convertBoundVerificationToStep(verification, model.elementBindings);
        if (result.ok) {
          const step = { ...result.step };
          // Non-critical verifications become optional steps
          if (!verification.critical) {
            step.optional = true;
          }
          steps.push(step);
        } else {
          errors.push(result.error);
        }
      }
    } else {
      // Convert the transition's event to a step
      const result = convertBoundEventToStep(node.transition.event, model.elementBindings);
      if (result.ok) {
        steps.push(result.step);
      } else {
        errors.push(result.error);
      }
    }
  }

  const scenario: Scenario = {
    id: path.id,
    name: path.name,
    meta: {
      url: model.baseUrl,
      viewport: { width: 1280, height: 720 },
      recordedAt: new Date().toISOString(),
      astSchemaVersion: '1.0.0',
    },
    steps,
    variables: model.variables,
  };

  return { scenario, errors };
};
