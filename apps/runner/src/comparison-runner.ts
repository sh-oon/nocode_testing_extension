import type { Scenario } from '@like-cake/ast-types';
import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { DomSnapshot, ScreenshotResult } from '@like-cake/dom-serializer';
import {
  compareApiCalls,
  compareDomSnapshots,
  compareScreenshots,
  type ApiDiffResult,
  type DomDiffResult,
  type VisualDiffResult,
} from '@like-cake/diff-engine';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import {
  StepPlayer,
  PuppeteerAdapter,
  type PlaybackResult,
  type PlayerConfig,
  type PuppeteerPageLike,
} from '@like-cake/step-player';
import type { RunnerOptions } from './types';

/**
 * Baseline data captured during recording
 */
export interface Baseline {
  /** Scenario ID this baseline belongs to */
  scenarioId: string;
  /** Timestamp when baseline was captured */
  capturedAt: number;
  /** API calls captured during recording */
  apiCalls: CapturedApiCall[];
  /** DOM snapshots captured */
  snapshots: Array<{
    label: string;
    snapshot: DomSnapshot;
    screenshot?: ScreenshotResult;
  }>;
  /** Final screenshot */
  finalScreenshot?: string;
}

/**
 * Comparison result combining all diff types
 */
export interface ComparisonResult {
  /** Whether overall comparison passed */
  passed: boolean;
  /** Scenario ID */
  scenarioId: string;
  /** API comparison results */
  apiComparison?: ApiDiffResult;
  /** DOM comparison results (per snapshot) */
  domComparisons: Array<{
    label: string;
    result: DomDiffResult;
  }>;
  /** Visual comparison results (per screenshot) */
  visualComparisons: Array<{
    label: string;
    result: VisualDiffResult;
  }>;
  /** Playback execution result */
  playbackResult: PlaybackResult;
  /** Time taken for comparison */
  comparisonDuration: number;
}

/**
 * Options for comparison runner
 */
export interface ComparisonRunnerOptions extends Partial<RunnerOptions> {
  /** Threshold for visual diff (0-1, default 0.01 = 1%) */
  visualThreshold?: number;
  /** Whether to compare API calls */
  compareApi?: boolean;
  /** Whether to compare DOM snapshots */
  compareDom?: boolean;
  /** Whether to compare screenshots */
  compareVisual?: boolean;
  /** API paths to ignore in comparison */
  apiIgnorePaths?: string[];
  /** DOM attributes to ignore in comparison */
  domIgnoreAttributes?: string[];
}

const DEFAULT_COMPARISON_OPTIONS: ComparisonRunnerOptions = {
  headless: true,
  defaultTimeout: 30000,
  slowMo: 0,
  screenshotOnFailure: true,
  continueOnFailure: false,
  visualThreshold: 0.01,
  compareApi: true,
  compareDom: true,
  compareVisual: true,
  apiIgnorePaths: ['timestamp', 'request.timestamp'],
  domIgnoreAttributes: ['data-v-', 'data-reactid'],
};

/**
 * Comparison Runner - executes scenarios and compares against baselines
 *
 * Uses step-player for execution and diff-engine for comparison
 */
export class ComparisonRunner {
  private options: ComparisonRunnerOptions;
  private browser: Browser | null = null;

  constructor(options: ComparisonRunnerOptions = {}) {
    this.options = { ...DEFAULT_COMPARISON_OPTIONS, ...options };
  }

  /**
   * Initialize browser instance
   */
  async init(): Promise<void> {
    if (this.browser) return;

    this.browser = await puppeteer.launch({
      headless: this.options.headless ?? true,
      slowMo: this.options.slowMo ?? 0,
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
   * Run scenario and compare against baseline
   */
  async runWithComparison(
    scenario: Scenario,
    baseline: Baseline
  ): Promise<ComparisonResult> {
    await this.init();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const comparisonStartTime = Date.now();
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

      // Create Puppeteer adapter from step-player
      const adapter = new PuppeteerAdapter({
        page: page as unknown as PuppeteerPageLike,
        defaultTimeout: this.options.defaultTimeout ?? 30000,
      });

      // Create player configuration
      const playerConfig: PlayerConfig = {
        defaultTimeout: this.options.defaultTimeout ?? 30000,
        screenshotOnFailure: this.options.screenshotOnFailure ?? true,
        continueOnFailure: this.options.continueOnFailure ?? false,
      };

      // Create scenario player
      const player = new StepPlayer(adapter, playerConfig);

      // Start API interception
      await adapter.startApiInterception();

      // Load and execute scenario
      player.load(scenario);
      const playbackResult = await player.play();

      // Stop API interception
      await adapter.stopApiInterception();

      // Perform comparisons
      const domComparisons: ComparisonResult['domComparisons'] = [];
      const visualComparisons: ComparisonResult['visualComparisons'] = [];
      let apiComparison: ApiDiffResult | undefined;

      // Compare API calls
      if (this.options.compareApi && baseline.apiCalls.length > 0) {
        apiComparison = compareApiCalls(baseline.apiCalls, playbackResult.apiCalls, {
          ignorePaths: this.options.apiIgnorePaths,
        });
      }

      // Compare DOM snapshots
      if (this.options.compareDom) {
        for (const baselineSnapshot of baseline.snapshots) {
          const actualSnapshot = playbackResult.snapshots.find(
            (s: { label: string }) => s.label === baselineSnapshot.label
          );

          if (actualSnapshot && baselineSnapshot.snapshot && actualSnapshot.snapshot) {
            const domResult = compareDomSnapshots(
              baselineSnapshot.snapshot,
              actualSnapshot.snapshot,
              {
                ignoreAttributes: this.options.domIgnoreAttributes,
              }
            );

            domComparisons.push({
              label: baselineSnapshot.label,
              result: domResult,
            });

            // Compare screenshots if available
            if (
              this.options.compareVisual &&
              baselineSnapshot.screenshot &&
              actualSnapshot.screenshot
            ) {
              const visualResult = compareScreenshots(
                baselineSnapshot.screenshot.data,
                actualSnapshot.screenshot.data,
                {
                  diffThreshold: (this.options.visualThreshold ?? 0.01) * 100,
                }
              );

              visualComparisons.push({
                label: baselineSnapshot.label,
                result: visualResult,
              });
            }
          }
        }
      }

      // Determine overall pass/fail
      const apiPassed = !apiComparison || apiComparison.passed;
      const domPassed = domComparisons.every((c) => c.result.passed);
      const visualPassed = visualComparisons.every((c) => c.result.passed);
      const executionPassed = playbackResult.success;

      const passed = executionPassed && apiPassed && domPassed && visualPassed;

      return {
        passed,
        scenarioId: scenario.id,
        apiComparison,
        domComparisons,
        visualComparisons,
        playbackResult,
        comparisonDuration: Date.now() - comparisonStartTime,
      };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * Run scenario without baseline (capture mode)
   * Returns playback result that can be used as baseline
   */
  async runAndCapture(scenario: Scenario): Promise<{
    playbackResult: PlaybackResult;
    baseline: Baseline;
  }> {
    await this.init();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    let page: Page | null = null;

    try {
      page = await this.browser.newPage();

      const viewport = this.options.viewport ?? scenario.meta.viewport;
      if (viewport) {
        await page.setViewport({
          width: viewport.width,
          height: viewport.height,
        });
      }

      const adapter = new PuppeteerAdapter({
        page: page as unknown as PuppeteerPageLike,
        defaultTimeout: this.options.defaultTimeout ?? 30000,
      });

      const player = new StepPlayer(adapter, {
        defaultTimeout: this.options.defaultTimeout ?? 30000,
        screenshotOnFailure: true,
        continueOnFailure: this.options.continueOnFailure ?? false,
      });

      await adapter.startApiInterception();

      player.load(scenario);
      const playbackResult = await player.play();

      await adapter.stopApiInterception();

      // Capture final screenshot
      const finalScreenshot = await page.screenshot({
        fullPage: true,
        encoding: 'base64',
      });

      // Build baseline from playback result
      const baseline: Baseline = {
        scenarioId: scenario.id,
        capturedAt: Date.now(),
        apiCalls: playbackResult.apiCalls,
        snapshots: playbackResult.snapshots,
        finalScreenshot: finalScreenshot as string,
      };

      return { playbackResult, baseline };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * Run multiple scenarios with comparison
   */
  async runAllWithComparison(
    scenarios: Array<{ scenario: Scenario; baseline: Baseline }>
  ): Promise<ComparisonResult[]> {
    const results: ComparisonResult[] = [];

    for (const { scenario, baseline } of scenarios) {
      const result = await this.runWithComparison(scenario, baseline);
      results.push(result);
    }

    return results;
  }
}

/**
 * Create and run a scenario with comparison
 */
export async function runScenarioWithComparison(
  scenario: Scenario,
  baseline: Baseline,
  options?: ComparisonRunnerOptions
): Promise<ComparisonResult> {
  const runner = new ComparisonRunner(options);

  try {
    return await runner.runWithComparison(scenario, baseline);
  } finally {
    await runner.close();
  }
}

/**
 * Create and run a scenario in capture mode
 */
export async function captureBaseline(
  scenario: Scenario,
  options?: ComparisonRunnerOptions
): Promise<{ playbackResult: PlaybackResult; baseline: Baseline }> {
  const runner = new ComparisonRunner(options);

  try {
    return await runner.runAndCapture(scenario);
  } finally {
    await runner.close();
  }
}
