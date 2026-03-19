import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { Scenario, StepResult } from '@like-cake/ast-types';
import {
  type CDPSessionLike,
  type PlaybackResult,
  type PlayerConfig,
  type PlayerEventListener,
  PuppeteerAdapter,
  type PuppeteerPageLike,
  StepPlayer,
} from '@like-cake/step-player';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import type {
  LabeledSnapshot,
  ObservedApiCall,
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
 * Listener for step-level progress events from the runner.
 * Enables real-time WebSocket broadcasts in the backend.
 */
export type RunnerEventListener = (event: {
  type: 'step_start' | 'step_complete';
  stepIndex: number;
  stepId?: string;
  stepType?: string;
  result?: StepResult;
}) => void;

/**
 * Scenario runner for executing E2E test scenarios.
 *
 * Delegates all step execution to @like-cake/step-player's StepPlayer + PuppeteerAdapter.
 * This ensures a single execution path for both Extension and Runner environments.
 */
export class ScenarioRunner {
  private options: RunnerOptions;
  private browser: Browser | null = null;
  private eventListener: RunnerEventListener | null = null;

  constructor(options: Partial<RunnerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Subscribe to step-level events for real-time progress tracking
   */
  onStepEvent(listener: RunnerEventListener): void {
    this.eventListener = listener;
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
   * Run a scenario using StepPlayer for execution
   */
  async run(scenario: Scenario): Promise<ScenarioExecutionResult> {
    const maxRetries = this.options.maxRetries ?? 0;
    const retryDelay = this.options.retryDelay ?? 1000;
    const globalTimeout = this.options.globalTimeout ?? 120000;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[Like Cake] Retry attempt ${attempt}/${maxRetries}`);
        await new Promise((r) => setTimeout(r, retryDelay));
      }

      try {
        const result = await Promise.race([
          this.runOnce(scenario),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Scenario timed out after ${globalTimeout}ms`)),
              globalTimeout
            )
          ),
        ]);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) continue;
      }
    }

    throw lastError ?? new Error('Execution failed');
  }

  private async runOnce(scenario: Scenario): Promise<ScenarioExecutionResult> {
    await this.init();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const startedAt = Date.now();
    let page: Page | null = null;

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

      // Navigate to initial URL if first step is not a navigate
      const firstStep = scenario.setup?.[0] ?? scenario.steps[0];
      if (!firstStep || firstStep.type !== 'navigate') {
        const initialUrl = this.options.baseUrl || scenario.meta.url;
        if (initialUrl) {
          await page.goto(initialUrl, {
            waitUntil: 'networkidle2',
            timeout: this.options.defaultTimeout ?? 30000,
          });
        }
      }

      // Create CDP session for reliable Network-level API observation
      const cdpSession = await page.createCDPSession();

      // Create PuppeteerAdapter with CDP session for explicit body capture
      const adapter = new PuppeteerAdapter({
        page: page as unknown as PuppeteerPageLike,
        cdpSession: cdpSession as unknown as CDPSessionLike,
        defaultTimeout: this.options.defaultTimeout ?? 30000,
      });

      // Create StepPlayer with config mapped from RunnerOptions
      const playerConfig: PlayerConfig = {
        defaultTimeout: this.options.defaultTimeout ?? 30000,
        screenshotOnFailure: this.options.screenshotOnFailure ?? true,
        continueOnFailure: this.options.continueOnFailure ?? false,
      };
      const player = new StepPlayer(adapter, playerConfig);

      // Bridge StepPlayer events to runner event listener for real-time progress
      if (this.eventListener) {
        const listener = this.eventListener;

        const onStepStart: PlayerEventListener = (event) => {
          listener({
            type: 'step_start',
            stepIndex: event.data.stepIndex ?? -1,
            stepId: event.data.step?.id,
            stepType: event.data.step?.type,
          });
        };

        const onStepComplete: PlayerEventListener = (event) => {
          const stepResult: StepResult | undefined = event.data.result
            ? {
                stepId: event.data.step?.id ?? `step-${event.data.stepIndex ?? 0}`,
                index: event.data.stepIndex ?? 0,
                status: event.data.result.status,
                duration: event.data.result.duration,
                error: event.data.result.error,
                apiResponse: event.data.result.apiResponse,
              }
            : undefined;

          listener({
            type: 'step_complete',
            stepIndex: event.data.stepIndex ?? -1,
            stepId: event.data.step?.id,
            stepType: event.data.step?.type,
            result: stepResult,
          });
        };

        player.on('stepStart', onStepStart);
        player.on('stepComplete', onStepComplete);
      }

      // Load scenario and execute via StepPlayer
      player.load(scenario);
      const playbackResult = await player.play();

      // Convert PlaybackResult → ScenarioExecutionResult
      return convertPlaybackResult(playbackResult, scenario, startedAt);
    } finally {
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
}

/**
 * Convert StepPlayer's PlaybackResult to Runner's ScenarioExecutionResult.
 *
 * Maps between the two result formats so that all downstream consumers
 * (reporters, backend execution service) continue to work unchanged.
 */
function convertPlaybackResult(
  playback: PlaybackResult,
  scenario: Scenario,
  startedAt: number
): ScenarioExecutionResult {
  // Convert CapturedApiCall[] → ObservedApiCall[]
  const apiCalls: ObservedApiCall[] = playback.apiCalls.map((call: CapturedApiCall) => ({
    request: {
      url: call.request.url,
      method: call.request.method,
      headers: call.request.headers as Record<string, string>,
      postData: typeof call.request.body === 'string' ? call.request.body : undefined,
      timestamp: call.request.timestamp,
    },
    response: call.response
      ? {
          url: call.request.url,
          status: call.response.status,
          headers: call.response.headers as Record<string, string>,
          body: call.response.body,
          responseTime: call.response.responseTime,
          timestamp: call.request.timestamp + call.response.responseTime,
        }
      : undefined,
  }));

  // Pass through snapshots directly — they already use the canonical DomSnapshot type
  const snapshots: LabeledSnapshot[] = playback.snapshots;

  return {
    scenarioId: playback.scenarioId,
    scenarioName: scenario.name,
    stepResults: playback.stepResults,
    summary: playback.summary,
    snapshots,
    apiCalls,
    startedAt,
    endedAt: playback.endTime,
  };
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
