import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AST_SCHEMA_VERSION } from '../constants';
import type { ScenarioInput, Step } from '../types';
import {
  createScenario,
  isCompatibleVersion,
  normalizeStepIds,
  parseScenarioInput,
  validateScenario,
  validateStep,
} from '../utils';

describe('validateScenario', () => {
  const validScenario = {
    id: 'scenario-001',
    meta: {
      recordedAt: '2026-01-01T10:00:00Z',
      url: 'https://example.com',
      viewport: { width: 1440, height: 900 },
      astSchemaVersion: '1.0.0',
    },
    steps: [{ type: 'navigate', url: '/home' }],
  };

  it('should return success for valid scenario', () => {
    const result = validateScenario(validScenario);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('scenario-001');
    }
  });

  it('should return errors for invalid scenario', () => {
    const result = validateScenario({
      id: 'test',
      meta: {},
      steps: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('should return error path for nested errors', () => {
    const result = validateScenario({
      ...validScenario,
      steps: [{ type: 'click' }], // missing selector
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.path.includes('steps'))).toBe(true);
    }
  });
});

describe('parseScenarioInput', () => {
  it('should parse valid input', () => {
    const input = {
      meta: {
        url: 'https://example.com',
        viewport: { width: 1920, height: 1080 },
      },
      steps: [{ type: 'navigate', url: '/dashboard' }],
    };
    const result = parseScenarioInput(input);
    expect(result.success).toBe(true);
  });

  it('should reject invalid input', () => {
    const result = parseScenarioInput({
      meta: { url: 'not-a-url' },
      steps: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('validateStep', () => {
  it('should validate a valid step', () => {
    const result = validateStep({
      type: 'click',
      selector: '[data-testid="button"]',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid step', () => {
    const result = validateStep({
      type: 'invalidType',
    });
    expect(result.success).toBe(false);
  });
});

describe('isCompatibleVersion', () => {
  it('should return true for same major version', () => {
    const [major] = AST_SCHEMA_VERSION.split('.');
    expect(isCompatibleVersion(`${major}.0.0`)).toBe(true);
    expect(isCompatibleVersion(`${major}.1.0`)).toBe(true);
    expect(isCompatibleVersion(`${major}.99.99`)).toBe(true);
  });

  it('should return false for different major version', () => {
    const [major] = AST_SCHEMA_VERSION.split('.');
    const differentMajor = Number(major) + 1;
    expect(isCompatibleVersion(`${differentMajor}.0.0`)).toBe(false);
  });
});

describe('createScenario', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });

  it('should create a complete scenario from input', () => {
    const input: ScenarioInput = {
      meta: {
        url: 'https://example.com',
        viewport: { width: 1440, height: 900 },
      },
      steps: [
        { type: 'navigate', url: '/home' },
        { type: 'click', selector: 'button' },
      ],
    };

    const scenario = createScenario(input);

    expect(scenario.id).toMatch(/^scenario-/);
    expect(scenario.meta.recordedAt).toBe('2026-01-01T12:00:00.000Z');
    expect(scenario.meta.astSchemaVersion).toBe(AST_SCHEMA_VERSION);
    expect(scenario.meta.url).toBe('https://example.com');
    expect(scenario.steps[0].id).toBe('step-1');
    expect(scenario.steps[1].id).toBe('step-2');
  });

  it('should preserve provided id', () => {
    const input: ScenarioInput = {
      id: 'custom-id',
      meta: {
        url: 'https://example.com',
        viewport: { width: 1440, height: 900 },
      },
      steps: [{ type: 'navigate', url: '/home' }],
    };

    const scenario = createScenario(input);
    expect(scenario.id).toBe('custom-id');
  });

  it('should preserve provided step ids', () => {
    const input: ScenarioInput = {
      meta: {
        url: 'https://example.com',
        viewport: { width: 1440, height: 900 },
      },
      steps: [
        { id: 'custom-step-1', type: 'navigate', url: '/home' },
        { type: 'click', selector: 'button' },
      ],
    };

    const scenario = createScenario(input);
    expect(scenario.steps[0].id).toBe('custom-step-1');
    expect(scenario.steps[1].id).toBe('step-2');
  });

  it('should include optional fields when provided', () => {
    const input: ScenarioInput = {
      name: 'Login Test',
      description: 'Tests the login flow',
      meta: {
        url: 'https://example.com',
        viewport: { width: 1440, height: 900 },
        tags: ['auth', 'smoke'],
        priority: 'high',
        author: 'tester',
      },
      steps: [{ type: 'navigate', url: '/login' }],
      variables: { username: 'testuser' },
    };

    const scenario = createScenario(input);
    expect(scenario.name).toBe('Login Test');
    expect(scenario.description).toBe('Tests the login flow');
    expect(scenario.meta.tags).toEqual(['auth', 'smoke']);
    expect(scenario.meta.priority).toBe('high');
    expect(scenario.meta.author).toBe('tester');
    expect(scenario.variables).toEqual({ username: 'testuser' });
  });
});

describe('normalizeStepIds', () => {
  it('should add ids to steps without them', () => {
    const steps: Step[] = [
      { type: 'navigate', url: '/home' },
      { type: 'click', selector: 'button' },
    ];

    const normalized = normalizeStepIds(steps);
    expect(normalized[0].id).toBe('step-1');
    expect(normalized[1].id).toBe('step-2');
  });

  it('should preserve existing ids', () => {
    const steps: Step[] = [
      { id: 'existing-id', type: 'navigate', url: '/home' },
      { type: 'click', selector: 'button' },
    ];

    const normalized = normalizeStepIds(steps);
    expect(normalized[0].id).toBe('existing-id');
    expect(normalized[1].id).toBe('step-2');
  });

  it('should not mutate original array', () => {
    const steps: Step[] = [{ type: 'navigate', url: '/home' }];
    const normalized = normalizeStepIds(steps);

    expect(steps[0].id).toBeUndefined();
    expect(normalized[0].id).toBe('step-1');
  });
});
