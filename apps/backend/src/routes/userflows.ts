import { zValidator } from '@hono/zod-validator';
import type { FlowEdge, FlowNode } from '@like-cake/ast-types';
import { Hono } from 'hono';
import { z } from 'zod';
import { userFlowService } from '../services/userflow.service';
import type { ApiResponse } from '../types';

const userflows = new Hono();

// Flow node schema
const flowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['scenario', 'start', 'end', 'condition', 'setVariable', 'extractVariable']),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.any(), // Validated at runtime based on type
});

// Flow edge schema
const flowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  type: z.string().optional(),
  animated: z.boolean().optional(),
});

const createUserFlowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const updateUserFlowSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  nodes: z.array(flowNodeSchema).optional(),
  edges: z.array(flowEdgeSchema).optional(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  sort: z.enum(['name', 'updatedAt', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const duplicateUserFlowSchema = z.object({
  name: z.string().optional(),
});

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
 * List all user flows with optional search, sort, and order
 */
userflows.get('/', zValidator('query', paginationSchema), (c) => {
  const { page, limit, search, sort, order } = c.req.valid('query');
  const result = userFlowService.list({ page, limit, search, sort, order });

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
 * Create a new user flow
 */
userflows.post('/', zValidator('json', createUserFlowSchema), (c) => {
  const input = c.req.valid('json');
  // Cast nodes to FlowNode[] since Zod doesn't validate discriminated unions well
  const flow = userFlowService.create({
    ...input,
    nodes: input.nodes as FlowNode[],
    edges: input.edges as FlowEdge[],
  });

  return c.json<ApiResponse<typeof flow>>(
    {
      success: true,
      data: flow,
    },
    201
  );
});

/**
 * Get user flow by ID
 */
userflows.get('/:id', (c) => {
  const id = c.req.param('id');
  const flow = userFlowService.getById(id);

  if (!flow) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'User flow not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof flow>>({
    success: true,
    data: flow,
  });
});

/**
 * Update user flow
 */
userflows.patch('/:id', zValidator('json', updateUserFlowSchema), (c) => {
  const id = c.req.param('id');
  const input = c.req.valid('json');
  const flow = userFlowService.update(id, {
    ...input,
    nodes: input.nodes as FlowNode[] | undefined,
    edges: input.edges as FlowEdge[] | undefined,
  });

  if (!flow) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'User flow not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof flow>>({
    success: true,
    data: flow,
  });
});

/**
 * Duplicate a user flow
 * POST /api/userflows/:id/duplicate
 */
userflows.post('/:id/duplicate', zValidator('json', duplicateUserFlowSchema.optional()), (c) => {
  const id = c.req.param('id');
  const body = c.req.valid('json');
  const name = body?.name;

  const duplicated = userFlowService.duplicate(id, name);

  if (!duplicated) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'User flow not found',
      },
      404
    );
  }

  return c.json<ApiResponse<typeof duplicated>>(
    {
      success: true,
      data: duplicated,
    },
    201
  );
});

/**
 * Delete user flow
 */
userflows.delete('/:id', (c) => {
  const id = c.req.param('id');
  const deleted = userFlowService.delete(id);

  if (!deleted) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'User flow not found',
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
 * Execute a user flow
 * POST /api/userflows/:id/execute
 */
userflows.post('/:id/execute', zValidator('json', executeOptionsSchema.optional()), async (c) => {
  const id = c.req.param('id');
  const options = c.req.valid('json') || {};

  const flow = userFlowService.getById(id);
  if (!flow) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'User flow not found',
      },
      404
    );
  }

  try {
    const result = await userFlowService.execute(id, {
      headless: options.headless ?? true,
      defaultTimeout: options.timeout ?? 30000,
      baseUrl: options.baseUrl,
      viewport: options.viewport,
    });

    if (!result) {
      return c.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Flow execution returned no result',
        },
        500
      );
    }

    // Transform to match frontend expected format with nested summary
    const responseData = {
      flowId: result.flowId,
      status: result.status,
      nodeResults: result.nodeResults,
      summary: {
        totalNodes: result.totalNodes,
        passedNodes: result.passedNodes,
        failedNodes: result.failedNodes,
        skippedNodes: result.skippedNodes,
        totalSteps: result.totalSteps,
        passedSteps: result.passedSteps,
        failedSteps: result.failedSteps,
        skippedSteps: result.skippedSteps,
        duration: result.duration,
      },
      startedAt: result.startedAt,
      endedAt: result.endedAt,
    };

    return c.json<ApiResponse<typeof responseData>>({
      success: true,
      data: responseData,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: `Flow execution failed: ${errorMessage}`,
      },
      500
    );
  }
});

/**
 * Get flattened execution order (scenario IDs)
 * GET /api/userflows/:id/flatten
 */
userflows.get('/:id/flatten', (c) => {
  const id = c.req.param('id');
  const flow = userFlowService.getById(id);

  if (!flow) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'User flow not found',
      },
      404
    );
  }

  const scenarioIds = userFlowService.flatten(flow);

  return c.json<ApiResponse<{ scenarioIds: string[] }>>({
    success: true,
    data: { scenarioIds },
  });
});

/**
 * Get execution results for a user flow
 */
userflows.get('/:id/results', zValidator('query', paginationSchema), (c) => {
  const id = c.req.param('id');
  const { page, limit } = c.req.valid('query');

  const flow = userFlowService.getById(id);
  if (!flow) {
    return c.json<ApiResponse<null>>(
      {
        success: false,
        error: 'User flow not found',
      },
      404
    );
  }

  const results = userFlowService.getExecutionResults(id, { page, limit });

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

export { userflows };
