import { zValidator } from '@hono/zod-validator';
import type { Step } from '@like-cake/ast-types';
import { Hono } from 'hono';
import { z } from 'zod';
import { scenarioService } from '../services/scenario.service';
import type { ApiResponse } from '../types';

const scenarios = new Hono();

// Use z.any() for steps to avoid complex type validation
// The actual Step types from ast-types are validated at runtime in the service layer
const createScenarioSchema = z.object({
  sessionId: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  url: z.string(),
  viewport: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
  steps: z.array(z.any()),
  setup: z.array(z.any()).optional(),
  teardown: z.array(z.any()).optional(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  tags: z.array(z.string()).optional(),
});

const updateScenarioSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  steps: z.array(z.any()).optional(),
  setup: z.array(z.any()).optional(),
  teardown: z.array(z.any()).optional(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  tags: z.array(z.any()).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const createFromSessionSchema = z.object({
  sessionId: z.string(),
  name: z.string().optional(),
});

/**
 * List all scenarios
 */
scenarios.get('/', zValidator('query', paginationSchema), (c) => {
  const { page, limit } = c.req.valid('query');
  const result = scenarioService.list({ page, limit });

  return c.json<ApiResponse<typeof result>>({
    success: true,
    data: result,
    meta: {
      total: result.total,
      page: result.page,
      limit: result.limit,
    },
  });
});

/**
 * Create a new scenario
 */
scenarios.post('/', zValidator('json', createScenarioSchema), (c) => {
  const input = c.req.valid('json');
  const scenario = scenarioService.create({
    ...input,
    steps: input.steps as Step[],
    setup: input.setup as Step[] | undefined,
    teardown: input.teardown as Step[] | undefined,
  });

  return c.json<ApiResponse<typeof scenario>>(
    {
      success: true,
      data: scenario,
    },
    201
  );
});

/**
 * Create scenario from a recording session
 */
scenarios.post('/from-session', zValidator('json', createFromSessionSchema), (c) => {
  const { sessionId, name } = c.req.valid('json');
  const scenario = scenarioService.createFromSession(sessionId, name);

  if (!scenario) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Session not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof scenario>>(
    {
      success: true,
      data: scenario,
    },
    201
  );
});

/**
 * Get scenario by ID
 */
scenarios.get('/:id', (c) => {
  const id = c.req.param('id');
  const scenario = scenarioService.getById(id);

  if (!scenario) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Scenario not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof scenario>>({
    success: true,
    data: scenario,
  });
});

/**
 * Update scenario
 */
scenarios.patch('/:id', zValidator('json', updateScenarioSchema), (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const scenario = scenarioService.update(id, {
    ...input,
    steps: input.steps as Step[] | undefined,
    setup: input.setup as Step[] | undefined,
    teardown: input.teardown as Step[] | undefined,
    tags: input.tags as string[] | undefined,
  });

  if (!scenario) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Scenario not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof scenario>>({
    success: true,
    data: scenario,
  });
});

/**
 * Delete scenario
 */
scenarios.delete('/:id', (c) => {
  const id = c.req.param('id');
  const deleted = scenarioService.delete(id);

  if (!deleted) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Scenario not found',
      },
      404
    );
  }

  return c.json<ApiResponse<{ deleted: boolean }>>({
    success: true,
    data: { deleted: true },
  });
});

/**
 * Export scenario as JSON
 */
scenarios.get('/:id/export', (c) => {
  const id = c.req.param('id');
  const exported = scenarioService.export(id);

  if (!exported) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Scenario not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof exported>>({
    success: true,
    data: exported,
  });
});

/**
 * Import scenario from JSON
 */
scenarios.post('/import', async (c) => {
  const data = await c.req.json();
  const scenario = scenarioService.import(data);

  return c.json<ApiResponse<typeof scenario>>(
    {
      success: true,
      data: scenario,
    },
    201
  );
});

/**
 * Get execution results for a scenario
 */
scenarios.get('/:id/results', zValidator('query', paginationSchema), (c) => {
  const id = c.req.param('id');
  const { page, limit } = c.req.valid('query');

  const scenario = scenarioService.getById(id);
  if (!scenario) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Scenario not found',
      },
      404
    );
  }

  const results = scenarioService.getExecutionResults(id, { page, limit });

  return c.json<ApiResponse<typeof results>>({
    success: true,
    data: results,
    meta: {
      total: results.total,
      page: results.page,
      limit: results.limit,
    },
  });
});

/**
 * Add execution result
 */
scenarios.post('/:id/results', async (c) => {
  const id = c.req.param('id');

  const scenario = scenarioService.getById(id);
  if (!scenario) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Scenario not found',
      },
      404
    );
  }

  const data = await c.req.json();
  const result = scenarioService.addExecutionResult(id, {
    status: data.status,
    totalSteps: data.totalSteps,
    passed: data.passed,
    failed: data.failed,
    skipped: data.skipped,
    duration: data.duration,
    stepResults: data.stepResults,
    environment: data.environment,
    executedAt: data.executedAt || Date.now(),
  });

  return c.json<ApiResponse<typeof result>>(
    {
      success: true,
      data: result,
    },
    201
  );
});

export { scenarios };
