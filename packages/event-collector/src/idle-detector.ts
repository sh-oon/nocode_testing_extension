/**
 * Configuration for the IdleDetector
 */
export interface IdleDetectorConfig {
  /** Minimum time (ms) with no events before considered idle. Default: 2000 */
  idleThreshold: number;
  /** Minimum idle duration (ms) to report; shorter idles are ignored. Default: 800 */
  minIdleDuration: number;
  /** Callback invoked when an idle period is detected */
  onIdle: (context: IdleContext) => void;
}

/**
 * Context passed to the onIdle callback
 */
export interface IdleContext {
  /** Timestamp (ms) when the idle period started (last event timestamp) */
  startedAt: number;
  /** Duration of the idle period (ms) */
  duration: number;
  /** Event type of the last event before the idle period */
  lastEventType: string;
}

const DEFAULT_IDLE_THRESHOLD = 2000;
const DEFAULT_MIN_IDLE_DURATION = 800;

/**
 * Detects idle periods during recording by monitoring gaps between events.
 *
 * Usage:
 * ```ts
 * const detector = new IdleDetector({
 *   idleThreshold: 3000,
 *   onIdle: (ctx) => console.log('User idle for', ctx.duration, 'ms'),
 * });
 * detector.start();
 * // Call detector.recordEvent(type) each time an event fires
 * detector.stop();
 * detector.dispose();
 * ```
 */
export class IdleDetector {
  private config: IdleDetectorConfig;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private hasReceivedEvent = false;
  private idleFired = false;
  private lastEventTimestamp = 0;
  private lastEventType = '';

  constructor(config: Partial<IdleDetectorConfig> & Pick<IdleDetectorConfig, 'onIdle'>) {
    this.config = {
      idleThreshold: config.idleThreshold ?? DEFAULT_IDLE_THRESHOLD,
      minIdleDuration: config.minIdleDuration ?? DEFAULT_MIN_IDLE_DURATION,
      onIdle: config.onIdle,
    };
  }

  /**
   * Start idle detection.
   * No idle will be reported until at least one event is recorded via `recordEvent()`.
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.hasReceivedEvent = false;
    this.idleFired = false;
    this.lastEventTimestamp = 0;
    this.lastEventType = '';
  }

  /**
   * Record that a user event has occurred. Resets the idle timer.
   * @param eventType - The type of the event (e.g. 'click', 'input')
   */
  recordEvent(eventType: string): void {
    if (!this.running) {
      return;
    }

    this.hasReceivedEvent = true;
    this.idleFired = false;
    this.lastEventTimestamp = Date.now();
    this.lastEventType = eventType;

    this.resetTimer();
  }

  /**
   * Stop idle detection. Clears any pending timer.
   * No further onIdle callbacks will fire until `start()` is called again.
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.clearTimer();
  }

  /**
   * Fully dispose the detector, clearing all internal state and timers.
   */
  dispose(): void {
    this.running = false;
    this.clearTimer();
    this.hasReceivedEvent = false;
    this.idleFired = false;
    this.lastEventTimestamp = 0;
    this.lastEventType = '';
  }

  private resetTimer(): void {
    this.clearTimer();

    this.timerId = setTimeout(() => {
      this.handleIdleTimeout();
    }, this.config.idleThreshold);
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private handleIdleTimeout(): void {
    this.timerId = null;

    if (!this.running || !this.hasReceivedEvent || this.idleFired) {
      return;
    }

    const now = Date.now();
    const duration = now - this.lastEventTimestamp;

    if (duration < this.config.minIdleDuration) {
      return;
    }

    this.idleFired = true;

    this.config.onIdle({
      startedAt: this.lastEventTimestamp,
      duration,
      lastEventType: this.lastEventType,
    });
  }
}

/**
 * Create a new IdleDetector instance
 */
export function createIdleDetector(
  config: Partial<IdleDetectorConfig> & Pick<IdleDetectorConfig, 'onIdle'>,
): IdleDetector {
  return new IdleDetector(config);
}
