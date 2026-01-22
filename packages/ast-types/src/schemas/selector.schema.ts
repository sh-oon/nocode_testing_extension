import { z } from 'zod';

export const SelectorStrategySchema = z.enum(['testId', 'role', 'css', 'xpath']);

export const TestIdSelectorSchema = z.object({
  strategy: z.literal('testId'),
  value: z.string().min(1),
});

export const RoleSelectorSchema = z.object({
  strategy: z.literal('role'),
  value: z.string().min(1),
  role: z.string().min(1),
  name: z.string().optional(),
});

export const CssSelectorSchema = z.object({
  strategy: z.literal('css'),
  value: z.string().min(1),
});

export const XPathSelectorSchema = z.object({
  strategy: z.literal('xpath'),
  value: z.string().min(1),
});

export const SelectorSchema = z.discriminatedUnion('strategy', [
  TestIdSelectorSchema,
  RoleSelectorSchema,
  CssSelectorSchema,
  XPathSelectorSchema,
]);

// Allow string or Selector object for flexibility
export const SelectorInputSchema = z.union([z.string().min(1), SelectorSchema]);
