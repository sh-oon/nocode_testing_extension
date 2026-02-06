import type { Scenario, StepResult } from '@like-cake/ast-types';
import { ScenarioRunner, type RunnerOptions, type ScenarioExecutionResult } from '@like-cake/runner';
import { nanoid } from 'nanoid';
import type { WebSocket } from 'ws';
import { scenarioService } from './scenario.service';

/**
 * Execution progress event types
 */
export type ExecutionEvent =
  | { type: 'started'; executionId: string; scenarioId: string; totalSteps: number }
  | { type: 'step_start'; executionId: string; stepIndex: number; stepId: string; stepType: string }
  | { type: 'step_complete'; executionId: string; stepIndex: number; result: StepResult }
  | { type: 'completed'; executionId: string; result: ScenarioExecutionResult }
  | { type: 'error'; executionId: string; error: string };

/**
 * Active execution state
 */
interface ActiveExecution {
  id: string;
  scenarioId: string;
  runner: ScenarioRunner;
  startedAt: number;
  subscribers: Set<WebSocket>;
}

/**
 * Execution service for running scenarios via Puppeteer
 */
export class ExecutionService {
  private activeExecutions: Map<string, ActiveExecution> = new Map();

  /**
   * Execute a scenario by ID
   */
  async execute(
    scenarioId: string,
    options: Partial<RunnerOptions> = {},
    subscriber?: WebSocket,
    runtimeVariables?: Record<string, string | number | boolean>
  ): Promise<ScenarioExecutionResult> {
    // Get scenario from database
    const storedScenario = scenarioService.getById(scenarioId);
    if (!storedScenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    // Merge stored variables with runtime variables (runtime takes precedence)
    const mergedVariables = {
      ...(storedScenario.variables ?? {}),
      ...runtimeVariables,
    };

    // Convert to runner Scenario format
    const scenario: Scenario = {
      id: storedScenario.id,
      name: storedScenario.name,
      description: storedScenario.description,
      meta: {
        url: storedScenario.url,
        viewport: storedScenario.viewport,
        recordedAt: new Date(storedScenario.recordedAt).toISOString(),
        astSchemaVersion: storedScenario.astSchemaVersion,
      },
      steps: storedScenario.steps,
      setup: storedScenario.setup,
      teardown: storedScenario.teardown,
      variables: mergedVariables,
    };

    // Derive baseUrl from scenario URL if not explicitly provided
    const resolvedOptions = { ...options };
    if (!resolvedOptions.baseUrl && storedScenario.url) {
      try {
        const origin = new URL(storedScenario.url).origin;
        resolvedOptions.baseUrl = origin;
      } catch {
        // Invalid URL - skip baseUrl derivation
      }
    }

    const executionId = `exec-${nanoid(12)}`;
    const runner = new ScenarioRunner({
      headless: true,
      screenshotOnFailure: true,
      continueOnFailure: false,
      ...resolvedOptions,
    });

    // Track active execution
    const execution: ActiveExecution = {
      id: executionId,
      scenarioId,
      runner,
      startedAt: Date.now(),
      subscribers: new Set(),
    };

    if (subscriber) {
      execution.subscribers.add(subscriber);
    }

    this.activeExecutions.set(executionId, execution);

    try {
      // Notify start
      this.broadcast(execution, {
        type: 'started',
        executionId,
        scenarioId,
        totalSteps: scenario.steps.length,
      });

      // Initialize runner
      await runner.init();

      // Run scenario with progress tracking
      const result = await this.runWithProgress(execution, scenario);

      // Notify completion
      this.broadcast(execution, {
        type: 'completed',
        executionId,
        result,
      });

      // Save execution result to database
      scenarioService.addExecutionResult(scenarioId, {
        status: result.summary.success ? 'passed' : 'failed',
        totalSteps: result.summary.totalSteps,
        passed: result.summary.passed,
        failed: result.summary.failed,
        skipped: result.summary.skipped,
        duration: result.summary.duration,
        stepResults: result.stepResults,
        environment: {
          headless: options.headless ?? true,
          userAgent: options.userAgent,
        },
        executedAt: result.startedAt,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.broadcast(execution, {
        type: 'error',
        executionId,
        error: errorMessage,
      });

      throw error;
    } finally {
      await runner.close();
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Run scenario with step-by-step progress events
   */
  private async runWithProgress(
    execution: ActiveExecution,
    scenario: Scenario
  ): Promise<ScenarioExecutionResult> {
    // Unfortunately, the current runner doesn't expose step-by-step events
    // We'll need to run the full scenario and report completion
    // For now, just run the scenario directly
    const result = await execution.runner.run(scenario);

    // Emit step results after completion (not ideal, but works)
    for (let i = 0; i < result.stepResults.length; i++) {
      const stepResult = result.stepResults[i];

      this.broadcast(execution, {
        type: 'step_complete',
        executionId: execution.id,
        stepIndex: i,
        result: stepResult,
      });
    }

    return result;
  }

  /**
   * Subscribe to execution events
   */
  subscribe(executionId: string, ws: WebSocket): boolean {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) return false;

    execution.subscribers.add(ws);
    return true;
  }

  /**
   * Unsubscribe from execution events
   */
  unsubscribe(executionId: string, ws: WebSocket): void {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.subscribers.delete(ws);
    }
  }

  /**
   * Get active execution status
   */
  getStatus(executionId: string): { active: boolean; scenarioId?: string; startedAt?: number } {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return { active: false };
    }
    return {
      active: true,
      scenarioId: execution.scenarioId,
      startedAt: execution.startedAt,
    };
  }

  /**
   * Broadcast event to all subscribers
   */
  private broadcast(execution: ActiveExecution, event: ExecutionEvent): void {
    const message = JSON.stringify(event);
    for (const ws of execution.subscribers) {
      if (ws.readyState === 1) {
        // OPEN
        ws.send(message);
      }
    }
  }
}

// Export singleton instance
export const executionService = new ExecutionService();
