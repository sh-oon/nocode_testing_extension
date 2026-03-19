import type {
  AssertElementStep,
  ClickStep,
  NavigateStep,
  Scenario,
  ScenarioMeta,
  Step,
  TypeStep,
} from '@like-cake/ast-types';
import type { ScenarioExecutionResult } from '@like-cake/runner';
import { ScenarioRunner } from '@like-cake/runner';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { createFixtureServer } from './setup';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

let serverBaseUrl = '';
let closeServer: () => Promise<void>;

const FIXTURE_DIR = path.resolve(__dirname, 'fixtures');

const buildMeta = (url: string): ScenarioMeta => ({
  recordedAt: new Date().toISOString(),
  url,
  viewport: { width: 1280, height: 720 },
  astSchemaVersion: '1.0.0',
});

const buildScenario = (name: string, steps: Step[], overrides?: Partial<Scenario>): Scenario => ({
  id: `test-${Date.now()}`,
  name,
  meta: buildMeta(serverBaseUrl),
  steps,
  ...overrides,
});

/* -------------------------------------------------------------------------- */
/*  Lifecycle                                                                 */
/* -------------------------------------------------------------------------- */

let runner: ScenarioRunner;

beforeAll(async () => {
  const fixture = await createFixtureServer(FIXTURE_DIR);
  serverBaseUrl = fixture.baseUrl;
  closeServer = fixture.close;
});

afterEach(async () => {
  if (runner) {
    await runner.close();
  }
});

afterAll(async () => {
  await closeServer();
});

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('ScenarioRunner E2E — full pipeline', () => {
  it('should navigate to the test page without errors', async () => {
    runner = new ScenarioRunner({ headless: true });

    const navigateStep: NavigateStep = {
      type: 'navigate',
      url: `${serverBaseUrl}/test-page.html`,
    };

    const scenario = buildScenario('navigate test', [navigateStep]);
    const result: ScenarioExecutionResult = await runner.run(scenario);

    expect(result.summary.success).toBe(true);
    expect(result.stepResults).toHaveLength(1);
    expect(result.stepResults[0].status).toBe('passed');
  });

  it('should click the submit button', async () => {
    runner = new ScenarioRunner({ headless: true });

    const steps: Step[] = [
      { type: 'navigate', url: `${serverBaseUrl}/test-page.html` } satisfies NavigateStep,
      {
        type: 'click',
        selector: { strategy: 'testId', value: 'submit-button' },
      } satisfies ClickStep,
    ];

    const scenario = buildScenario('click test', steps);
    const result = await runner.run(scenario);

    expect(result.summary.success).toBe(true);
    expect(result.stepResults).toHaveLength(2);
    expect(result.stepResults[1].status).toBe('passed');
  });

  it('should type into the email input', async () => {
    runner = new ScenarioRunner({ headless: true });

    const steps: Step[] = [
      { type: 'navigate', url: `${serverBaseUrl}/test-page.html` } satisfies NavigateStep,
      {
        type: 'type',
        selector: { strategy: 'testId', value: 'email-input' },
        value: 'user@example.com',
        clear: true,
      } satisfies TypeStep,
    ];

    const scenario = buildScenario('type test', steps);
    const result = await runner.run(scenario);

    expect(result.summary.success).toBe(true);
    expect(result.stepResults).toHaveLength(2);
    expect(result.stepResults[1].status).toBe('passed');
  });

  it('should complete a full login form flow', async () => {
    runner = new ScenarioRunner({ headless: true });

    const steps: Step[] = [
      { type: 'navigate', url: `${serverBaseUrl}/test-page.html` } satisfies NavigateStep,
      {
        type: 'type',
        selector: { strategy: 'testId', value: 'email-input' },
        value: 'user@example.com',
        clear: true,
      } satisfies TypeStep,
      {
        type: 'type',
        selector: { strategy: 'testId', value: 'password-input' },
        value: 'secret123',
        clear: true,
      } satisfies TypeStep,
      {
        type: 'click',
        selector: { strategy: 'testId', value: 'submit-button' },
      } satisfies ClickStep,
      {
        type: 'assertElement',
        selector: { strategy: 'testId', value: 'success-message' },
        assertion: { type: 'visible' },
      } satisfies AssertElementStep,
    ];

    const scenario = buildScenario('full form flow', steps);
    const result = await runner.run(scenario);

    expect(result.summary.success).toBe(true);
    expect(result.summary.totalSteps).toBe(5);
    expect(result.summary.passed).toBe(5);
    expect(result.summary.failed).toBe(0);

    for (const stepResult of result.stepResults) {
      expect(stepResult.status).toBe('passed');
    }
  });

  it('should assert element visibility after form submit', async () => {
    runner = new ScenarioRunner({ headless: true });

    const steps: Step[] = [
      { type: 'navigate', url: `${serverBaseUrl}/test-page.html` } satisfies NavigateStep,
      // Success message should initially be hidden
      {
        type: 'assertElement',
        selector: { strategy: 'testId', value: 'success-message' },
        assertion: { type: 'hidden' },
      } satisfies AssertElementStep,
      // Submit the form
      {
        type: 'click',
        selector: { strategy: 'testId', value: 'submit-button' },
      } satisfies ClickStep,
      // Now success message should be visible
      {
        type: 'assertElement',
        selector: { strategy: 'testId', value: 'success-message' },
        assertion: { type: 'visible' },
      } satisfies AssertElementStep,
    ];

    const scenario = buildScenario('assertion test', steps);
    const result = await runner.run(scenario);

    expect(result.summary.success).toBe(true);
    expect(result.summary.totalSteps).toBe(4);
    expect(result.summary.passed).toBe(4);
  });

  it('should navigate between sections via link click', async () => {
    runner = new ScenarioRunner({ headless: true });

    const steps: Step[] = [
      { type: 'navigate', url: `${serverBaseUrl}/test-page.html` } satisfies NavigateStep,
      // Login section should be visible
      {
        type: 'assertElement',
        selector: { strategy: 'testId', value: 'login-section' },
        assertion: { type: 'visible' },
      } satisfies AssertElementStep,
      // Click dashboard link
      {
        type: 'click',
        selector: { strategy: 'testId', value: 'nav-dashboard' },
      } satisfies ClickStep,
      // Dashboard section should now be visible
      {
        type: 'assertElement',
        selector: { strategy: 'testId', value: 'dashboard-section' },
        assertion: { type: 'visible' },
      } satisfies AssertElementStep,
      // Dashboard title should be visible
      {
        type: 'assertElement',
        selector: { strategy: 'testId', value: 'dashboard-title' },
        assertion: { type: 'text', value: 'Dashboard' },
      } satisfies AssertElementStep,
    ];

    const scenario = buildScenario('section navigation test', steps);
    const result = await runner.run(scenario);

    expect(result.summary.success).toBe(true);
    expect(result.summary.totalSteps).toBe(5);
    expect(result.summary.passed).toBe(5);
  });

  it('should report failure for invalid element assertion', async () => {
    runner = new ScenarioRunner({ headless: true, continueOnFailure: true });

    const steps: Step[] = [
      { type: 'navigate', url: `${serverBaseUrl}/test-page.html` } satisfies NavigateStep,
      // Success message is hidden by default — asserting visible should fail
      {
        type: 'assertElement',
        selector: { strategy: 'testId', value: 'success-message' },
        assertion: { type: 'visible' },
      } satisfies AssertElementStep,
    ];

    const scenario = buildScenario('expected failure test', steps);
    const result = await runner.run(scenario);

    expect(result.summary.success).toBe(false);
    expect(result.summary.failed).toBeGreaterThanOrEqual(1);
    expect(result.stepResults[1].status).toBe('failed');
  });
});
