import { z } from 'zod';
import { SelectorInputSchema } from './selector.schema';

// Base step properties
const BaseStepSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  timeout: z.number().positive().optional(),
  optional: z.boolean().optional(),
});

// Modifier keys
const ModifiersSchema = z.array(z.enum(['Alt', 'Control', 'Meta', 'Shift'])).optional();

// Position
const PositionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
  })
  .optional();

// ============================================
// UI Action Steps
// ============================================

export const NavigateStepSchema = BaseStepSchema.extend({
  type: z.literal('navigate'),
  url: z.string().min(1),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).optional(),
});

export const ClickStepSchema = BaseStepSchema.extend({
  type: z.literal('click'),
  selector: SelectorInputSchema,
  button: z.enum(['left', 'right', 'middle']).optional(),
  clickCount: z.number().int().positive().optional(),
  modifiers: ModifiersSchema,
  position: PositionSchema,
});

export const TypeStepSchema = BaseStepSchema.extend({
  type: z.literal('type'),
  selector: SelectorInputSchema,
  value: z.string(),
  clear: z.boolean().optional(),
  delay: z.number().nonnegative().optional(),
  sensitive: z.boolean().optional(),
});

export const KeypressStepSchema = BaseStepSchema.extend({
  type: z.literal('keypress'),
  key: z.string().min(1),
  selector: SelectorInputSchema.optional(),
  modifiers: ModifiersSchema,
});

export const WaitStepSchema = BaseStepSchema.extend({
  type: z.literal('wait'),
  strategy: z.enum(['time', 'selector', 'navigation', 'networkIdle']),
  duration: z.number().nonnegative().optional(),
  selector: SelectorInputSchema.optional(),
  state: z.enum(['visible', 'hidden', 'attached', 'detached']).optional(),
});

export const HoverStepSchema = BaseStepSchema.extend({
  type: z.literal('hover'),
  selector: SelectorInputSchema,
  position: PositionSchema,
});

export const ScrollStepSchema = BaseStepSchema.extend({
  type: z.literal('scroll'),
  selector: SelectorInputSchema.optional(),
  position: z
    .object({
      x: z.number().optional(),
      y: z.number().optional(),
    })
    .optional(),
  behavior: z.enum(['auto', 'smooth']).optional(),
});

export const SelectStepSchema = BaseStepSchema.extend({
  type: z.literal('select'),
  selector: SelectorInputSchema,
  values: z.union([z.string(), z.array(z.string())]),
});

// ============================================
// Assertion Steps
// ============================================

export const HttpMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

export const ApiMatchSchema = z.object({
  url: z.string().min(1),
  method: HttpMethodSchema.optional(),
  urlIsRegex: z.boolean().optional(),
});

export const ApiExpectationSchema = z.object({
  status: z
    .union([
      z.number().int().positive(),
      z.object({ min: z.number().int(), max: z.number().int() }),
    ])
    .optional(),
  jsonPath: z.record(z.unknown()).optional(),
  headers: z.record(z.string()).optional(),
  responseTime: z.number().positive().optional(),
});

export const AssertApiStepSchema = BaseStepSchema.extend({
  type: z.literal('assertApi'),
  match: ApiMatchSchema,
  expect: ApiExpectationSchema.optional(),
  waitFor: z.boolean().optional(),
});

export const ElementAssertionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('visible') }),
  z.object({ type: z.literal('hidden') }),
  z.object({ type: z.literal('exists') }),
  z.object({ type: z.literal('notExists') }),
  z.object({
    type: z.literal('text'),
    value: z.string(),
    contains: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('attribute'),
    name: z.string(),
    value: z.string().optional(),
  }),
  z.object({
    type: z.literal('count'),
    value: z.number().int().nonnegative(),
    operator: z.enum(['eq', 'gt', 'gte', 'lt', 'lte']).optional(),
  }),
]);

export const AssertElementStepSchema = BaseStepSchema.extend({
  type: z.literal('assertElement'),
  selector: SelectorInputSchema,
  assertion: ElementAssertionSchema,
});

// ============================================
// Observation Steps
// ============================================

export const SnapshotDomStepSchema = BaseStepSchema.extend({
  type: z.literal('snapshotDom'),
  label: z.string().min(1),
  computedStyles: z.array(z.string()).optional(),
  fullPage: z.boolean().optional(),
  includeScreenshot: z.boolean().optional(),
});

// ============================================
// Discriminated Union
// ============================================

export const StepSchema = z.discriminatedUnion('type', [
  NavigateStepSchema,
  ClickStepSchema,
  TypeStepSchema,
  KeypressStepSchema,
  WaitStepSchema,
  HoverStepSchema,
  ScrollStepSchema,
  SelectStepSchema,
  AssertApiStepSchema,
  AssertElementStepSchema,
  SnapshotDomStepSchema,
]);
