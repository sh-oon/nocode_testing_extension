import { describe, expect, it } from 'vitest';
import {
  AssertApiStepSchema,
  AssertElementStepSchema,
  ClickStepSchema,
  NavigateStepSchema,
  ScenarioSchema,
  SelectorInputSchema,
  SnapshotDomStepSchema,
  StepSchema,
  TypeStepSchema,
} from '../schemas';

describe('SelectorInputSchema', () => {
  it('should accept a string selector', () => {
    const result = SelectorInputSchema.safeParse('[data-testid="email"]');
    expect(result.success).toBe(true);
  });

  it('should accept a testId selector object', () => {
    const result = SelectorInputSchema.safeParse({
      strategy: 'testId',
      value: 'email',
    });
    expect(result.success).toBe(true);
  });

  it('should accept a role selector object', () => {
    const result = SelectorInputSchema.safeParse({
      strategy: 'role',
      value: 'button',
      role: 'button',
      name: 'Submit',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty string', () => {
    const result = SelectorInputSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('should reject invalid strategy', () => {
    const result = SelectorInputSchema.safeParse({
      strategy: 'invalid',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });
});

describe('StepSchema - UI Actions', () => {
  it('should validate navigate step', () => {
    const result = NavigateStepSchema.safeParse({
      type: 'navigate',
      url: '/login',
    });
    expect(result.success).toBe(true);
  });

  it('should validate navigate step with waitUntil', () => {
    const result = NavigateStepSchema.safeParse({
      type: 'navigate',
      url: '/dashboard',
      waitUntil: 'networkidle0',
    });
    expect(result.success).toBe(true);
  });

  it('should validate click step', () => {
    const result = ClickStepSchema.safeParse({
      type: 'click',
      selector: '[data-testid="submit"]',
    });
    expect(result.success).toBe(true);
  });

  it('should validate click step with all options', () => {
    const result = ClickStepSchema.safeParse({
      type: 'click',
      selector: '[data-testid="menu"]',
      button: 'right',
      clickCount: 2,
      modifiers: ['Control', 'Shift'],
      position: { x: 10, y: 20 },
    });
    expect(result.success).toBe(true);
  });

  it('should validate type step', () => {
    const result = TypeStepSchema.safeParse({
      type: 'type',
      selector: '[data-testid="email"]',
      value: 'user@test.com',
    });
    expect(result.success).toBe(true);
  });

  it('should validate type step with sensitive flag', () => {
    const result = TypeStepSchema.safeParse({
      type: 'type',
      selector: '[data-testid="password"]',
      value: 'secret123',
      sensitive: true,
      clear: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('StepSchema - Assertions', () => {
  it('should validate assertApi step', () => {
    const result = AssertApiStepSchema.safeParse({
      type: 'assertApi',
      match: {
        url: '/api/login',
        method: 'POST',
      },
    });
    expect(result.success).toBe(true);
  });

  it('should validate assertApi step with expectations', () => {
    const result = AssertApiStepSchema.safeParse({
      type: 'assertApi',
      match: {
        url: '/api/orders',
        method: 'GET',
      },
      expect: {
        status: 200,
        jsonPath: {
          '$.status': 'SUCCESS',
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should validate assertElement step with visible assertion', () => {
    const result = AssertElementStepSchema.safeParse({
      type: 'assertElement',
      selector: '[data-testid="welcome"]',
      assertion: { type: 'visible' },
    });
    expect(result.success).toBe(true);
  });

  it('should validate assertElement step with text assertion', () => {
    const result = AssertElementStepSchema.safeParse({
      type: 'assertElement',
      selector: '.error-message',
      assertion: {
        type: 'text',
        value: 'Invalid credentials',
        contains: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it('should validate assertElement step with count assertion', () => {
    const result = AssertElementStepSchema.safeParse({
      type: 'assertElement',
      selector: '.list-item',
      assertion: {
        type: 'count',
        value: 5,
        operator: 'gte',
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('StepSchema - Observations', () => {
  it('should validate snapshotDom step', () => {
    const result = SnapshotDomStepSchema.safeParse({
      type: 'snapshotDom',
      label: 'after-login',
    });
    expect(result.success).toBe(true);
  });

  it('should validate snapshotDom step with all options', () => {
    const result = SnapshotDomStepSchema.safeParse({
      type: 'snapshotDom',
      label: 'homepage',
      computedStyles: ['display', 'visibility'],
      fullPage: true,
      includeScreenshot: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('StepSchema - Discriminated Union', () => {
  it('should correctly discriminate step types', () => {
    const navigateStep = StepSchema.safeParse({
      type: 'navigate',
      url: '/home',
    });
    expect(navigateStep.success).toBe(true);

    const clickStep = StepSchema.safeParse({
      type: 'click',
      selector: 'button',
    });
    expect(clickStep.success).toBe(true);

    const invalidStep = StepSchema.safeParse({
      type: 'invalidType',
    });
    expect(invalidStep.success).toBe(false);
  });
});

describe('ScenarioSchema', () => {
  const validScenario = {
    id: 'scenario-001',
    name: 'Login Flow',
    meta: {
      recordedAt: '2026-01-01T10:00:00Z',
      url: 'https://example.com',
      viewport: { width: 1440, height: 900 },
      astSchemaVersion: '1.0.0',
    },
    steps: [
      { type: 'navigate', url: '/login' },
      { type: 'type', selector: '[data-testid=email]', value: 'user@test.com' },
      { type: 'click', selector: '[data-testid=submit]' },
    ],
  };

  it('should validate a complete scenario', () => {
    const result = ScenarioSchema.safeParse(validScenario);
    expect(result.success).toBe(true);
  });

  it('should reject scenario without required fields', () => {
    const result = ScenarioSchema.safeParse({
      id: 'test',
      meta: {
        url: 'https://example.com',
        viewport: { width: 1440, height: 900 },
      },
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject scenario with empty steps', () => {
    const result = ScenarioSchema.safeParse({
      ...validScenario,
      steps: [],
    });
    expect(result.success).toBe(false);
  });

  it('should accept scenario with variables', () => {
    const result = ScenarioSchema.safeParse({
      ...validScenario,
      variables: {
        baseUrl: 'https://example.com',
        timeout: 5000,
        debug: true,
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept scenario with setup and teardown', () => {
    const result = ScenarioSchema.safeParse({
      ...validScenario,
      setup: [{ type: 'navigate', url: '/setup' }],
      teardown: [{ type: 'navigate', url: '/logout' }],
    });
    expect(result.success).toBe(true);
  });
});
