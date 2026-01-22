import { z } from 'zod';
import { ScenarioMetaSchema, ViewportSchema } from './meta.schema';
import { StepSchema } from './step.schema';

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  meta: ScenarioMetaSchema,
  steps: z.array(StepSchema).min(1),
  setup: z.array(StepSchema).optional(),
  teardown: z.array(StepSchema).optional(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

// Partial schema for input validation (auto-generates missing fields)
export const ScenarioInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  meta: z
    .object({
      recordedAt: z.string().datetime().optional(),
      url: z.string().url(),
      viewport: ViewportSchema,
      userAgent: z.string().optional(),
      locale: z
        .object({
          locale: z.string().optional(),
          timezone: z.string().optional(),
        })
        .optional(),
      extensionVersion: z.string().optional(),
      astSchemaVersion: z.string().optional(),
      lastExecution: z.unknown().optional(),
      tags: z.array(z.string()).optional(),
      priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      author: z.string().optional(),
      modifiedAt: z.string().datetime().optional(),
    })
    .passthrough(),
  steps: z.array(StepSchema).min(1),
  setup: z.array(StepSchema).optional(),
  teardown: z.array(StepSchema).optional(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const StepResultSchema = z.object({
  stepId: z.string(),
  index: z.number().int().nonnegative(),
  status: z.enum(['passed', 'failed', 'skipped']),
  duration: z.number().nonnegative(),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
  screenshotPath: z.string().optional(),
  snapshotPath: z.string().optional(),
  apiResponse: z
    .object({
      status: z.number().int(),
      headers: z.record(z.string()),
      body: z.unknown().optional(),
      responseTime: z.number().nonnegative(),
    })
    .optional(),
});

export const ExecutionSummarySchema = z.object({
  totalSteps: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  duration: z.number().nonnegative(),
  success: z.boolean(),
});

export const ScenarioResultSchema = ScenarioSchema.extend({
  stepResults: z.array(StepResultSchema),
  summary: ExecutionSummarySchema,
});
