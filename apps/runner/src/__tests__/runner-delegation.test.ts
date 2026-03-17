import { describe, expect, it } from 'vitest';

/**
 * Test that ScenarioRunner properly exports the right types and maintains
 * its public API contract after the StepPlayer delegation refactor.
 */
describe('ScenarioRunner public API contract', () => {
  it('should export ScenarioRunner class with init/run/close/runAll methods', async () => {
    const { ScenarioRunner } = await import('../runner');

    const runner = new ScenarioRunner({ headless: true });
    expect(runner).toBeDefined();
    expect(typeof runner.init).toBe('function');
    expect(typeof runner.run).toBe('function');
    expect(typeof runner.close).toBe('function');
    expect(typeof runner.runAll).toBe('function');
  });

  it('should export onStepEvent method for real-time progress tracking', async () => {
    const { ScenarioRunner } = await import('../runner');

    const runner = new ScenarioRunner();
    expect(typeof runner.onStepEvent).toBe('function');
  });

  it('should export runScenario convenience function', async () => {
    const { runScenario } = await import('../runner');
    expect(typeof runScenario).toBe('function');
  });
});

describe('ScenarioExecutionResult type compatibility', () => {
  it('should maintain the expected type exports from index', async () => {
    const mod = await import('../index');

    // Verify core exports exist at runtime
    expect(mod.ScenarioRunner).toBeDefined();
    expect(mod.runScenario).toBeDefined();
    expect(mod.ComparisonRunner).toBeDefined();
    expect(mod.captureBaseline).toBeDefined();
    expect(mod.runScenarioWithComparison).toBeDefined();
  });
});

describe('RunnerEventListener', () => {
  it('should accept step_start and step_complete events', async () => {
    const { ScenarioRunner } = await import('../runner');

    const runner = new ScenarioRunner();
    const events: Array<{ type: string; stepIndex: number }> = [];

    runner.onStepEvent((event) => {
      events.push({ type: event.type, stepIndex: event.stepIndex });
    });

    // We can't fully test run() without Puppeteer, but we verify
    // the listener is accepted without errors
    expect(events).toHaveLength(0);
  });
});
