/**
 * Model API routes
 *
 * POST /api/models/execute — Execute generated scenarios from a TestModel
 * POST /api/models/save-scenarios — Save generated scenarios to backend DB
 */

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { modelExecutionService } from '../services/model-execution.service';
import { scenarioService } from '../services/scenario.service';
import type { ApiResponse } from '../types';

const models = new Hono();

// ── Schemas ─────────────────────────────────────────────────────────────

const executeModelSchema = z.object({
  modelId: z.string(),
  modelName: z.string(),
  scenarios: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    meta: z.any(),
    steps: z.array(z.any()),
    variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  })),
  options: z.object({
    headless: z.boolean().optional(),
    timeout: z.number().int().positive().optional(),
    baseUrl: z.string().optional(),
    viewport: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }).optional(),
    continueOnFailure: z.boolean().optional(),
  }).optional(),
});

const saveScenariosSchema = z.object({
  modelName: z.string(),
  baseUrl: z.string(),
  scenarios: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    meta: z.any(),
    steps: z.array(z.any()),
    variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  })),
});

// ── Execute model ───────────────────────────────────────────────────────

/**
 * Execute all scenarios generated from a TestModel
 * POST /api/models/execute
 */
models.post('/execute', zValidator('json', executeModelSchema), async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await modelExecutionService.execute(
      body.modelId,
      body.modelName,
      body.scenarios as Parameters<typeof modelExecutionService.execute>[2],
      body.options,
    );

    return c.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json<ApiResponse<null>>(
      { success: false, error: `Model execution failed: ${errorMessage}` },
      500,
    );
  }
});

// ── Save scenarios to backend DB ────────────────────────────────────────

/**
 * Save generated scenarios to the backend database
 * so they appear in FlowBuilder's scenario sidebar
 * POST /api/models/save-scenarios
 */
models.post('/save-scenarios', zValidator('json', saveScenariosSchema), async (c) => {
  const body = c.req.valid('json');
  const savedIds: string[] = [];

  try {
    for (let i = 0; i < body.scenarios.length; i++) {
      const scenario = body.scenarios[i];
      const name = scenario.name || `[${body.modelName}] Scenario ${i + 1}`;

      const created = scenarioService.create({
        name,
        url: body.baseUrl,
        steps: scenario.steps,
        viewport: scenario.meta?.viewport || { width: 1440, height: 900 },
        variables: scenario.variables,
      });

      savedIds.push(created.id);
    }

    return c.json<ApiResponse<{ savedIds: string[]; count: number }>>({
      success: true,
      data: { savedIds, count: savedIds.length },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json<ApiResponse<null>>(
      { success: false, error: `Failed to save scenarios: ${errorMessage}` },
      500,
    );
  }
});

export { models };
