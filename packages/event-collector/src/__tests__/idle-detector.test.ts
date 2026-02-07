import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IdleContext } from '../idle-detector';
import { IdleDetector } from '../idle-detector';

describe('IdleDetector', () => {
  let onIdle: ReturnType<typeof vi.fn<(ctx: IdleContext) => void>>;
  let detector: IdleDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    onIdle = vi.fn();
  });

  afterEach(() => {
    detector?.dispose();
    vi.useRealTimers();
  });

  it('should NOT fire onIdle if no recordEvent was ever called', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    detector.start();

    vi.advanceTimersByTime(5000);

    expect(onIdle).not.toHaveBeenCalled();
  });

  it('should fire onIdle after threshold elapses with no new events', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    detector.start();
    detector.recordEvent('click');

    vi.advanceTimersByTime(2000);

    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('should reset the timer when recordEvent is called before threshold', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    detector.start();
    detector.recordEvent('click');

    // Advance 1500ms (not yet at threshold)
    vi.advanceTimersByTime(1500);
    expect(onIdle).not.toHaveBeenCalled();

    // Record another event, which resets the timer
    detector.recordEvent('input');

    // Advance another 1500ms (total 3000ms from start, but only 1500ms from last event)
    vi.advanceTimersByTime(1500);
    expect(onIdle).not.toHaveBeenCalled();

    // Advance to full threshold from last event
    vi.advanceTimersByTime(500);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('should fire onIdle at most once per idle period', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    detector.start();
    detector.recordEvent('click');

    vi.advanceTimersByTime(2000);
    expect(onIdle).toHaveBeenCalledTimes(1);

    // Advance much more time without new events
    vi.advanceTimersByTime(10000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('should fire onIdle again for a second idle period after a new event', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    detector.start();

    // First idle period
    detector.recordEvent('click');
    vi.advanceTimersByTime(2000);
    expect(onIdle).toHaveBeenCalledTimes(1);

    // New event starts a second idle period
    detector.recordEvent('input');
    vi.advanceTimersByTime(2000);
    expect(onIdle).toHaveBeenCalledTimes(2);
  });

  it('should NOT fire onIdle after stop() is called', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    detector.start();
    detector.recordEvent('click');

    // Stop before threshold
    detector.stop();

    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('should pass the correct lastEventType in IdleContext', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    detector.start();

    detector.recordEvent('click');
    vi.advanceTimersByTime(500);
    detector.recordEvent('keydown');
    vi.advanceTimersByTime(2000);

    expect(onIdle).toHaveBeenCalledTimes(1);
    const context = onIdle.mock.calls[0][0];
    expect(context.lastEventType).toBe('keydown');
  });

  it('should report duration that reflects actual idle time', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    detector.start();

    detector.recordEvent('click');
    vi.advanceTimersByTime(2000);

    expect(onIdle).toHaveBeenCalledTimes(1);
    const context = onIdle.mock.calls[0][0];
    expect(context.duration).toBeGreaterThanOrEqual(2000);
  });

  it('should ignore idle periods shorter than minIdleDuration', () => {
    detector = new IdleDetector({
      onIdle,
      idleThreshold: 500,
      minIdleDuration: 800,
    });
    detector.start();

    detector.recordEvent('click');

    // After 500ms the threshold fires, but the duration (500ms) is less than
    // minIdleDuration (800ms), so onIdle should NOT be called
    vi.advanceTimersByTime(500);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('should use default config values when not provided', () => {
    detector = new IdleDetector({ onIdle });
    detector.start();
    detector.recordEvent('click');

    // Default idleThreshold is 2000
    vi.advanceTimersByTime(1999);
    expect(onIdle).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('should set startedAt to the timestamp of the last event', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    detector.start();

    const beforeRecord = Date.now();
    detector.recordEvent('click');
    const afterRecord = Date.now();

    vi.advanceTimersByTime(2000);

    const context = onIdle.mock.calls[0][0];
    expect(context.startedAt).toBeGreaterThanOrEqual(beforeRecord);
    expect(context.startedAt).toBeLessThanOrEqual(afterRecord);
  });

  it('should not fire onIdle if recordEvent is called while stopped', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    // Do not start the detector
    detector.recordEvent('click');

    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });

  it('should clean up state on dispose()', () => {
    detector = new IdleDetector({ onIdle, idleThreshold: 2000 });
    detector.start();
    detector.recordEvent('click');

    detector.dispose();
    vi.advanceTimersByTime(5000);

    expect(onIdle).not.toHaveBeenCalled();

    // Re-start after dispose should require a new recordEvent
    detector.start();
    vi.advanceTimersByTime(5000);
    expect(onIdle).not.toHaveBeenCalled();
  });
});
