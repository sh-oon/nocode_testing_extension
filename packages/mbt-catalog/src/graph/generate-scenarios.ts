/**
 * Top-level orchestration: TestModel → Scenario[]
 *
 * Combines path generation (Phase 3) with path→scenario conversion (Phase 2)
 * to produce executable Scenario objects from a state machine model.
 */

import type { Scenario } from '@like-cake/ast-types';
import type { TestModel } from '../types/model';
import type { UnsupportedMappingError } from '../converters/types';
import { convertTestPathToScenario } from '../converters/path-to-scenario';
import type { PathGenerationOptions } from './types';
import { generateTestPaths } from './path-generator';

/** Result of the full model → scenarios pipeline */
export interface ScenarioGenerationResult {
  /** Executable scenarios ready for step-player */
  scenarios: Scenario[];
  /** Total number of paths generated */
  pathCount: number;
  /** Unsupported mapping errors collected during conversion */
  errors: UnsupportedMappingError[];
  /** Warnings from path generation (e.g., filtered paths) */
  warnings: string[];
}

/**
 * Generate executable Scenarios from a TestModel.
 *
 * Pipeline: TestModel → XStateMachineConfig → graph paths → TestPath[] → Scenario[]
 *
 * @param model - The complete test model
 * @param options - Path generation options (strategy, limits, filters)
 * @returns Scenarios, path count, conversion errors, and warnings
 */
export const generateScenariosFromModel = (
  model: TestModel,
  options?: PathGenerationOptions,
): ScenarioGenerationResult => {
  const pathResult = generateTestPaths(model, options);

  const scenarios: Scenario[] = [];
  const allErrors: UnsupportedMappingError[] = [];

  for (const path of pathResult.paths) {
    const { scenario, errors } = convertTestPathToScenario(path, model);
    scenarios.push(scenario);
    allErrors.push(...errors);
  }

  return {
    scenarios,
    pathCount: pathResult.totalFound,
    errors: allErrors,
    warnings: pathResult.warnings,
  };
};
