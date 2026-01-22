import { AST_SCHEMA_VERSION } from '../constants';
import { ScenarioInputSchema, ScenarioSchema, StepSchema } from '../schemas';
import type { Scenario, ScenarioInput, Step } from '../types';

export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] };

/**
 * Validate a scenario JSON
 */
export function validateScenario(data: unknown): ValidationResult<Scenario> {
  const result = ScenarioSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map((err) => ({
      path: err.path.map(String),
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Validate and normalize scenario input
 */
export function parseScenarioInput(data: unknown): ValidationResult<ScenarioInput> {
  const result = ScenarioInputSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data as ScenarioInput };
  }

  return {
    success: false,
    errors: result.error.errors.map((err) => ({
      path: err.path.map(String),
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Validate a single step
 */
export function validateStep(data: unknown): ValidationResult<Step> {
  const result = StepSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.errors.map((err) => ({
      path: err.path.map(String),
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Check if AST schema version is compatible
 */
export function isCompatibleVersion(version: string): boolean {
  const [major] = version.split('.');
  const [currentMajor] = AST_SCHEMA_VERSION.split('.');
  return major === currentMajor;
}

/**
 * Generate a unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a complete scenario from partial input
 */
export function createScenario(input: ScenarioInput): Scenario {
  return {
    id: input.id ?? generateId('scenario'),
    name: input.name,
    description: input.description,
    meta: {
      recordedAt: input.meta.recordedAt ?? new Date().toISOString(),
      astSchemaVersion: input.meta.astSchemaVersion ?? AST_SCHEMA_VERSION,
      url: input.meta.url,
      viewport: input.meta.viewport,
      userAgent: input.meta.userAgent,
      locale: input.meta.locale,
      extensionVersion: input.meta.extensionVersion,
      lastExecution: input.meta.lastExecution,
      tags: input.meta.tags,
      priority: input.meta.priority,
      author: input.meta.author,
      modifiedAt: input.meta.modifiedAt,
    },
    steps: input.steps.map((step, index) => ({
      ...step,
      id: step.id ?? `step-${index + 1}`,
    })),
    setup: input.setup,
    teardown: input.teardown,
    variables: input.variables,
  };
}

/**
 * Add auto-generated IDs to steps that don't have them
 */
export function normalizeStepIds(steps: Step[]): Step[] {
  return steps.map((step, index) => ({
    ...step,
    id: step.id ?? `step-${index + 1}`,
  }));
}
