import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { closeDb, getDb, initializeDb } from '../../db';
import { CREATE_TABLES_SQL, DROP_TABLES_SQL } from '../../db/schema';
import { loginFlowEvents, sampleSessionInput, searchFlowEvents } from './fixtures';

/**
 * Integration Tests: Backend API Full Flow
 *
 * These tests simulate the complete flow:
 * 1. Extension creates a session
 * 2. Extension sends events to the session
 * 3. Backend transforms events to scenario
 * 4. Scenario is exported for runner
 */

describe('Integration: Full Recording Flow', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    initializeDb(':memory:');
    app = createApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.exec(DROP_TABLES_SQL);
    db.exec(CREATE_TABLES_SQL);
  });

  afterAll(() => {
    closeDb();
  });

  describe('Step 1: Session Creation (simulating Extension)', () => {
    it('should create a new recording session', async () => {
      const res = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleSessionInput),
      });

      expect(res.status).toBe(201);

      const json = (await res.json()) as {
        success: boolean;
        data: {
          id: string;
          name: string;
          url: string;
          status: string;
        };
      };

      expect(json.success).toBe(true);
      expect(json.data.id).toMatch(/^session-/);
      expect(json.data.name).toBe('Login Flow Test');
      expect(json.data.url).toBe('https://example.com/login');
      expect(json.data.status).toBe('recording');
    });
  });

  describe('Step 2: Event Collection (simulating Extension → Backend)', () => {
    it('should receive and store events from Extension', async () => {
      // Create session first
      const sessionRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleSessionInput),
      });

      const sessionJson = (await sessionRes.json()) as {
        data: { id: string };
      };
      const sessionId = sessionJson.data.id;

      // Send events in batch (simulating Extension upload)
      const batchRes = await app.request(`/api/sessions/${sessionId}/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: loginFlowEvents }),
      });

      expect(batchRes.status).toBe(201);

      const batchJson = (await batchRes.json()) as {
        success: boolean;
        data: { count: number };
      };

      expect(batchJson.success).toBe(true);
      expect(batchJson.data.count).toBe(loginFlowEvents.length);

      // Verify events are stored
      const eventsRes = await app.request(`/api/sessions/${sessionId}/events`);
      const eventsJson = (await eventsRes.json()) as {
        data: unknown[];
        meta: { total: number };
      };

      expect(eventsJson.meta.total).toBe(loginFlowEvents.length);
    });

    it('should handle individual event addition', async () => {
      const sessionRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleSessionInput),
      });

      const sessionJson = (await sessionRes.json()) as {
        data: { id: string };
      };
      const sessionId = sessionJson.data.id;

      // Send single event
      const eventRes = await app.request(`/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginFlowEvents[0]),
      });

      expect(eventRes.status).toBe(201);
    });
  });

  describe('Step 3: Scenario Creation from Session', () => {
    it('should transform events to scenario with proper steps', async () => {
      // Create session
      const sessionRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleSessionInput),
      });

      const sessionJson = (await sessionRes.json()) as {
        data: { id: string };
      };
      const sessionId = sessionJson.data.id;

      // Add events
      await app.request(`/api/sessions/${sessionId}/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: loginFlowEvents }),
      });

      // Stop recording
      await app.request(`/api/sessions/${sessionId}/stop`, {
        method: 'POST',
      });

      // Create scenario from session
      const scenarioRes = await app.request('/api/scenarios/from-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: 'Login Flow Scenario',
        }),
      });

      expect(scenarioRes.status).toBe(201);

      const scenarioJson = (await scenarioRes.json()) as {
        success: boolean;
        data: {
          id: string;
          name: string;
          sessionId: string;
          steps: Array<{ type: string }>;
          url: string;
        };
      };

      expect(scenarioJson.success).toBe(true);
      expect(scenarioJson.data.id).toMatch(/^scenario-/);
      expect(scenarioJson.data.name).toBe('Login Flow Scenario');
      expect(scenarioJson.data.sessionId).toBe(sessionId);
      expect(scenarioJson.data.url).toBe('https://example.com/login');

      // Verify steps were generated
      const steps = scenarioJson.data.steps;
      expect(steps.length).toBeGreaterThan(0);

      // Check that we have expected step types
      const stepTypes = steps.map((s) => s.type);
      expect(stepTypes).toContain('navigate');
      expect(stepTypes).toContain('click');
      expect(stepTypes).toContain('type');
    });

    it('should merge consecutive type events', async () => {
      // Create session with search flow (includes typing)
      const sessionRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com',
          name: 'Search Flow',
        }),
      });

      const sessionJson = (await sessionRes.json()) as {
        data: { id: string };
      };
      const sessionId = sessionJson.data.id;

      // Add events
      await app.request(`/api/sessions/${sessionId}/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: searchFlowEvents }),
      });

      // Create scenario
      const scenarioRes = await app.request('/api/scenarios/from-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const scenarioJson = (await scenarioRes.json()) as {
        data: {
          steps: Array<{ type: string; value?: string }>;
        };
      };

      // Check that type events are properly merged
      const typeSteps = scenarioJson.data.steps.filter((s) => s.type === 'type');
      if (typeSteps.length > 0) {
        expect(typeSteps[0].value).toBe('test query');
      }
    });
  });

  describe('Step 4: Scenario Export for Runner', () => {
    it('should export scenario in runner-compatible format', async () => {
      // Create session and add events
      const sessionRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleSessionInput),
      });

      const sessionJson = (await sessionRes.json()) as {
        data: { id: string };
      };
      const sessionId = sessionJson.data.id;

      await app.request(`/api/sessions/${sessionId}/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: loginFlowEvents }),
      });

      // Create scenario
      const createRes = await app.request('/api/scenarios/from-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name: 'Export Test' }),
      });

      const createJson = (await createRes.json()) as {
        data: { id: string };
      };
      const scenarioId = createJson.data.id;

      // Export scenario
      const exportRes = await app.request(`/api/scenarios/${scenarioId}/export`);
      expect(exportRes.status).toBe(200);

      const exportJson = (await exportRes.json()) as {
        success: boolean;
        data: {
          id: string;
          meta: {
            name: string;
            url: string;
            viewport: { width: number; height: number };
            recordedAt: string;
            astSchemaVersion: string;
          };
          steps: unknown[];
        };
      };

      expect(exportJson.success).toBe(true);

      // Verify export format matches runner expectations
      const exported = exportJson.data;
      expect(exported.id).toBe(scenarioId);
      expect(exported.meta).toBeDefined();
      expect(exported.meta.name).toBe('Export Test');
      expect(exported.meta.url).toBe('https://example.com/login');
      expect(exported.meta.viewport).toBeDefined();
      expect(exported.meta.recordedAt).toBeDefined();
      expect(exported.meta.astSchemaVersion).toBe('1.0.0');
      expect(exported.steps).toBeDefined();
      expect(Array.isArray(exported.steps)).toBe(true);
    });
  });

  describe('Step 5: Execution Result Storage', () => {
    it('should store execution results from runner', async () => {
      // Create a scenario first
      const scenarioRes = await app.request('/api/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com',
          name: 'Test Scenario',
          steps: [{ type: 'navigate', url: 'https://example.com' }],
        }),
      });

      const scenarioJson = (await scenarioRes.json()) as {
        data: { id: string };
      };
      const scenarioId = scenarioJson.data.id;

      // Simulate runner sending execution result
      const executionResult = {
        status: 'passed',
        totalSteps: 1,
        passed: 1,
        failed: 0,
        skipped: 0,
        duration: 1500,
        stepResults: [
          {
            stepId: 'step-0',
            index: 0,
            status: 'passed',
            duration: 1500,
          },
        ],
        environment: {
          os: 'darwin',
          nodeVersion: 'v20.0.0',
          puppeteerVersion: '24.0.0',
        },
        executedAt: Date.now(),
      };

      const resultRes = await app.request(`/api/scenarios/${scenarioId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(executionResult),
      });

      expect(resultRes.status).toBe(201);

      const resultJson = (await resultRes.json()) as {
        success: boolean;
        data: {
          id: string;
          scenarioId: string;
          status: string;
        };
      };

      expect(resultJson.success).toBe(true);
      expect(resultJson.data.id).toMatch(/^result-/);
      expect(resultJson.data.scenarioId).toBe(scenarioId);
      expect(resultJson.data.status).toBe('passed');

      // Verify result is retrievable
      const getResultsRes = await app.request(`/api/scenarios/${scenarioId}/results`);

      const getResultsJson = (await getResultsRes.json()) as {
        data: { items: unknown[] };
      };

      expect(getResultsJson.data.items.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle session not found', async () => {
      const res = await app.request('/api/sessions/nonexistent-session');
      expect(res.status).toBe(404);
    });

    it('should handle adding events to stopped session', async () => {
      // Create and stop session
      const sessionRes = await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleSessionInput),
      });

      const sessionJson = (await sessionRes.json()) as {
        data: { id: string };
      };
      const sessionId = sessionJson.data.id;

      await app.request(`/api/sessions/${sessionId}/stop`, {
        method: 'POST',
      });

      // Try to add event
      const eventRes = await app.request(`/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginFlowEvents[0]),
      });

      expect(eventRes.status).toBe(400);
    });

    it('should handle scenario creation from invalid session', async () => {
      const res = await app.request('/api/scenarios/from-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'nonexistent-session' }),
      });

      expect(res.status).toBe(404);
    });
  });
});

describe('Integration: Multi-Session Flow', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    initializeDb(':memory:');
    app = createApp();
  });

  beforeEach(() => {
    const db = getDb();
    db.exec(DROP_TABLES_SQL);
    db.exec(CREATE_TABLES_SQL);
  });

  afterAll(() => {
    closeDb();
  });

  it('should handle multiple concurrent sessions', async () => {
    // Create multiple sessions
    const session1Res = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/page1', name: 'Session 1' }),
    });

    const session2Res = await app.request('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/page2', name: 'Session 2' }),
    });

    const session1 = (await session1Res.json()) as { data: { id: string } };
    const session2 = (await session2Res.json()) as { data: { id: string } };

    // Add events to both
    await app.request(`/api/sessions/${session1.data.id}/events/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: loginFlowEvents }),
    });

    await app.request(`/api/sessions/${session2.data.id}/events/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: searchFlowEvents }),
    });

    // Verify isolation
    const events1Res = await app.request(`/api/sessions/${session1.data.id}/events`);
    const events2Res = await app.request(`/api/sessions/${session2.data.id}/events`);

    const events1 = (await events1Res.json()) as { meta: { total: number } };
    const events2 = (await events2Res.json()) as { meta: { total: number } };

    expect(events1.meta.total).toBe(loginFlowEvents.length);
    expect(events2.meta.total).toBe(searchFlowEvents.length);
  });

  it('should list all sessions with pagination', async () => {
    // Create 5 sessions
    for (let i = 0; i < 5; i++) {
      await app.request('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://example.com/page${i}` }),
      });
    }

    // Get first page
    const page1Res = await app.request('/api/sessions?page=1&limit=3');
    const page1 = (await page1Res.json()) as {
      data: { items: unknown[]; hasMore: boolean };
      meta: { total: number };
    };

    expect(page1.data.items.length).toBe(3);
    expect(page1.meta.total).toBe(5);
    expect(page1.data.hasMore).toBe(true);

    // Get second page
    const page2Res = await app.request('/api/sessions?page=2&limit=3');
    const page2 = (await page2Res.json()) as {
      data: { items: unknown[]; hasMore: boolean };
    };

    expect(page2.data.items.length).toBe(2);
    expect(page2.data.hasMore).toBe(false);
  });
});
