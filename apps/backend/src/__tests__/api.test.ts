import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { closeDb, getDb, initializeDb } from '../db';
import { CREATE_TABLES_SQL, DROP_TABLES_SQL } from '../db/schema';

// Type for API responses
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

let app: ReturnType<typeof createApp>;

beforeAll(() => {
  // Use in-memory database for tests
  initializeDb(':memory:');
  app = createApp();
});

afterAll(() => {
  closeDb();
});

beforeEach(() => {
  // Reset database between tests
  const db = getDb();
  db.exec(DROP_TABLES_SQL);
  db.exec(CREATE_TABLES_SQL);
});

describe('Health API', () => {
  it('GET /api/health returns ok status', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);

    const data = (await res.json()) as { status: string; database: string };
    expect(data.status).toBe('ok');
    expect(data.database).toBe('connected');
  });

  it('GET /api/health/ready returns ready when db connected', async () => {
    const res = await app.request('/api/health/ready');
    expect(res.status).toBe(200);

    const data = (await res.json()) as { status: string };
    expect(data.status).toBe('ready');
  });

  it('GET /api/health/live returns alive', async () => {
    const res = await app.request('/api/health/live');
    expect(res.status).toBe(200);

    const data = (await res.json()) as { status: string };
    expect(data.status).toBe('alive');
  });
});

describe('Sessions API', () => {
  it('POST /api/sessions creates a new session', async () => {
    const res = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        name: 'Test Session',
        viewport: { width: 1920, height: 1080 },
      }),
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as ApiResponse<{
      name: string;
      url: string;
      status: string;
      viewport: { width: number };
    }>;
    expect(data.success).toBe(true);
    expect(data.data?.name).toBe('Test Session');
    expect(data.data?.url).toBe('https://example.com');
    expect(data.data?.status).toBe('recording');
    expect(data.data?.viewport.width).toBe(1920);
  });

  it('GET /api/sessions lists all sessions', async () => {
    // Create a session first
    await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });

    const res = await app.request('/api/sessions');
    expect(res.status).toBe(200);

    const data = (await res.json()) as ApiResponse<{ items: unknown[] }>;
    expect(data.success).toBe(true);
    expect(data.data?.items).toHaveLength(1);
  });

  it('GET /api/sessions/:id returns a session by ID', async () => {
    // Create a session
    const createRes = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', name: 'Get Test' }),
    });
    const createData = (await createRes.json()) as ApiResponse<{ id: string }>;
    const created = createData.data!;

    const res = await app.request(`/api/sessions/${created.id}`);
    expect(res.status).toBe(200);

    const data = (await res.json()) as ApiResponse<{ id: string; name: string }>;
    expect(data.success).toBe(true);
    expect(data.data?.id).toBe(created.id);
    expect(data.data?.name).toBe('Get Test');
  });

  it('GET /api/sessions/:id returns 404 for non-existent session', async () => {
    const res = await app.request('/api/sessions/non-existent');
    expect(res.status).toBe(404);

    const data = (await res.json()) as ApiResponse<null>;
    expect(data.success).toBe(false);
  });

  it('PATCH /api/sessions/:id updates a session', async () => {
    // Create a session
    const createRes = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const createData = (await createRes.json()) as ApiResponse<{ id: string }>;
    const created = createData.data!;

    const res = await app.request(`/api/sessions/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name', status: 'paused' }),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as ApiResponse<{ name: string; status: string }>;
    expect(data.success).toBe(true);
    expect(data.data?.name).toBe('Updated Name');
    expect(data.data?.status).toBe('paused');
  });

  it('POST /api/sessions/:id/stop stops a session', async () => {
    // Create a session
    const createRes = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const createData = (await createRes.json()) as ApiResponse<{ id: string }>;
    const created = createData.data!;

    const res = await app.request(`/api/sessions/${created.id}/stop`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as ApiResponse<{ status: string; endedAt: number }>;
    expect(data.success).toBe(true);
    expect(data.data?.status).toBe('stopped');
    expect(data.data?.endedAt).toBeDefined();
  });

  it('DELETE /api/sessions/:id deletes a session', async () => {
    // Create a session
    const createRes = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const createData = (await createRes.json()) as ApiResponse<{ id: string }>;
    const created = createData.data!;

    const res = await app.request(`/api/sessions/${created.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    expect(data.success).toBe(true);
    expect(data.data?.deleted).toBe(true);

    // Verify deletion
    const getRes = await app.request(`/api/sessions/${created.id}`);
    expect(getRes.status).toBe(404);
  });

  it('POST /api/sessions/:id/events adds an event to session', async () => {
    // Create a session
    const createRes = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const createData = (await createRes.json()) as ApiResponse<{ id: string }>;
    const session = createData.data!;

    const event = {
      id: 'event-1',
      type: 'click',
      timestamp: Date.now(),
      url: 'https://example.com',
      target: {
        tagName: 'button',
        testId: 'submit-btn',
        selector: { strategy: 'testId', value: 'submit-btn' },
      },
      button: 0,
      position: { x: 100, y: 200 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    };

    const res = await app.request(`/api/sessions/${session.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    expect(res.status).toBe(201);

    // Verify event was added
    const eventsRes = await app.request(`/api/sessions/${session.id}/events`);
    const eventsData = (await eventsRes.json()) as ApiResponse<Array<{ type: string }>>;
    expect(eventsData.data).toHaveLength(1);
    expect(eventsData.data?.[0].type).toBe('click');
  });
});

describe('Scenarios API', () => {
  it('POST /api/scenarios creates a new scenario', async () => {
    const res = await app.request('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Login Test',
        url: 'https://example.com',
        steps: [
          { type: 'navigate', url: '/login' },
          { type: 'type', selector: '[data-testid="email"]', value: 'test@example.com' },
          { type: 'click', selector: '[data-testid="submit"]' },
        ],
      }),
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as ApiResponse<{ name: string; steps: unknown[] }>;
    expect(data.success).toBe(true);
    expect(data.data?.name).toBe('Login Test');
    expect(data.data?.steps).toHaveLength(3);
  });

  it('GET /api/scenarios lists all scenarios', async () => {
    // Create a scenario
    await app.request('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        steps: [{ type: 'navigate', url: '/' }],
      }),
    });

    const res = await app.request('/api/scenarios');
    expect(res.status).toBe(200);

    const data = (await res.json()) as ApiResponse<{ items: unknown[] }>;
    expect(data.success).toBe(true);
    expect(data.data?.items).toHaveLength(1);
  });

  it('GET /api/scenarios/:id returns a scenario by ID', async () => {
    const createRes = await app.request('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Scenario',
        url: 'https://example.com',
        steps: [{ type: 'navigate', url: '/' }],
      }),
    });
    const createData = (await createRes.json()) as ApiResponse<{ id: string }>;
    const created = createData.data!;

    const res = await app.request(`/api/scenarios/${created.id}`);
    expect(res.status).toBe(200);

    const data = (await res.json()) as ApiResponse<{ name: string }>;
    expect(data.success).toBe(true);
    expect(data.data?.name).toBe('Test Scenario');
  });

  it('GET /api/scenarios/:id/export exports scenario as JSON', async () => {
    const createRes = await app.request('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Export Test',
        description: 'Test description',
        url: 'https://example.com',
        steps: [
          { type: 'navigate', url: '/' },
          { type: 'click', selector: '[data-testid="btn"]' },
        ],
      }),
    });
    const createData = (await createRes.json()) as ApiResponse<{ id: string }>;
    const created = createData.data!;

    const res = await app.request(`/api/scenarios/${created.id}/export`);
    expect(res.status).toBe(200);

    const json = (await res.json()) as ApiResponse<{
      id: string;
      meta: { name: string };
      steps: unknown[];
    }>;
    expect(json.success).toBe(true);
    expect(json.data!.id).toBe(created.id);
    expect(json.data!.meta.name).toBe('Export Test');
    expect(json.data!.steps).toHaveLength(2);
  });

  it('POST /api/scenarios/import imports a scenario from JSON', async () => {
    const scenarioJson = {
      meta: {
        name: 'Imported Scenario',
        url: 'https://example.com',
        viewport: { width: 1440, height: 900 },
      },
      steps: [
        { type: 'navigate', url: '/home' },
        { type: 'type', selector: '#search', value: 'test query' },
      ],
    };

    const res = await app.request('/api/scenarios/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenarioJson),
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as ApiResponse<{ name: string; steps: unknown[] }>;
    expect(data.success).toBe(true);
    expect(data.data?.name).toBe('Imported Scenario');
    expect(data.data?.steps).toHaveLength(2);
  });

  it('POST /api/scenarios/from-session creates scenario from session', async () => {
    // Create a session with events
    const sessionRes = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com', name: 'Session for Scenario' }),
    });
    const sessionData = (await sessionRes.json()) as ApiResponse<{ id: string }>;
    const session = sessionData.data!;

    // Add events to the session
    const event = {
      id: 'event-1',
      type: 'click',
      timestamp: Date.now(),
      url: 'https://example.com',
      target: {
        tagName: 'button',
        testId: 'submit',
        id: '',
        classNames: [],
        attributes: {},
        textContent: 'Submit',
        isVisible: true,
        rect: { x: 100, y: 200, width: 100, height: 40 },
        selector: { strategy: 'testId', value: 'submit' },
      },
      button: 0,
      position: { x: 100, y: 200 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    };

    await app.request(`/api/sessions/${session.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });

    // Create scenario from session
    const res = await app.request('/api/scenarios/from-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, name: 'From Session Test' }),
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as ApiResponse<{ name: string; sessionId: string }>;
    expect(data.success).toBe(true);
    expect(data.data?.name).toBe('From Session Test');
    expect(data.data?.sessionId).toBe(session.id);
  });

  it('PATCH /api/scenarios/:id updates a scenario', async () => {
    const createRes = await app.request('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Original Name',
        url: 'https://example.com',
        steps: [{ type: 'navigate', url: '/' }],
      }),
    });
    const createData = (await createRes.json()) as ApiResponse<{ id: string }>;
    const created = createData.data!;

    const res = await app.request(`/api/scenarios/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Updated Name',
        tags: ['smoke', 'login'],
      }),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as ApiResponse<{ name: string; tags: string[] }>;
    expect(data.success).toBe(true);
    expect(data.data?.name).toBe('Updated Name');
    expect(data.data?.tags).toEqual(['smoke', 'login']);
  });

  it('DELETE /api/scenarios/:id deletes a scenario', async () => {
    const createRes = await app.request('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://example.com',
        steps: [{ type: 'navigate', url: '/' }],
      }),
    });
    const createData = (await createRes.json()) as ApiResponse<{ id: string }>;
    const created = createData.data!;

    const res = await app.request(`/api/scenarios/${created.id}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as ApiResponse<{ deleted: boolean }>;
    expect(data.success).toBe(true);
    expect(data.data?.deleted).toBe(true);
  });
});

describe('Error Handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/api/unknown');
    expect(res.status).toBe(404);

    const data = (await res.json()) as ApiResponse<null>;
    expect(data.success).toBe(false);
    expect(data.error).toBe('Not Found');
  });

  it('returns 400 for invalid request body', async () => {
    const res = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'body' }), // missing required 'url'
    });

    expect(res.status).toBe(400);
  });
});
