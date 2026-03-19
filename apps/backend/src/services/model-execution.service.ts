/**
 * Model Execution Service
 *
 * Orchestrates batch execution of scenarios generated from a TestModel.
 * Reuses a single browser instance across all scenarios for efficiency.
 */

import type { Scenario } from '@like-cake/ast-types';
import {
  type RunnerOptions,
  type ScenarioExecutionResult,
  ScenarioRunner,
} from '@like-cake/runner';

export interface ModelExecutionOptions {
  headless?: boolean;
  timeout?: number;
  baseUrl?: string;
  viewport?: { width: number; height: number };
  continueOnFailure?: boolean;
}

export interface ModelScenarioResult {
  scenarioId: string;
  scenarioName: string;
  status: 'passed' | 'failed' | 'skipped';
  stepResults: ScenarioExecutionResult['stepResults'];
  summary: ScenarioExecutionResult['summary'];
  duration: number;
}

export interface ModelExecutionResult {
  modelId: string;
  modelName: string;
  status: 'passed' | 'failed' | 'partial';
  scenarioResults: ModelScenarioResult[];
  summary: {
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    skippedScenarios: number;
    totalSteps: number;
    passedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    duration: number;
  };
  startedAt: number;
  endedAt: number;
}

export class ModelExecutionService {
  async execute(
    modelId: string,
    modelName: string,
    scenarios: Scenario[],
    options: ModelExecutionOptions = {}
  ): Promise<ModelExecutionResult> {
    const startedAt = Date.now();
    const scenarioResults: ModelScenarioResult[] = [];

    if (scenarios.length === 0) {
      return {
        modelId,
        modelName,
        status: 'passed',
        scenarioResults: [],
        summary: {
          totalScenarios: 0,
          passedScenarios: 0,
          failedScenarios: 0,
          skippedScenarios: 0,
          totalSteps: 0,
          passedSteps: 0,
          failedSteps: 0,
          skippedSteps: 0,
          duration: 0,
        },
        startedAt,
        endedAt: Date.now(),
      };
    }

    const runnerOptions: Partial<RunnerOptions> = {
      headless: options.headless ?? true,
      defaultTimeout: options.timeout ?? 30000,
      screenshotOnFailure: true,
      continueOnFailure: false,
      ...(options.baseUrl && { baseUrl: options.baseUrl }),
      ...(options.viewport && { viewport: options.viewport }),
    };

    const runner = new ScenarioRunner(runnerOptions);
    let hasFailed = false;

    try {
      await runner.init();

      for (const scenario of scenarios) {
        if (hasFailed && !options.continueOnFailure) {
          scenarioResults.push({
            scenarioId: scenario.id,
            scenarioName: scenario.name || 'Unnamed',
            status: 'skipped',
            stepResults: [],
            summary: {
              totalSteps: scenario.steps.length,
              passed: 0,
              failed: 0,
              skipped: scenario.steps.length,
              duration: 0,
              success: false,
            },
            duration: 0,
          });
          continue;
        }

        try {
          const result = await runner.run(scenario);
          const passed = result.summary.success;

          scenarioResults.push({
            scenarioId: scenario.id,
            scenarioName: scenario.name || 'Unnamed',
            status: passed ? 'passed' : 'failed',
            stepResults: result.stepResults,
            summary: result.summary,
            duration: result.summary.duration,
          });

          if (!passed) hasFailed = true;
        } catch (_error) {
          hasFailed = true;
          scenarioResults.push({
            scenarioId: scenario.id,
            scenarioName: scenario.name || 'Unnamed',
            status: 'failed',
            stepResults: [],
            summary: {
              totalSteps: scenario.steps.length,
              passed: 0,
              failed: 1,
              skipped: scenario.steps.length - 1,
              duration: 0,
              success: false,
            },
            duration: 0,
          });
        }
      }
    } finally {
      await runner.close();
    }

    const endedAt = Date.now();
    const passedScenarios = scenarioResults.filter((r) => r.status === 'passed').length;
    const failedScenarios = scenarioResults.filter((r) => r.status === 'failed').length;
    const skippedScenarios = scenarioResults.filter((r) => r.status === 'skipped').length;

    const totalSteps = scenarioResults.reduce((sum, r) => sum + r.summary.totalSteps, 0);
    const passedSteps = scenarioResults.reduce((sum, r) => sum + r.summary.passed, 0);
    const failedSteps = scenarioResults.reduce((sum, r) => sum + r.summary.failed, 0);
    const skippedSteps = scenarioResults.reduce((sum, r) => sum + r.summary.skipped, 0);

    const overallStatus =
      failedScenarios === 0 ? 'passed' : passedScenarios > 0 ? 'partial' : 'failed';

    return {
      modelId,
      modelName,
      status: overallStatus,
      scenarioResults,
      summary: {
        totalScenarios: scenarios.length,
        passedScenarios,
        failedScenarios,
        skippedScenarios,
        totalSteps,
        passedSteps,
        failedSteps,
        skippedSteps,
        duration: endedAt - startedAt,
      },
      startedAt,
      endedAt,
    };
  }
}

export const modelExecutionService = new ModelExecutionService();
