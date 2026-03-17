import { describe, expect, it, vi } from 'vitest';
import {
  type CDPSessionLike,
  PuppeteerAdapter,
  type PuppeteerPageLike,
} from '../adapters/puppeteer-adapter';

/**
 * Creates a mock Puppeteer page with controllable request/response events
 */
function createMockPage() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  const page: PuppeteerPageLike = {
    goto: vi.fn().mockResolvedValue(undefined),
    $: vi.fn(),
    $$: vi.fn(),
    $x: vi.fn(),
    click: vi.fn(),
    type: vi.fn(),
    keyboard: {
      press: vi.fn(),
      down: vi.fn(),
      up: vi.fn(),
    },
    hover: vi.fn(),
    select: vi.fn(),
    waitForSelector: vi.fn(),
    waitForNavigation: vi.fn(),
    waitForNetworkIdle: vi.fn(),
    url: vi.fn().mockReturnValue('about:blank'),
    title: vi.fn().mockResolvedValue(''),
    screenshot: vi.fn(),
    evaluate: vi.fn(),
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const list = listeners.get(event) ?? [];
      listeners.set(
        event,
        list.filter((h) => h !== handler)
      );
    }),
  };

  const emit = (event: string, ...args: unknown[]) => {
    const list = listeners.get(event) ?? [];
    for (const handler of list) {
      handler(...args);
    }
  };

  return { page, emit };
}

/**
 * Creates a mock Puppeteer request object
 */
function createMockRequest(url: string, method = 'GET', postData?: string) {
  const req = {
    url: () => url,
    method: () => method,
    headers: () => ({ 'content-type': 'application/json' }),
    postData: () => postData,
    continue: vi.fn(),
  };
  return req;
}

/**
 * Creates a mock Puppeteer response that references its request
 */
function createMockResponse(
  request: ReturnType<typeof createMockRequest>,
  options: { status?: number; json?: unknown; text?: string; contentType?: string } = {}
) {
  const { status = 200, json, text, contentType = 'application/json' } = options;
  const res = {
    url: () => request.url(),
    request: () => request,
    status: () => status,
    statusText: () => (status === 200 ? 'OK' : 'Error'),
    headers: () => ({ 'content-type': contentType }),
    json:
      json !== undefined
        ? vi.fn().mockResolvedValue(json)
        : vi.fn().mockRejectedValue(new Error('Not JSON')),
    text: vi.fn().mockResolvedValue(text ?? JSON.stringify(json ?? '')),
  };
  return res;
}

describe('PuppeteerAdapter API interception', () => {
  it('should capture JSON response body', async () => {
    const { page, emit } = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.startApiInterception();

    // Simulate request
    const req = createMockRequest('https://api.example.com/users', 'GET');
    emit('request', req);

    // Simulate response with JSON body
    const responseBody = { users: [{ id: 1, name: 'Alice' }] };
    const res = createMockResponse(req, { json: responseBody });
    emit('response', res);

    // Wait for async body capture
    await new Promise((r) => setTimeout(r, 10));

    const calls = adapter.getApiCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].response).toBeDefined();
    expect(calls[0].response!.body).toEqual(responseBody);
    expect(calls[0].pending).toBe(false);
  });

  it('should capture text response body when content-type is not JSON', async () => {
    const { page, emit } = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.startApiInterception();

    const req = createMockRequest('https://api.example.com/health', 'GET');
    emit('request', req);

    const res = createMockResponse(req, {
      text: 'OK',
      contentType: 'text/plain',
    });
    emit('response', res);

    await new Promise((r) => setTimeout(r, 10));

    const calls = adapter.getApiCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].response!.body).toBe('OK');
  });

  it('should handle concurrent requests to the same URL without key collision', async () => {
    const { page, emit } = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.startApiInterception();

    // Two concurrent POST requests to the same endpoint
    const req1 = createMockRequest('https://api.example.com/items', 'POST', '{"name":"A"}');
    const req2 = createMockRequest('https://api.example.com/items', 'POST', '{"name":"B"}');

    emit('request', req1);
    emit('request', req2);

    // Responses arrive in reverse order
    const res2 = createMockResponse(req2, { json: { id: 2 } });
    const res1 = createMockResponse(req1, { json: { id: 1 } });

    emit('response', res2);
    emit('response', res1);

    await new Promise((r) => setTimeout(r, 10));

    const calls = adapter.getApiCalls();
    expect(calls).toHaveLength(2);

    // Both should have their correct response matched
    const bodies = calls.map((c) => c.response?.body);
    expect(bodies).toContainEqual({ id: 1 });
    expect(bodies).toContainEqual({ id: 2 });
  });

  it('should fallback to text() when json() fails', async () => {
    const { page, emit } = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.startApiInterception();

    const req = createMockRequest('https://api.example.com/broken', 'GET');
    emit('request', req);

    // Response claims JSON content-type but json() fails
    const res = createMockResponse(req, {
      contentType: 'application/json',
      text: '{"partial":true',
    });
    // Override json to reject (malformed JSON)
    res.json = vi.fn().mockRejectedValue(new Error('Unexpected end of JSON'));

    emit('response', res);

    await new Promise((r) => setTimeout(r, 10));

    const calls = adapter.getApiCalls();
    expect(calls[0].response!.body).toBe('{"partial":true');
  });

  it('should set pending=true initially and false after response', async () => {
    const { page, emit } = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.startApiInterception();

    const req = createMockRequest('https://api.example.com/data', 'GET');
    emit('request', req);

    const callsBefore = adapter.getApiCalls();
    expect(callsBefore[0].pending).toBe(true);

    const res = createMockResponse(req, { json: {} });
    emit('response', res);

    await new Promise((r) => setTimeout(r, 10));

    const callsAfter = adapter.getApiCalls();
    expect(callsAfter[0].pending).toBe(false);
  });

  it('should capture request metadata correctly', async () => {
    const { page, emit } = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.startApiInterception();

    const req = createMockRequest('https://api.example.com/submit', 'POST', '{"data":1}');
    emit('request', req);

    const calls = adapter.getApiCalls();
    expect(calls[0].request.url).toBe('https://api.example.com/submit');
    expect(calls[0].request.method).toBe('POST');
    expect(calls[0].request.body).toBe('{"data":1}');
    expect(calls[0].request.id).toBeDefined();
    expect(calls[0].request.timestamp).toBeGreaterThan(0);
  });

  it('should clear api calls on clearApiCalls()', async () => {
    const { page, emit } = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.startApiInterception();

    const req = createMockRequest('https://api.example.com/data', 'GET');
    emit('request', req);

    expect(adapter.getApiCalls()).toHaveLength(1);

    adapter.clearApiCalls();
    expect(adapter.getApiCalls()).toHaveLength(0);
  });
});

// ─── CDP Network observation tests ──────────────────────────────

/**
 * Creates a mock CDP session with controllable event emission
 */
function createMockCDPSession() {
  const listeners = new Map<string, Array<(params: unknown) => void>>();

  const session: CDPSessionLike = {
    send: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: (params: unknown) => void) => {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
    }),
    off: vi.fn((event: string, handler: (params: unknown) => void) => {
      const list = listeners.get(event) ?? [];
      listeners.set(
        event,
        list.filter((h) => h !== handler)
      );
    }),
  };

  const emit = (event: string, params: unknown) => {
    const list = listeners.get(event) ?? [];
    for (const handler of list) {
      handler(params);
    }
  };

  return { session, emit };
}

describe('PuppeteerAdapter CDP Network observation', () => {
  it('should use CDP Network domain when cdpSession is provided', async () => {
    const { page } = createMockPage();
    const { session } = createMockCDPSession();
    const adapter = new PuppeteerAdapter({ page, cdpSession: session });

    await adapter.startApiInterception();

    // Should call Network.enable, NOT setRequestInterception
    expect(session.send).toHaveBeenCalledWith('Network.enable');
    expect(page.setRequestInterception).not.toHaveBeenCalled();
  });

  it('should capture request via Network.requestWillBeSent', async () => {
    const { page } = createMockPage();
    const { session, emit } = createMockCDPSession();
    const adapter = new PuppeteerAdapter({ page, cdpSession: session });

    await adapter.startApiInterception();

    emit('Network.requestWillBeSent', {
      requestId: 'req-1',
      type: 'Fetch',
      request: {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: { accept: 'application/json' },
      },
      timestamp: 1000,
    });

    const calls = adapter.getApiCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].request.id).toBe('req-1');
    expect(calls[0].request.url).toBe('https://api.example.com/users');
    expect(calls[0].request.method).toBe('GET');
    expect(calls[0].pending).toBe(true);
  });

  it('should ignore non-XHR/Fetch requests', async () => {
    const { page } = createMockPage();
    const { session, emit } = createMockCDPSession();
    const adapter = new PuppeteerAdapter({ page, cdpSession: session });

    await adapter.startApiInterception();

    // Image request — should be ignored
    emit('Network.requestWillBeSent', {
      requestId: 'img-1',
      type: 'Image',
      request: { url: 'https://cdn.example.com/logo.png', method: 'GET', headers: {} },
      timestamp: 1000,
    });

    expect(adapter.getApiCalls()).toHaveLength(0);
  });

  it('should capture response metadata via Network.responseReceived', async () => {
    const { page } = createMockPage();
    const { session, emit } = createMockCDPSession();
    const adapter = new PuppeteerAdapter({ page, cdpSession: session });

    await adapter.startApiInterception();

    emit('Network.requestWillBeSent', {
      requestId: 'req-2',
      type: 'XHR',
      request: { url: 'https://api.example.com/data', method: 'POST', headers: {} },
      timestamp: 1000,
    });

    emit('Network.responseReceived', {
      requestId: 'req-2',
      type: 'XHR',
      response: {
        url: 'https://api.example.com/data',
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
        mimeType: 'application/json',
      },
      timestamp: 1001,
    });

    const calls = adapter.getApiCalls();
    expect(calls[0].response).toBeDefined();
    expect(calls[0].response!.status).toBe(201);
    expect(calls[0].response!.statusText).toBe('Created');
    // Body is still undefined until loadingFinished
    expect(calls[0].response!.body).toBeUndefined();
  });

  it('should retrieve body via Network.getResponseBody on loadingFinished', async () => {
    const { page } = createMockPage();
    const { session, emit } = createMockCDPSession();

    // Mock getResponseBody to return JSON
    (session.send as ReturnType<typeof vi.fn>).mockImplementation((method: string) => {
      if (method === 'Network.getResponseBody') {
        return Promise.resolve({
          body: '{"items":[1,2,3]}',
          base64Encoded: false,
        });
      }
      return Promise.resolve(undefined);
    });

    const adapter = new PuppeteerAdapter({ page, cdpSession: session });
    await adapter.startApiInterception();

    // Full lifecycle: request → response → loadingFinished
    emit('Network.requestWillBeSent', {
      requestId: 'req-3',
      type: 'Fetch',
      request: { url: 'https://api.example.com/items', method: 'GET', headers: {} },
      timestamp: 1000,
    });

    emit('Network.responseReceived', {
      requestId: 'req-3',
      type: 'Fetch',
      response: {
        url: 'https://api.example.com/items',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        mimeType: 'application/json',
      },
      timestamp: 1001,
    });

    emit('Network.loadingFinished', {
      requestId: 'req-3',
      timestamp: 1002,
    });

    // Wait for async getResponseBody
    await new Promise((r) => setTimeout(r, 10));

    const calls = adapter.getApiCalls();
    expect(calls[0].response!.body).toEqual({ items: [1, 2, 3] });
    expect(calls[0].pending).toBe(false);

    // Verify getResponseBody was called with the right requestId
    expect(session.send).toHaveBeenCalledWith('Network.getResponseBody', { requestId: 'req-3' });
  });

  it('should handle concurrent CDP requests with unique requestIds', async () => {
    const { page } = createMockPage();
    const { session, emit } = createMockCDPSession();

    // Return different bodies based on requestId
    (session.send as ReturnType<typeof vi.fn>).mockImplementation(
      (method: string, params?: Record<string, unknown>) => {
        if (method === 'Network.getResponseBody') {
          const id = params?.requestId as string;
          if (id === 'req-a')
            return Promise.resolve({ body: '{"user":"Alice"}', base64Encoded: false });
          if (id === 'req-b')
            return Promise.resolve({ body: '{"user":"Bob"}', base64Encoded: false });
        }
        return Promise.resolve(undefined);
      }
    );

    const adapter = new PuppeteerAdapter({ page, cdpSession: session });
    await adapter.startApiInterception();

    // Two requests to the same endpoint
    emit('Network.requestWillBeSent', {
      requestId: 'req-a',
      type: 'Fetch',
      request: { url: 'https://api.example.com/user', method: 'GET', headers: {} },
      timestamp: 1000,
    });
    emit('Network.requestWillBeSent', {
      requestId: 'req-b',
      type: 'Fetch',
      request: { url: 'https://api.example.com/user', method: 'GET', headers: {} },
      timestamp: 1001,
    });

    // Responses arrive in reverse order
    emit('Network.responseReceived', {
      requestId: 'req-b',
      type: 'Fetch',
      response: {
        url: 'https://api.example.com/user',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        mimeType: 'application/json',
      },
      timestamp: 1002,
    });
    emit('Network.responseReceived', {
      requestId: 'req-a',
      type: 'Fetch',
      response: {
        url: 'https://api.example.com/user',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        mimeType: 'application/json',
      },
      timestamp: 1003,
    });

    emit('Network.loadingFinished', { requestId: 'req-b', timestamp: 1004 });
    emit('Network.loadingFinished', { requestId: 'req-a', timestamp: 1005 });

    await new Promise((r) => setTimeout(r, 10));

    const calls = adapter.getApiCalls();
    expect(calls).toHaveLength(2);

    const bodies = calls.map((c) => c.response?.body);
    expect(bodies).toContainEqual({ user: 'Alice' });
    expect(bodies).toContainEqual({ user: 'Bob' });
  });

  it('should handle getResponseBody failure gracefully', async () => {
    const { page } = createMockPage();
    const { session, emit } = createMockCDPSession();

    (session.send as ReturnType<typeof vi.fn>).mockImplementation((method: string) => {
      if (method === 'Network.getResponseBody') {
        return Promise.reject(new Error('No resource with given identifier found'));
      }
      return Promise.resolve(undefined);
    });

    const adapter = new PuppeteerAdapter({ page, cdpSession: session });
    await adapter.startApiInterception();

    emit('Network.requestWillBeSent', {
      requestId: 'req-fail',
      type: 'Fetch',
      request: { url: 'https://api.example.com/redirect', method: 'GET', headers: {} },
      timestamp: 1000,
    });

    emit('Network.responseReceived', {
      requestId: 'req-fail',
      type: 'Fetch',
      response: {
        url: 'https://api.example.com/redirect',
        status: 302,
        statusText: 'Found',
        headers: {},
        mimeType: '',
      },
      timestamp: 1001,
    });

    emit('Network.loadingFinished', { requestId: 'req-fail', timestamp: 1002 });

    await new Promise((r) => setTimeout(r, 10));

    const calls = adapter.getApiCalls();
    // Should be marked as not pending even if body retrieval failed
    expect(calls[0].pending).toBe(false);
    expect(calls[0].response!.body).toBeUndefined();
  });

  it('should stop CDP observation and call Network.disable', async () => {
    const { page } = createMockPage();
    const { session } = createMockCDPSession();
    const adapter = new PuppeteerAdapter({ page, cdpSession: session });

    await adapter.startApiInterception();
    await adapter.stopApiInterception();

    expect(session.send).toHaveBeenCalledWith('Network.disable');
    expect(session.off).toHaveBeenCalledTimes(3); // 3 event handlers removed
  });
});
