import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Scenario } from '@like-cake/ast-types';
import type { ScenarioExecutionResult } from '@like-cake/runner';
import { ModelExecutionService } from '../model-execution.service';

vi.mock('@like-cake/runner', () => ({
  ScenarioRunner: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    close: vi.fn(),
    run: vi.fn(),
    onStepEvent: vi.fn(),
  })),
}));

const makeScenario = (overrides: Partial<Scenario> & { id: string }): Scenario => {
  const { id, name, steps, ...rest } = overrides;
  return {
    id,
    name: name ?? `Scenario ${id}`,
    meta: { url: 'https://example.com', viewport: { width: 1280, height: 720 }, recordedAt: new Date().toISOString(), astSchemaVersion: '1.0.0' },
    steps: steps ?? [{ type: 'navigate', url: 'https://example.com' }],
    ...rest,
  };
};

const makeExecutionResult = (
  overrides: Partial<ScenarioExecutionResult> = {},
): ScenarioExecutionResult => ({
  scenarioId: 's1',
  scenarioName: 'Scenario s1',
  stepResults: [],
  summary: {
    totalSteps: 1,
    passed: 1,
    failed: 0,
    skipped: 0,
    duration: 100,
    success: true,
  },
  snapshots: [],
  apiCalls: [],
  startedAt: Date.now(),
  endedAt: Date.now() + 100,
  ...overrides,
});

describe('ModelExecutionService', () => {
  let service: ModelExecutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ModelExecutionService();
  });

  describe('execute — empty scenarios', () => {
    it('returns passed status with empty results and zeroed summary', async () => {
      const result = await service.execute('model-1', 'My Model', []);

      expect(result.modelId).toBe('model-1');
      expect(result.modelName).toBe('My Model');
      expect(result.status).toBe('passed');
      expect(result.scenarioResults).toEqual([]);
      expect(result.summary).toEqual({
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarios: 0,
        skippedScenarios: 0,
        totalSteps: 0,
        passedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
        duration: 0,
      });
    });

    it('does not instantiate ScenarioRunner when scenarios list is empty', async () => {
      await service.execute('model-1', 'My Model', []);

      const { ScenarioRunner } = await import('@like-cake/runner');
      expect(vi.mocked(ScenarioRunner)).not.toHaveBeenCalled();
    });
  });

  describe('execute — single passing scenario', () => {
    it('returns passed status and correct per-scenario result', async () => {
      const scenario = makeScenario({
        id: 's1',
        name: 'Login',
        steps: [
          { type: 'navigate', url: 'https://example.com' },
          { type: 'click', selector: 'button' },
        ],
      });

      const executionResult = makeExecutionResult({
        summary: { totalSteps: 2, passed: 2, failed: 0, skipped: 0, duration: 200, success: true },
      });

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(executionResult),
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', [scenario]);

      expect(result.status).toBe('passed');
      expect(result.scenarioResults).toHaveLength(1);

      const [scenarioResult] = result.scenarioResults;
      expect(scenarioResult.scenarioId).toBe('s1');
      expect(scenarioResult.scenarioName).toBe('Login');
      expect(scenarioResult.status).toBe('passed');
      expect(scenarioResult.summary.success).toBe(true);
    });

    it('aggregates summary correctly for a single passing scenario', async () => {
      const scenario = makeScenario({ id: 's1', steps: [{ type: 'navigate', url: 'https://example.com' }] });
      const executionResult = makeExecutionResult({
        summary: { totalSteps: 1, passed: 1, failed: 0, skipped: 0, duration: 150, success: true },
      });

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(executionResult),
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', [scenario]);

      expect(result.summary.totalScenarios).toBe(1);
      expect(result.summary.passedScenarios).toBe(1);
      expect(result.summary.failedScenarios).toBe(0);
      expect(result.summary.skippedScenarios).toBe(0);
      expect(result.summary.totalSteps).toBe(1);
      expect(result.summary.passedSteps).toBe(1);
      expect(result.summary.failedSteps).toBe(0);
      expect(result.summary.skippedSteps).toBe(0);
    });
  });

  describe('execute — single failing scenario', () => {
    it('returns failed status when the scenario summary.success is false', async () => {
      const scenario = makeScenario({ id: 's1' });
      const executionResult = makeExecutionResult({
        summary: { totalSteps: 1, passed: 0, failed: 1, skipped: 0, duration: 80, success: false },
      });

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(executionResult),
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', [scenario]);

      expect(result.status).toBe('failed');
      expect(result.scenarioResults[0].status).toBe('failed');
      expect(result.summary.failedScenarios).toBe(1);
      expect(result.summary.passedScenarios).toBe(0);
    });
  });

  describe('execute — multiple scenarios with continueOnFailure=false (default)', () => {
    it('skips remaining scenarios after the first failure', async () => {
      const scenarios = [
        makeScenario({ id: 's1', steps: [{ type: 'navigate', url: 'https://example.com' }] }),
        makeScenario({ id: 's2', steps: [{ type: 'navigate', url: 'https://example.com' }, { type: 'click', selector: 'a' }] }),
        makeScenario({ id: 's3', steps: [{ type: 'navigate', url: 'https://example.com' }] }),
      ];

      const failingResult = makeExecutionResult({
        summary: { totalSteps: 1, passed: 0, failed: 1, skipped: 0, duration: 50, success: false },
      });

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(failingResult),
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', scenarios, { continueOnFailure: false });

      expect(result.scenarioResults).toHaveLength(3);
      expect(result.scenarioResults[0].status).toBe('failed');
      expect(result.scenarioResults[1].status).toBe('skipped');
      expect(result.scenarioResults[2].status).toBe('skipped');
    });

    it('runner.run is called only once when first scenario fails and continueOnFailure=false', async () => {
      const scenarios = [
        makeScenario({ id: 's1' }),
        makeScenario({ id: 's2' }),
      ];

      const failingResult = makeExecutionResult({
        summary: { totalSteps: 1, passed: 0, failed: 1, skipped: 0, duration: 50, success: false },
      });

      const runMock = vi.fn().mockResolvedValue(failingResult);
      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: runMock,
        onStepEvent: vi.fn(),
      }));

      await service.execute('model-1', 'My Model', scenarios, { continueOnFailure: false });

      expect(runMock).toHaveBeenCalledTimes(1);
    });

    it('skipped scenarios carry the correct step counts from the scenario definition', async () => {
      const scenarios = [
        makeScenario({ id: 's1', steps: [{ type: 'navigate', url: 'https://example.com' }] }),
        makeScenario({
          id: 's2',
          steps: [
            { type: 'navigate', url: 'https://example.com' },
            { type: 'click', selector: 'button' },
            { type: 'click', selector: 'a' },
          ],
        }),
      ];

      const failingResult = makeExecutionResult({
        summary: { totalSteps: 1, passed: 0, failed: 1, skipped: 0, duration: 50, success: false },
      });

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(failingResult),
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', scenarios);

      const skipped = result.scenarioResults[1];
      expect(skipped.summary.totalSteps).toBe(3);
      expect(skipped.summary.skipped).toBe(3);
      expect(skipped.duration).toBe(0);
    });
  });

  describe('execute — multiple scenarios with continueOnFailure=true', () => {
    it('executes all scenarios regardless of failures', async () => {
      const scenarios = [
        makeScenario({ id: 's1' }),
        makeScenario({ id: 's2' }),
        makeScenario({ id: 's3' }),
      ];

      const failingResult = makeExecutionResult({
        summary: { totalSteps: 1, passed: 0, failed: 1, skipped: 0, duration: 50, success: false },
      });
      const passingResult = makeExecutionResult({
        summary: { totalSteps: 1, passed: 1, failed: 0, skipped: 0, duration: 80, success: true },
      });

      const runMock = vi
        .fn()
        .mockResolvedValueOnce(failingResult)
        .mockResolvedValueOnce(passingResult)
        .mockResolvedValueOnce(passingResult);

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: runMock,
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', scenarios, { continueOnFailure: true });

      expect(runMock).toHaveBeenCalledTimes(3);
      expect(result.scenarioResults[0].status).toBe('failed');
      expect(result.scenarioResults[1].status).toBe('passed');
      expect(result.scenarioResults[2].status).toBe('passed');
      expect(result.summary.skippedScenarios).toBe(0);
    });
  });

  describe('execute — overall status "partial"', () => {
    it('returns partial when some scenarios pass and some fail', async () => {
      const scenarios = [
        makeScenario({ id: 's1' }),
        makeScenario({ id: 's2' }),
      ];

      const failingResult = makeExecutionResult({
        summary: { totalSteps: 1, passed: 0, failed: 1, skipped: 0, duration: 50, success: false },
      });
      const passingResult = makeExecutionResult({
        summary: { totalSteps: 1, passed: 1, failed: 0, skipped: 0, duration: 80, success: true },
      });

      const runMock = vi
        .fn()
        .mockResolvedValueOnce(failingResult)
        .mockResolvedValueOnce(passingResult);

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: runMock,
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', scenarios, { continueOnFailure: true });

      expect(result.status).toBe('partial');
      expect(result.summary.passedScenarios).toBe(1);
      expect(result.summary.failedScenarios).toBe(1);
    });
  });

  describe('execute — runner.run() throws', () => {
    it('catches the thrown error and marks the scenario as failed', async () => {
      const scenario = makeScenario({ id: 's1' });

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockRejectedValue(new Error('Browser crashed')),
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', [scenario]);

      expect(result.status).toBe('failed');
      expect(result.scenarioResults[0].status).toBe('failed');
      expect(result.scenarioResults[0].stepResults).toEqual([]);
    });

    it('always calls runner.close() even when run throws', async () => {
      const scenario = makeScenario({ id: 's1' });
      const closeMock = vi.fn().mockResolvedValue(undefined);

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: closeMock,
        run: vi.fn().mockRejectedValue(new Error('Browser crashed')),
        onStepEvent: vi.fn(),
      }));

      await service.execute('model-1', 'My Model', [scenario]);

      expect(closeMock).toHaveBeenCalledOnce();
    });

    it('when run throws, sets failed=1 and skipped=remaining steps in summary', async () => {
      const scenario = makeScenario({
        id: 's1',
        steps: [
          { type: 'navigate', url: 'https://example.com' },
          { type: 'click', selector: 'button' },
          { type: 'click', selector: 'a' },
        ],
      });

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockRejectedValue(new Error('Timeout')),
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', [scenario]);

      const scenarioResult = result.scenarioResults[0];
      expect(scenarioResult.summary.totalSteps).toBe(3);
      expect(scenarioResult.summary.failed).toBe(1);
      expect(scenarioResult.summary.skipped).toBe(2);
    });
  });

  describe('execute — summary aggregation across scenarios', () => {
    it('sums totalSteps, passedSteps, failedSteps, and skippedSteps across all scenarios', async () => {
      const scenarios = [
        makeScenario({ id: 's1', steps: [{ type: 'navigate', url: 'https://example.com' }, { type: 'click', selector: 'a' }] }),
        makeScenario({ id: 's2', steps: [{ type: 'navigate', url: 'https://example.com' }, { type: 'click', selector: 'b' }, { type: 'click', selector: 'c' }] }),
        makeScenario({ id: 's3', steps: [{ type: 'navigate', url: 'https://example.com' }] }),
      ];

      const results: ScenarioExecutionResult[] = [
        makeExecutionResult({ summary: { totalSteps: 2, passed: 2, failed: 0, skipped: 0, duration: 100, success: true } }),
        makeExecutionResult({ summary: { totalSteps: 3, passed: 1, failed: 1, skipped: 1, duration: 200, success: false } }),
        makeExecutionResult({ summary: { totalSteps: 1, passed: 0, failed: 0, skipped: 1, duration: 50, success: false } }),
      ];

      const runMock = vi
        .fn()
        .mockResolvedValueOnce(results[0])
        .mockResolvedValueOnce(results[1])
        .mockResolvedValueOnce(results[2]);

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: runMock,
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', scenarios, { continueOnFailure: true });

      expect(result.summary.totalSteps).toBe(6);   // 2 + 3 + 1
      expect(result.summary.passedSteps).toBe(3);  // 2 + 1 + 0
      expect(result.summary.failedSteps).toBe(1);  // 0 + 1 + 0
      expect(result.summary.skippedSteps).toBe(2); // 0 + 1 + 1
    });

    it('records startedAt and endedAt timestamps', async () => {
      const before = Date.now();

      const scenario = makeScenario({ id: 's1' });
      const executionResult = makeExecutionResult();

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(executionResult),
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', [scenario]);

      const after = Date.now();

      expect(result.startedAt).toBeGreaterThanOrEqual(before);
      expect(result.endedAt).toBeGreaterThanOrEqual(result.startedAt);
      expect(result.endedAt).toBeLessThanOrEqual(after);
      expect(result.summary.duration).toBeGreaterThanOrEqual(0);
    });

    it('totalScenarios in summary always equals the number of input scenarios', async () => {
      const scenarios = [
        makeScenario({ id: 's1' }),
        makeScenario({ id: 's2' }),
        makeScenario({ id: 's3' }),
      ];

      const failingResult = makeExecutionResult({
        summary: { totalSteps: 1, passed: 0, failed: 1, skipped: 0, duration: 50, success: false },
      });

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(failingResult),
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', scenarios, { continueOnFailure: false });

      expect(result.summary.totalScenarios).toBe(3);
    });
  });

  describe('execute — scenario name fallback', () => {
    it('uses "Unnamed" when scenario.name is undefined', async () => {
      const scenario: Scenario = {
        id: 's1',
        meta: { url: 'https://example.com', viewport: { width: 1280, height: 720 }, recordedAt: new Date().toISOString(), astSchemaVersion: '1.0.0' },
        steps: [{ type: 'navigate', url: 'https://example.com' }],
      };

      const executionResult = makeExecutionResult();

      const { ScenarioRunner } = await import('@like-cake/runner');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(ScenarioRunner) as any).mockImplementationOnce(() => ({
        init: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        run: vi.fn().mockResolvedValue(executionResult),
        onStepEvent: vi.fn(),
      }));

      const result = await service.execute('model-1', 'My Model', [scenario]);

      expect(result.scenarioResults[0].scenarioName).toBe('Unnamed');
    });
  });
});
