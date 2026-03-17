import type { AssertApiStep } from '@like-cake/ast-types';
import { describe, expect, it, vi } from 'vitest';
import { executeAssertApi } from '../executors/assertions';
import type { ExecutionContext, PlaybackAdapter } from '../types';

function createMockAdapter(
  apiCalls = [] as ReturnType<PlaybackAdapter['getApiCalls']>
): PlaybackAdapter {
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
    waitForDomStable: vi.fn(),
    wait: vi.fn().mockResolvedValue(undefined),
    getCurrentUrl: vi.fn(),
    getTitle: vi.fn(),
    captureSnapshot: vi.fn(),
    captureScreenshot: vi.fn(),
    getApiCalls: vi.fn().mockReturnValue(apiCalls),
    clearApiCalls: vi.fn(),
    startApiInterception: vi.fn(),
    stopApiInterception: vi.fn(),
    assertElement: vi.fn(),
  } as PlaybackAdapter;
}

function createMockContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    scenario: { id: 'test', name: 'test', steps: [], meta: { url: '' } },
    stepIndex: 0,
    variables: {},
    apiCalls: [],
    snapshots: [],
    defaultTimeout: 5000,
    speedMultiplier: 1,
    ...overrides,
  } as ExecutionContext;
}

describe('assertApi with JSONPath (jsonpath-plus)', () => {
  const responseBody = {
    data: [
      { id: 1, name: 'Alice', active: true },
      { id: 2, name: 'Bob', active: false },
    ],
    meta: {
      total: 2,
      nested: { deep: { value: 42 } },
    },
  };

  const apiCall = {
    request: {
      id: 'req-1',
      url: 'https://api.example.com/users',
      method: 'GET',
      headers: {},
      timestamp: Date.now(),
      initiator: 'fetch' as const,
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: responseBody,
      responseTime: 50,
    },
    pending: false,
  };

  it('should validate $.data[0].id with jsonpath-plus syntax', async () => {
    const adapter = createMockAdapter([apiCall]);
    const context = createMockContext();
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/users', method: 'GET' },
      expect: { jsonPath: { '$.data[0].id': 1 } },
    };

    const result = await executeAssertApi(step, adapter, context);
    expect(result.status).toBe('passed');
  });

  it('should validate $.data[1].name', async () => {
    const adapter = createMockAdapter([apiCall]);
    const context = createMockContext();
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/users', method: 'GET' },
      expect: { jsonPath: { '$.data[1].name': 'Bob' } },
    };

    const result = await executeAssertApi(step, adapter, context);
    expect(result.status).toBe('passed');
  });

  it('should validate deeply nested path $.meta.nested.deep.value', async () => {
    const adapter = createMockAdapter([apiCall]);
    const context = createMockContext();
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/users', method: 'GET' },
      expect: { jsonPath: { '$.meta.nested.deep.value': 42 } },
    };

    const result = await executeAssertApi(step, adapter, context);
    expect(result.status).toBe('passed');
  });

  it('should validate $.meta.total count', async () => {
    const adapter = createMockAdapter([apiCall]);
    const context = createMockContext();
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/users', method: 'GET' },
      expect: { jsonPath: { '$.meta.total': 2 } },
    };

    const result = await executeAssertApi(step, adapter, context);
    expect(result.status).toBe('passed');
  });

  it('should fail when JSONPath value does not match', async () => {
    const adapter = createMockAdapter([apiCall]);
    const context = createMockContext();
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/users', method: 'GET' },
      expect: { jsonPath: { '$.data[0].name': 'Charlie' } },
    };

    const result = await executeAssertApi(step, adapter, context);
    expect(result.status).toBe('failed');
    expect(result.error?.message).toContain('JSONPath');
    expect(result.error?.message).toContain('Charlie');
  });

  it('should fail when JSONPath does not exist in response', async () => {
    const adapter = createMockAdapter([apiCall]);
    const context = createMockContext();
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/users', method: 'GET' },
      expect: { jsonPath: { '$.nonexistent.path': 'value' } },
    };

    const result = await executeAssertApi(step, adapter, context);
    expect(result.status).toBe('failed');
  });

  it('should validate multiple JSONPath assertions in one step', async () => {
    const adapter = createMockAdapter([apiCall]);
    const context = createMockContext();
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/users', method: 'GET' },
      expect: {
        status: 200,
        jsonPath: {
          '$.data[0].id': 1,
          '$.meta.total': 2,
        },
      },
    };

    const result = await executeAssertApi(step, adapter, context);
    expect(result.status).toBe('passed');
  });

  it('should handle simple dot-notation paths (backward compat)', async () => {
    const adapter = createMockAdapter([apiCall]);
    const context = createMockContext();
    // Simple path without $ prefix — jsonpath-plus supports this too
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/users', method: 'GET' },
      expect: { jsonPath: { '$.meta.total': 2 } },
    };

    const result = await executeAssertApi(step, adapter, context);
    expect(result.status).toBe('passed');
  });
});
