/**
 * Unit tests for apps/backend/src/routes/models.ts
 *
 * POST /execute    — delegates to modelExecutionService.execute
 * POST /save-scenarios — delegates to scenarioService.create for each scenario
 *
 * Both services are mocked so no database or Puppeteer is involved.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { models } from '../models';
import type { ApiResponse } from '../../types';

// ── Service mocks ────────────────────────────────────────────────────────────

vi.mock('../../services/model-execution.service', () => ({
  modelExecutionService: {
    execute: vi.fn(),
  },
}));

vi.mock('../../services/scenario.service', () => ({
  scenarioService: {
    create: vi.fn(),
  },
}));

// Import after mocks are registered so the route module picks up the stubs.
import { modelExecutionService } from '../../services/model-execution.service';
import { scenarioService } from '../../services/scenario.service';

// ── Test app ─────────────────────────────────────────────────────────────────

const app = new Hono();
app.route('/models', models);

// ── Helpers ──────────────────────────────────────────────────────────────────

const post = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const minimalScenario = (overrides: Record<string, unknown> = {}) => ({
  id: 'scenario-001',
  steps: [{ type: 'navigate', url: 'https://example.com' }],
  ...overrides,
});

const executeBody = (overrides: Record<string, unknown> = {}) => ({
  modelId: 'model-abc',
  modelName: 'Login Flow',
  scenarios: [minimalScenario()],
  ...overrides,
});

const saveScenariosBody = (overrides: Record<string, unknown> = {}) => ({
  modelName: 'Login Flow',
  baseUrl: 'https://example.com',
  scenarios: [minimalScenario()],
  ...overrides,
});

// ── POST /models/execute ─────────────────────────────────────────────────────

describe('POST /models/execute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 and execution result when request is valid', async () => {
    const mockResult = {
      modelId: 'model-abc',
      modelName: 'Login Flow',
      status: 'passed',
      scenarioResults: [],
      summary: {
        totalScenarios: 1,
        passedScenarios: 1,
        failedScenarios: 0,
        skippedScenarios: 0,
        totalSteps: 1,
        passedSteps: 1,
        failedSteps: 0,
        skippedSteps: 0,
        duration: 120,
      },
      startedAt: 1000,
      endedAt: 1120,
    };

    vi.mocked(modelExecutionService.execute).mockResolvedValue(mockResult as never);

    const res = await post('/models/execute', executeBody());

    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<typeof mockResult>;
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockResult);
  });

  it('calls modelExecutionService.execute with correct arguments', async () => {
    vi.mocked(modelExecutionService.execute).mockResolvedValue({} as never);

    const requestBody = executeBody({
      options: { headless: false, timeout: 10000 },
    });

    await post('/models/execute', requestBody);

    expect(modelExecutionService.execute).toHaveBeenCalledOnce();
    expect(modelExecutionService.execute).toHaveBeenCalledWith(
      'model-abc',
      'Login Flow',
      requestBody.scenarios,
      { headless: false, timeout: 10000 },
    );
  });

  it('returns 400 when modelId is missing', async () => {
    const { modelId: _omitted, ...bodyWithoutModelId } = executeBody();

    const res = await post('/models/execute', bodyWithoutModelId);

    expect(res.status).toBe(400);
    expect(modelExecutionService.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when modelName is missing', async () => {
    const { modelName: _omitted, ...bodyWithoutModelName } = executeBody();

    const res = await post('/models/execute', bodyWithoutModelName);

    expect(res.status).toBe(400);
    expect(modelExecutionService.execute).not.toHaveBeenCalled();
  });

  it('returns 200 with empty scenarioResults when scenarios array is empty', async () => {
    const emptyResult = {
      modelId: 'model-abc',
      modelName: 'Login Flow',
      status: 'passed',
      scenarioResults: [],
      summary: {
        totalScenarios: 0,
        passedScenarios: 0,
        failedScenarios: 0,
        skippedScenarios: 0,
        totalSteps: 0,
        passedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0,
        duration: 0,
      },
      startedAt: 1000,
      endedAt: 1000,
    };

    vi.mocked(modelExecutionService.execute).mockResolvedValue(emptyResult as never);

    const res = await post('/models/execute', executeBody({ scenarios: [] }));

    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<typeof emptyResult>;
    expect(body.success).toBe(true);
    expect(body.data?.scenarioResults).toHaveLength(0);
  });

  it('returns 500 with error message when service throws', async () => {
    vi.mocked(modelExecutionService.execute).mockRejectedValue(
      new Error('Browser failed to launch'),
    );

    const res = await post('/models/execute', executeBody());

    expect(res.status).toBe(500);

    const body = (await res.json()) as ApiResponse<null>;
    expect(body.success).toBe(false);
    expect(body.error).toContain('Browser failed to launch');
    expect(body.error).toContain('Model execution failed');
  });

  it('returns 500 with stringified error when service throws a non-Error value', async () => {
    vi.mocked(modelExecutionService.execute).mockRejectedValue('unexpected string error');

    const res = await post('/models/execute', executeBody());

    expect(res.status).toBe(500);

    const body = (await res.json()) as ApiResponse<null>;
    expect(body.success).toBe(false);
    expect(body.error).toContain('unexpected string error');
  });
});

// ── POST /models/save-scenarios ──────────────────────────────────────────────

describe('POST /models/save-scenarios', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with savedIds and count when two scenarios are saved', async () => {
    vi.mocked(scenarioService.create)
      .mockReturnValueOnce({ id: 'saved-001' } as never)
      .mockReturnValueOnce({ id: 'saved-002' } as never);

    const res = await post(
      '/models/save-scenarios',
      saveScenariosBody({
        scenarios: [
          minimalScenario({ id: 'sc-1' }),
          minimalScenario({ id: 'sc-2' }),
        ],
      }),
    );

    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<{ savedIds: string[]; count: number }>;
    expect(body.success).toBe(true);
    expect(body.data?.savedIds).toEqual(['saved-001', 'saved-002']);
    expect(body.data?.count).toBe(2);
  });

  it('calls scenarioService.create for each scenario with correct arguments', async () => {
    vi.mocked(scenarioService.create)
      .mockReturnValueOnce({ id: 'saved-001' } as never)
      .mockReturnValueOnce({ id: 'saved-002' } as never);

    const scenarios = [
      minimalScenario({ id: 'sc-1', name: 'First Scenario' }),
      minimalScenario({ id: 'sc-2' }),
    ];

    await post(
      '/models/save-scenarios',
      saveScenariosBody({ scenarios }),
    );

    expect(scenarioService.create).toHaveBeenCalledTimes(2);

    // First scenario uses its explicit name
    expect(scenarioService.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'First Scenario', url: 'https://example.com' }),
    );

    // Second scenario falls back to the model-name-prefixed default
    expect(scenarioService.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: '[Login Flow] Scenario 2', url: 'https://example.com' }),
    );
  });

  it('uses model name prefix in generated scenario name when name is absent', async () => {
    vi.mocked(scenarioService.create).mockReturnValue({ id: 'saved-001' } as never);

    await post(
      '/models/save-scenarios',
      saveScenariosBody({
        modelName: 'Checkout Flow',
        scenarios: [minimalScenario()],
      }),
    );

    expect(scenarioService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: '[Checkout Flow] Scenario 1' }),
    );
  });

  it('uses scenario viewport from meta when present', async () => {
    vi.mocked(scenarioService.create).mockReturnValue({ id: 'saved-001' } as never);

    const scenarioWithViewport = minimalScenario({
      meta: { viewport: { width: 375, height: 812 } },
    });

    await post('/models/save-scenarios', saveScenariosBody({ scenarios: [scenarioWithViewport] }));

    expect(scenarioService.create).toHaveBeenCalledWith(
      expect.objectContaining({ viewport: { width: 375, height: 812 } }),
    );
  });

  it('falls back to 1440x900 viewport when meta is absent', async () => {
    vi.mocked(scenarioService.create).mockReturnValue({ id: 'saved-001' } as never);

    await post('/models/save-scenarios', saveScenariosBody());

    expect(scenarioService.create).toHaveBeenCalledWith(
      expect.objectContaining({ viewport: { width: 1440, height: 900 } }),
    );
  });

  it('returns 400 when modelName is missing', async () => {
    const { modelName: _omitted, ...bodyWithoutModelName } = saveScenariosBody();

    const res = await post('/models/save-scenarios', bodyWithoutModelName);

    expect(res.status).toBe(400);
    expect(scenarioService.create).not.toHaveBeenCalled();
  });

  it('returns 400 when baseUrl is missing', async () => {
    const { baseUrl: _omitted, ...bodyWithoutBaseUrl } = saveScenariosBody();

    const res = await post('/models/save-scenarios', bodyWithoutBaseUrl);

    expect(res.status).toBe(400);
    expect(scenarioService.create).not.toHaveBeenCalled();
  });

  it('returns 500 with error message when service throws', async () => {
    vi.mocked(scenarioService.create).mockImplementation(() => {
      throw new Error('DB write error');
    });

    const res = await post('/models/save-scenarios', saveScenariosBody());

    expect(res.status).toBe(500);

    const body = (await res.json()) as ApiResponse<null>;
    expect(body.success).toBe(false);
    expect(body.error).toContain('DB write error');
    expect(body.error).toContain('Failed to save scenarios');
  });

  it('returns 200 with empty savedIds when scenarios array is empty', async () => {
    const res = await post('/models/save-scenarios', saveScenariosBody({ scenarios: [] }));

    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<{ savedIds: string[]; count: number }>;
    expect(body.success).toBe(true);
    expect(body.data?.savedIds).toHaveLength(0);
    expect(body.data?.count).toBe(0);
    expect(scenarioService.create).not.toHaveBeenCalled();
  });
});
