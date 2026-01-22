import { z } from 'zod';

export const ViewportSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  deviceScaleFactor: z.number().positive().optional(),
  isMobile: z.boolean().optional(),
  hasTouch: z.boolean().optional(),
  isLandscape: z.boolean().optional(),
});

export const LocaleSettingsSchema = z.object({
  locale: z.string().optional(),
  timezone: z.string().optional(),
});

export const RecordingMetaSchema = z.object({
  recordedAt: z.string().datetime(),
  url: z.string().url(),
  viewport: ViewportSchema,
  userAgent: z.string().optional(),
  locale: LocaleSettingsSchema.optional(),
  extensionVersion: z.string().optional(),
  astSchemaVersion: z.string(),
});

export const ExecutionMetaSchema = z.object({
  executedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  duration: z.number().nonnegative().optional(),
  os: z.string().optional(),
  nodeVersion: z.string().optional(),
  puppeteerVersion: z.string().optional(),
  browserVersion: z.string().optional(),
  status: z.enum(['pending', 'running', 'passed', 'failed', 'skipped']).optional(),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
      stepId: z.string().optional(),
    })
    .optional(),
});

export const ScenarioMetaSchema = RecordingMetaSchema.extend({
  lastExecution: ExecutionMetaSchema.optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  author: z.string().optional(),
  modifiedAt: z.string().datetime().optional(),
});
