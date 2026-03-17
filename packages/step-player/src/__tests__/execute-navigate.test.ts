import type { NavigateStep } from '@like-cake/ast-types';
import { describe, expect, it, vi } from 'vitest';
import { executeNavigate } from '../executors/navigation';
import type { ExecutionContext, PlaybackAdapter } from '../types';

function createMockAdapter(overrides?: Partial<PlaybackAdapter>): PlaybackAdapter {
  return {
    name: 'mock',
    initialize: vi.fn(),
    destroy: vi.fn(),
    navigate: vi.fn().mockResolvedValue(undefined),
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
    waitForDomStable: vi.fn(),
    wait: vi.fn(),
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
    scenario: { id: 'test', name: 'test', steps: [], meta: { url: '' } },
    stepIndex: 0,
    variables: {},
    apiCalls: [],
    snapshots: [],
    defaultTimeout: 30000,
    speedMultiplier: 1,
    ...overrides,
  } as ExecutionContext;
}

describe('executeNavigate', () => {
  it('should pass absolute URL directly to adapter', async () => {
    const adapter = createMockAdapter();
    const context = createMockContext();
    const step: NavigateStep = {
      type: 'navigate',
      url: 'https://example.com/page',
    };

    const result = await executeNavigate(step, adapter, context);

    expect(result.status).toBe('passed');
    expect(adapter.navigate).toHaveBeenCalledWith('https://example.com/page', {
      waitUntil: undefined,
      timeout: 30000,
    });
  });

  it('should resolve relative URL against scenario meta.url', async () => {
    const adapter = createMockAdapter();
    const context = createMockContext({
      scenario: {
        id: 'test',
        name: 'test',
        steps: [],
        meta: { url: 'https://myapp.com' },
      },
    });
    const step: NavigateStep = {
      type: 'navigate',
      url: '/knowledge/personal',
    };

    const result = await executeNavigate(step, adapter, context);

    expect(result.status).toBe('passed');
    expect(adapter.navigate).toHaveBeenCalledWith(
      'https://myapp.com/knowledge/personal',
      expect.objectContaining({ timeout: 30000 }),
    );
  });

  it('should keep relative URL as-is when meta.url is empty', async () => {
    const adapter = createMockAdapter();
    const context = createMockContext({
      scenario: {
        id: 'test',
        name: 'test',
        steps: [],
        meta: { url: '' },
      },
    });
    const step: NavigateStep = {
      type: 'navigate',
      url: '/some/path',
    };

    const result = await executeNavigate(step, adapter, context);

    expect(result.status).toBe('passed');
    // URL should be passed as-is since meta.url is empty
    expect(adapter.navigate).toHaveBeenCalledWith('/some/path', expect.any(Object));
  });

  it('should resolve relative URL with trailing path in meta.url', async () => {
    const adapter = createMockAdapter();
    const context = createMockContext({
      scenario: {
        id: 'test',
        name: 'test',
        steps: [],
        meta: { url: 'https://myapp.com/app' },
      },
    });
    const step: NavigateStep = {
      type: 'navigate',
      url: '/dashboard',
    };

    const result = await executeNavigate(step, adapter, context);

    expect(result.status).toBe('passed');
    expect(adapter.navigate).toHaveBeenCalledWith(
      'https://myapp.com/dashboard',
      expect.any(Object),
    );
  });

  it('should substitute variables in URL before resolving', async () => {
    const adapter = createMockAdapter();
    const context = createMockContext({
      scenario: {
        id: 'test',
        name: 'test',
        steps: [],
        meta: { url: 'https://myapp.com' },
      },
      variables: { userId: '42' },
    });
    const step: NavigateStep = {
      type: 'navigate',
      url: '/users/${userId}/profile',
    };

    const result = await executeNavigate(step, adapter, context);

    expect(result.status).toBe('passed');
    expect(adapter.navigate).toHaveBeenCalledWith(
      'https://myapp.com/users/42/profile',
      expect.any(Object),
    );
  });

  it('should return failed result when adapter throws', async () => {
    const adapter = createMockAdapter({
      navigate: vi.fn().mockRejectedValue(new Error('ERR_NAME_NOT_RESOLVED')),
    });
    const context = createMockContext();
    const step: NavigateStep = {
      type: 'navigate',
      url: 'https://example.com',
    };

    const result = await executeNavigate(step, adapter, context);

    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('ERR_NAME_NOT_RESOLVED');
  });

  it('should not resolve when meta is undefined', async () => {
    const adapter = createMockAdapter();
    const context = createMockContext({
      scenario: {
        id: 'test',
        name: 'test',
        steps: [],
      },
    });
    const step: NavigateStep = {
      type: 'navigate',
      url: '/relative-path',
    };

    const result = await executeNavigate(step, adapter, context);

    expect(result.status).toBe('passed');
    // Without meta.url, relative URL is passed as-is
    expect(adapter.navigate).toHaveBeenCalledWith('/relative-path', expect.any(Object));
  });
});
