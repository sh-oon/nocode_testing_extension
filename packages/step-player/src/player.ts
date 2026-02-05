import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { ExecutionSummary, Scenario, Step, StepResult } from '@like-cake/ast-types';
import type { DomSnapshot, ScreenshotResult } from '@like-cake/dom-serializer';
import { executeStep } from './executors';
import type {
  ExecutionContext,
  PlaybackAdapter,
  PlaybackResult,
  Player,
  PlayerConfig,
  PlayerEvent,
  PlayerEventListener,
  PlayerEventType,
  PlayerState,
  StepExecutionResult,
} from './types';
import { DEFAULT_PLAYER_CONFIG } from './types';

/**
 * Step Player - Executes scenarios step by step
 */
export class StepPlayer implements Player {
  private _state: PlayerState = 'idle';
  private _currentStepIndex = -1;
  private scenario: Scenario | null = null;
  private config: Required<PlayerConfig>;
  private adapter: PlaybackAdapter;
  private eventListeners: Map<PlayerEventType, Set<PlayerEventListener>> = new Map();

  // Execution state
  private stepResults: StepResult[] = [];
  private apiCalls: CapturedApiCall[] = [];
  private snapshots: Array<{
    label: string;
    snapshot: DomSnapshot;
    screenshot?: ScreenshotResult;
  }> = [];
  private startTime = 0;
  private abortController: AbortController | null = null;
  private pausePromise: { resolve: () => void; promise: Promise<void> } | null = null;

  constructor(adapter: PlaybackAdapter, config: Partial<PlayerConfig> = {}) {
    this.adapter = adapter;
    this.config = { ...DEFAULT_PLAYER_CONFIG, ...config };
  }

  get state(): PlayerState {
    return this._state;
  }

  get currentStepIndex(): number {
    return this._currentStepIndex;
  }

  /**
   * Check if player is in a specific state (accounts for async state changes)
   */
  private isState(state: PlayerState): boolean {
    return this._state === state;
  }

  /**
   * Load a scenario for playback
   */
  load(scenario: Scenario): void {
    if (this._state === 'playing') {
      throw new Error('Cannot load scenario while playing');
    }

    this.scenario = scenario;
    this._state = 'idle';
    this._currentStepIndex = -1;
    this.stepResults = [];
    this.apiCalls = [];
    this.snapshots = [];
    this.abortController = null;

    this.emit('stateChange', { state: this._state });
  }

  /**
   * Start or resume playback
   */
  async play(): Promise<PlaybackResult> {
    if (!this.scenario) {
      throw new Error('No scenario loaded');
    }

    if (this._state === 'playing') {
      throw new Error('Already playing');
    }

    // Resume from paused state
    if (this._state === 'paused' && this.pausePromise) {
      this._state = 'playing';
      this.emit('stateChange', { state: this._state });
      this.pausePromise.resolve();
      // The existing play loop will continue
      // Return a promise that resolves when playback completes
      return this.waitForCompletion();
    }

    // Start fresh playback
    this._state = 'playing';
    this._currentStepIndex = 0;
    this.startTime = Date.now();
    this.stepResults = [];
    this.abortController = new AbortController();

    this.emit('playbackStart', {});
    this.emit('stateChange', { state: this._state });

    try {
      // Initialize adapter
      await this.adapter.initialize();
      await this.adapter.startApiInterception();

      // Execute setup steps if any
      if (this.scenario.setup?.length) {
        for (const step of this.scenario.setup) {
          if (this.isState('stopped')) break;
          await this.executeStepWithRetry(step, -1);
        }
      }

      // Execute main steps
      const steps = this.scenario.steps;
      while (this._currentStepIndex < steps.length && !this.isState('stopped')) {
        // Handle pause
        if (this.isState('paused')) {
          await this.waitForResume();
          if (this.isState('stopped')) break;
        }

        const step = steps[this._currentStepIndex];
        const result = await this.executeStepWithRetry(step, this._currentStepIndex);

        // Store result
        this.stepResults.push({
          stepId: step.id ?? `step-${this._currentStepIndex}`,
          index: this._currentStepIndex,
          status: result.status,
          duration: result.duration,
          error: result.error,
          screenshotPath: result.screenshot ? 'memory' : undefined,
          snapshotPath: result.snapshot ? 'memory' : undefined,
          apiResponse: result.apiResponse,
        });

        // Handle failure
        if (result.status === 'failed' && !step.optional) {
          if (this.config.pauseOnFailure) {
            this.pause();
            await this.waitForResume();
          } else if (!this.config.continueOnFailure) {
            break;
          }
        }

        // Apply step delay
        if (this.config.stepDelay > 0 && this._currentStepIndex < steps.length - 1) {
          await this.adapter.wait(this.config.stepDelay / this.config.speed);
        }

        this._currentStepIndex++;
      }

      // Execute teardown steps if any
      if (this.scenario.teardown?.length && !this.isState('stopped')) {
        for (const step of this.scenario.teardown) {
          await this.executeStepWithRetry(step, -2);
        }
      }

      // Finalize
      this._state = this.isState('stopped') ? 'stopped' : 'completed';
      await this.adapter.stopApiInterception();
      this.apiCalls = [...this.apiCalls, ...this.adapter.getApiCalls()];
    } catch (error) {
      this._state = 'error';
      this.emit('playbackError', { error: error as Error });
    }

    const result = this.buildPlaybackResult();
    this.emit('playbackComplete', { summary: result.summary });
    this.emit('stateChange', { state: this._state });

    return result;
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this._state !== 'playing') {
      return;
    }

    this._state = 'paused';
    this.emit('stateChange', { state: this._state });
  }

  /**
   * Stop playback
   */
  stop(): void {
    if (this._state === 'idle' || this._state === 'completed' || this._state === 'stopped') {
      return;
    }

    this._state = 'stopped';
    this.abortController?.abort();

    // Resume if paused to allow cleanup
    if (this.pausePromise) {
      this.pausePromise.resolve();
    }

    this.emit('stateChange', { state: this._state });
  }

  /**
   * Execute single step and pause
   */
  async step(): Promise<StepExecutionResult | null> {
    if (!this.scenario) {
      throw new Error('No scenario loaded');
    }

    const steps = this.scenario.steps;

    // Initialize if starting fresh
    if (this._state === 'idle') {
      this._currentStepIndex = 0;
      this.startTime = Date.now();
      this.stepResults = [];
      this.abortController = new AbortController();

      await this.adapter.initialize();
      await this.adapter.startApiInterception();

      // Execute setup steps
      if (this.scenario.setup?.length) {
        for (const setupStep of this.scenario.setup) {
          await this.executeStepWithRetry(setupStep, -1);
        }
      }

      this._state = 'paused';
      this.emit('stateChange', { state: this._state });
    }

    // Check if we've completed all steps
    if (this._currentStepIndex >= steps.length) {
      this._state = 'completed';
      this.emit('stateChange', { state: this._state });
      return null;
    }

    // Execute current step
    const step = steps[this._currentStepIndex];
    this._state = 'playing';
    this.emit('stateChange', { state: this._state });

    const result = await this.executeStepWithRetry(step, this._currentStepIndex);

    // Store result
    this.stepResults.push({
      stepId: step.id ?? `step-${this._currentStepIndex}`,
      index: this._currentStepIndex,
      status: result.status,
      duration: result.duration,
      error: result.error,
    });

    this._currentStepIndex++;
    this._state = this._currentStepIndex >= steps.length ? 'completed' : 'paused';
    this.emit('stateChange', { state: this._state });

    return result;
  }

  /**
   * Jump to specific step
   */
  goToStep(index: number): void {
    if (!this.scenario) {
      throw new Error('No scenario loaded');
    }

    if (index < 0 || index >= this.scenario.steps.length) {
      throw new Error(`Invalid step index: ${index}`);
    }

    if (this._state === 'playing') {
      throw new Error('Cannot jump while playing');
    }

    this._currentStepIndex = index;
  }

  /**
   * Subscribe to events
   */
  on(event: PlayerEventType, listener: PlayerEventListener): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Unsubscribe from events
   */
  off(event: PlayerEventType, listener: PlayerEventListener): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PlayerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current playback result (partial)
   */
  getResult(): Partial<PlaybackResult> {
    return {
      scenarioId: this.scenario?.id,
      stepResults: [...this.stepResults],
      apiCalls: [...this.apiCalls],
      snapshots: [...this.snapshots],
      startTime: this.startTime,
    };
  }

  // ============================================
  // Private methods
  // ============================================

  private emit(type: PlayerEventType, data: Partial<PlayerEvent['data']>): void {
    const event: PlayerEvent = {
      type,
      timestamp: Date.now(),
      data,
    };

    this.eventListeners.get(type)?.forEach((listener) => {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    });
  }

  private async executeStepWithRetry(step: Step, index: number): Promise<StepExecutionResult> {
    let lastResult: StepExecutionResult | null = null;
    const maxAttempts = this.config.maxRetries + 1;

    this.emit('stepStart', { step, stepIndex: index });

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const context = this.createExecutionContext();
      lastResult = await executeStep(step, this.adapter, context);

      // Collect API calls from this step
      this.apiCalls.push(...this.adapter.getApiCalls());
      this.adapter.clearApiCalls();

      // Update snapshots
      this.snapshots.push(...context.snapshots);

      if (lastResult.status === 'passed') {
        break;
      }

      // Wait before retry
      if (attempt < maxAttempts - 1) {
        await this.adapter.wait(1000);
      }
    }

    const result = lastResult!;

    // Capture screenshot on failure if configured
    if (result.status === 'failed' && this.config.screenshotOnFailure && !result.screenshot) {
      try {
        result.screenshot = await this.adapter.captureScreenshot();
      } catch {
        // Ignore screenshot errors
      }
    }

    if (result.status === 'failed') {
      this.emit('stepError', {
        step,
        stepIndex: index,
        result,
        error: new Error(result.error?.message),
      });
    }

    this.emit('stepComplete', { step, stepIndex: index, result });

    return result;
  }

  private createExecutionContext(): ExecutionContext {
    return {
      scenario: this.scenario!,
      stepIndex: this._currentStepIndex,
      variables: { ...this.scenario!.variables },
      apiCalls: this.apiCalls,
      snapshots: [],
      abortSignal: this.abortController?.signal,
      defaultTimeout: this.config.defaultTimeout,
      speedMultiplier: this.config.speed,
    };
  }

  private waitForResume(): Promise<void> {
    if (this.pausePromise) {
      return this.pausePromise.promise;
    }

    let resolve: () => void;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });

    this.pausePromise = { resolve: resolve!, promise };
    return promise;
  }

  private async waitForCompletion(): Promise<PlaybackResult> {
    // Wait until state is no longer playing/paused
    while (this._state === 'playing' || this._state === 'paused') {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return this.buildPlaybackResult();
  }

  private buildPlaybackResult(): PlaybackResult {
    const endTime = Date.now();
    const passed = this.stepResults.filter((r) => r.status === 'passed').length;
    const failed = this.stepResults.filter((r) => r.status === 'failed').length;
    const skipped = this.stepResults.filter((r) => r.status === 'skipped').length;

    const summary: ExecutionSummary = {
      totalSteps: this.stepResults.length,
      passed,
      failed,
      skipped,
      duration: endTime - this.startTime,
      success: failed === 0 && this._state === 'completed',
    };

    return {
      scenarioId: this.scenario!.id,
      stepResults: this.stepResults,
      apiCalls: this.apiCalls,
      snapshots: this.snapshots,
      summary,
      startTime: this.startTime,
      endTime,
      success: summary.success,
    };
  }
}

/**
 * Create a new player instance
 */
export function createPlayer(adapter: PlaybackAdapter, config?: Partial<PlayerConfig>): Player {
  return new StepPlayer(adapter, config);
}
