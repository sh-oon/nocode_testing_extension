import { zValidator } from '@hono/zod-validator';
import type { Step } from '@like-cake/ast-types';
import { Hono } from 'hono';
import { z } from 'zod';
import { executionService } from '../services/execution.service';
import { scenarioService } from '../services/scenario.service';
import { userFlowService } from '../services/userflow.service';
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
 * Check which scenario IDs exist in the database
 * POST /api/scenarios/check-refs
 */
const checkRefsSchema = z.object({
  ids: z.array(z.string()).min(1),
});

scenarios.post('/check-refs', zValidator('json', checkRefsSchema), (c) => {
  const { ids } = c.req.valid('json');
  const results: Record<string, boolean> = {};

  for (const id of ids) {
    const scenario = scenarioService.getById(id);
    results[id] = scenario !== null;
  }

  return c.json<ApiResponse<{ results: Record<string, boolean> }>>({
    success: true,
    data: { results },
  });
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
 * If the scenario is referenced by user flows and ?force=true is not set,
 * returns 409 with the list of referencing flows.
 */
scenarios.delete('/:id', (c) => {
  const id = c.req.param('id');
  const force = c.req.query('force') === 'true';

  // Check if any user flows reference this scenario
  const referencingFlows = userFlowService.getFlowsReferencingScenario(id);

  if (referencingFlows.length > 0 && !force) {
    return c.json<ApiResponse<{ referencedBy: { id: string; name: string }[] }>>(
      {
        success: false,
        error: 'Scenario is referenced by user flows',
        data: { referencedBy: referencingFlows },
      },
      409
    );
  }

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

// Execution options schema
const executeOptionsSchema = z.object({
  headless: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
  baseUrl: z.string().url().optional(),
  viewport: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
});

/**
 * Execute a scenario via Puppeteer
 * POST /api/scenarios/:id/execute
 */
scenarios.post('/:id/execute', zValidator('json', executeOptionsSchema.optional()), async (c) => {
  const id = c.req.param('id');
  const options = c.req.valid('json') || {};

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

  try {
    const result = await executionService.execute(id, {
      headless: options.headless ?? true,
      defaultTimeout: options.timeout ?? 30000,
      baseUrl: options.baseUrl,
      viewport: options.viewport,
    });

    return c.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: `Execution failed: ${errorMessage}`,
      },
      500
    );
  }
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
