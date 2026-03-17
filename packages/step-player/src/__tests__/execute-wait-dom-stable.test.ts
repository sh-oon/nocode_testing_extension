import type { WaitStep } from '@like-cake/ast-types';
import { describe, expect, it, vi } from 'vitest';
import { executeWait } from '../executors/navigation';
import type { ExecutionContext, PlaybackAdapter } from '../types';

function createMockAdapter(overrides?: Partial<PlaybackAdapter>): PlaybackAdapter {
  return {
    name: 'mock',
    initialize: vi.fn(),
    destroy: vi.fn(),
    navigate: vi.fn(),
    findElement: vi.fn(),
    click: vi.fn(),
    type: vi.fn(),
    keypress: vi.fn(),
    hover: vi.fn(),
    scroll: vi.fn(),
    select: vi.fn(),
    waitForSelector: vi.fn(),
    waitForNavigation: vi.fn(),
    waitForNetworkIdle: vi.fn(),
    waitForDomStable: vi.fn().mockResolvedValue(undefined),
    wait: vi.fn().mockResolvedValue(undefined),
    getCurrentUrl: vi.fn(),
    getTitle: vi.fn(),
    captureSnapshot: vi.fn(),
    captureScreenshot: vi.fn(),
    getApiCalls: vi.fn().mockReturnValue([]),
    clearApiCalls: vi.fn(),
    startApiInterception: vi.fn(),
    stopApiInterception: vi.fn(),
    assertElement: vi.fn(),
    ...overrides,
  } as PlaybackAdapter;
}

function createMockContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    scenario: { id: 'test', name: 'test', steps: [] },
    stepIndex: 0,
    variables: {},
    apiCalls: [],
    snapshots: [],
    defaultTimeout: 30000,
    speedMultiplier: 1,
    ...overrides,
  } as ExecutionContext;
}

describe('executeWait - domStable strategy (step-player)', () => {
  it('should call adapter.waitForDomStable with correct options', async () => {
    const adapter = createMockAdapter();
    const context = createMockContext();
    const step: WaitStep = {
      type: 'wait',
      strategy: 'domStable',
      stabilityThreshold: 1500,
    };

    const result = await executeWait(step, adapter, context);

    expect(result.status).toBe('passed');
    expect(adapter.waitForDomStable).toHaveBeenCalledWith({
      timeout: 30000,
      stabilityThreshold: 1500,
    });
  });

  it('should use default stabilityThreshold of 1500 when not specified', async () => {
    const adapter = createMockAdapter();
    const context = createMockContext();
    const step: WaitStep = {
      type: 'wait',
      strategy: 'domStable',
    };

    await executeWait(step, adapter, context);

    expect(adapter.waitForDomStable).toHaveBeenCalledWith({
      timeout: 30000,
      stabilityThreshold: 1500,
    });
  });

  it('should use step timeout when specified', async () => {
    const adapter = createMockAdapter();
    const context = createMockContext();
    const step: WaitStep = {
      type: 'wait',
      strategy: 'domStable',
      timeout: 10000,
      stabilityThreshold: 2000,
    };

    await executeWait(step, adapter, context);

    expect(adapter.waitForDomStable).toHaveBeenCalledWith({
      timeout: 10000,
      stabilityThreshold: 2000,
    });
  });

  it('should return failed result when adapter throws', async () => {
    const adapter = createMockAdapter({
      waitForDomStable: vi.fn().mockRejectedValue(new Error('DOM stability timeout after 30000ms')),
    });
    const context = createMockContext();
    const step: WaitStep = {
      type: 'wait',
      strategy: 'domStable',
    };

    const result = await executeWait(step, adapter, context);

    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('DOM stability timeout after 30000ms');
  });

  it('should include duration in result', async () => {
    const adapter = createMockAdapter({
      waitForDomStable: vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10))
      ),
    });
    const context = createMockContext();
    const step: WaitStep = {
      type: 'wait',
      strategy: 'domStable',
    };

    const result = await executeWait(step, adapter, context);

    expect(result.status).toBe('passed');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});
