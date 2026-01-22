import type { ExecutionSummary, Scenario, StepResult } from '@like-cake/ast-types';
import puppeteer, { type Browser, type CDPSession, type Page } from 'puppeteer';
import { executeStep } from './executors';
import { createApiObserver } from './observers';
import type {
  DomSnapshot,
  ExecutionContext,
  RunnerOptions,
  ScenarioExecutionResult,
} from './types';

/**
 * Default runner options
 */
const DEFAULT_OPTIONS: RunnerOptions = {
  headless: true,
  defaultTimeout: 30000,
  slowMo: 0,
  screenshotOnFailure: true,
  continueOnFailure: false,
};

/**
 * Scenario runner for executing E2E test scenarios
 */
export class ScenarioRunner {
  private options: RunnerOptions;
  private browser: Browser | null = null;

  constructor(options: Partial<RunnerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Initialize browser instance
   */
  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      slowMo: this.options.slowMo,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Run a scenario
   */
  async run(scenario: Scenario): Promise<ScenarioExecutionResult> {
    await this.init();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const startedAt = Date.now();
    const stepResults: StepResult[] = [];
    const snapshots: DomSnapshot[] = [];
    let page: Page | null = null;
    let cdpSession: CDPSession | null = null;

    try {
      // Create new page
      page = await this.browser.newPage();

      // Set viewport
      const viewport = this.options.viewport ?? scenario.meta.viewport;
      if (viewport) {
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
        });
      }

      // Set user agent if specified
      if (this.options.userAgent) {
        await page.setUserAgent(this.options.userAgent);
      }

      // Create CDP session for DOM snapshots
      cdpSession = await page.createCDPSession();
      await cdpSession.send('DOMSnapshot.enable');

      // Create API observer
      const apiObserver = createApiObserver(page);
      apiObserver.start();

      // Build execution context
      const context: ExecutionContext = {
        page,
        browser: this.browser,
        cdpSession,
        options: this.options,
        variables: scenario.variables ?? {},
        apiObserver,
        stepIndex: 0,
        scenarioId: scenario.id,
      };

      // Execute setup steps
      if (scenario.setup?.length) {
        for (let i = 0; i < scenario.setup.length; i++) {
          context.stepIndex = i;
          const result = await executeStep(scenario.setup[i], context);
          stepResults.push(result);

          if (result.status === 'failed' && !this.options.continueOnFailure) {
            break;
          }
        }
      }

      // Check if setup failed
      const setupFailed = stepResults.some((r) => r.status === 'failed');

      // Execute main steps (if setup passed)
      if (!setupFailed) {
        for (let i = 0; i < scenario.steps.length; i++) {
          context.stepIndex = (scenario.setup?.length ?? 0) + i;
          const result = await executeStep(scenario.steps[i], context);
          stepResults.push(result);

          if (result.status === 'failed' && !this.options.continueOnFailure) {
            break;
          }
        }
      }

      // Execute teardown steps (always run)
      if (scenario.teardown?.length) {
        for (let i = 0; i < scenario.teardown.length; i++) {
          context.stepIndex = (scenario.setup?.length ?? 0) + scenario.steps.length + i;
          const result = await executeStep(scenario.teardown[i], context);
          stepResults.push(result);
        }
      }

      // Stop API observer and get collected calls
      const apiCalls = apiObserver.stop();

      // Build execution summary
      const summary = this.buildSummary(stepResults);

      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        stepResults,
        summary,
        snapshots,
        apiCalls,
        startedAt,
        endedAt: Date.now(),
      };
    } finally {
      // Cleanup
      if (cdpSession) {
        await cdpSession.detach().catch(() => {});
      }
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * Run multiple scenarios
   */
  async runAll(scenarios: Scenario[]): Promise<ScenarioExecutionResult[]> {
    const results: ScenarioExecutionResult[] = [];

    for (const scenario of scenarios) {
      const result = await this.run(scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Build execution summary from step results
   */
  private buildSummary(stepResults: StepResult[]): ExecutionSummary {
    const passed = stepResults.filter((r) => r.status === 'passed').length;
    const failed = stepResults.filter((r) => r.status === 'failed').length;
    const skipped = stepResults.filter((r) => r.status === 'skipped').length;
    const totalDuration = stepResults.reduce((sum, r) => sum + r.duration, 0);

    return {
      totalSteps: stepResults.length,
      passed,
      failed,
      skipped,
      duration: totalDuration,
      success: failed === 0,
    };
  }
}

/**
 * Create and run a scenario with default options
 */
export async function runScenario(
  scenario: Scenario,
  options?: Partial<RunnerOptions>
): Promise<ScenarioExecutionResult> {
  const runner = new ScenarioRunner(options);

  try {
    return await runner.run(scenario);
  } finally {
    await runner.close();
  }
}
