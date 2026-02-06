/**
 * Test suite for pattern presets
 */

import { describe, it, expect } from 'vitest';
import {
  PATTERN_PRESETS,
  getPresetsByCategory,
  getPresetById,
  createConditionFromPreset,
  resolvePresetFromCondition,
  type PatternPreset,
} from '../patterns';
import type { Condition } from '../types';

describe('PATTERN_PRESETS', () => {
  it('should have correct number of comparison presets', () => {
    const comparisonPresets = PATTERN_PRESETS.filter((p) => p.category === 'comparison');
    expect(comparisonPresets).toHaveLength(6);
    expect(comparisonPresets.map((p) => p.id)).toEqual(['eq', 'ne', 'gt', 'gte', 'lt', 'lte']);
  });

  it('should have correct number of string presets', () => {
    const stringPresets = PATTERN_PRESETS.filter((p) => p.category === 'string');
    expect(stringPresets).toHaveLength(5);
    expect(stringPresets.map((p) => p.id)).toEqual([
      'contains',
      'startsWith',
      'endsWith',
      'isEmpty',
      'exists',
    ]);
  });

  it('should have correct number of validation presets', () => {
    const validationPresets = PATTERN_PRESETS.filter((p) => p.category === 'validation');
    expect(validationPresets).toHaveLength(5);
    expect(validationPresets.map((p) => p.id)).toEqual([
      'isEmail',
      'isUrl',
      'isUuid',
      'isPhone',
      'customRegex',
    ]);
  });

  it('should have correct total number of presets', () => {
    expect(PATTERN_PRESETS).toHaveLength(16);
  });

  it('should have valid structure for each preset', () => {
    for (const preset of PATTERN_PRESETS) {
      expect(preset).toHaveProperty('id');
      expect(preset).toHaveProperty('label');
      expect(preset).toHaveProperty('description');
      expect(preset).toHaveProperty('category');
      expect(preset).toHaveProperty('operator');
      expect(typeof preset.id).toBe('string');
      expect(typeof preset.label).toBe('string');
      expect(typeof preset.description).toBe('string');
      expect(['comparison', 'string', 'validation']).toContain(preset.category);
    }
  });

  it('should have unique preset IDs', () => {
    const ids = PATTERN_PRESETS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should mark isEmpty and exists as unary operators', () => {
    const isEmpty = PATTERN_PRESETS.find((p) => p.id === 'isEmpty');
    const exists = PATTERN_PRESETS.find((p) => p.id === 'exists');
    expect(isEmpty?.unary).toBe(true);
    expect(exists?.unary).toBe(true);
  });

  it('should have regex patterns for validation presets except customRegex', () => {
    const validationPresets = PATTERN_PRESETS.filter(
      (p) => p.category === 'validation' && p.id !== 'customRegex',
    );
    for (const preset of validationPresets) {
      expect(preset.regex).toBeDefined();
      expect(typeof preset.regex).toBe('string');
      expect(preset.regex!.length).toBeGreaterThan(0);
    }
  });

  it('should not have regex for customRegex preset', () => {
    const customRegex = PATTERN_PRESETS.find((p) => p.id === 'customRegex');
    expect(customRegex?.regex).toBeUndefined();
  });
});

describe('getPresetsByCategory', () => {
  it('should filter comparison presets correctly', () => {
    const presets = getPresetsByCategory('comparison');
    expect(presets).toHaveLength(6);
    expect(presets.every((p) => p.category === 'comparison')).toBe(true);
  });

  it('should filter string presets correctly', () => {
    const presets = getPresetsByCategory('string');
    expect(presets).toHaveLength(5);
    expect(presets.every((p) => p.category === 'string')).toBe(true);
  });

  it('should filter validation presets correctly', () => {
    const presets = getPresetsByCategory('validation');
    expect(presets).toHaveLength(5);
    expect(presets.every((p) => p.category === 'validation')).toBe(true);
  });

  it('should return empty array for non-existent category', () => {
    const presets = getPresetsByCategory('nonexistent' as PatternPreset['category']);
    expect(presets).toHaveLength(0);
  });
});

describe('getPresetById', () => {
  it('should find existing presets by ID', () => {
    const eq = getPresetById('eq');
    expect(eq).toBeDefined();
    expect(eq?.id).toBe('eq');
    expect(eq?.operator).toBe('eq');

    const isEmail = getPresetById('isEmail');
    expect(isEmail).toBeDefined();
    expect(isEmail?.id).toBe('isEmail');
    expect(isEmail?.operator).toBe('matches');
    expect(isEmail?.regex).toBeDefined();
  });

  it('should return undefined for unknown preset ID', () => {
    const unknown = getPresetById('unknownPreset');
    expect(unknown).toBeUndefined();
  });

  it('should find all preset IDs', () => {
    for (const preset of PATTERN_PRESETS) {
      const found = getPresetById(preset.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(preset.id);
    }
  });
});

describe('createConditionFromPreset', () => {
  it('should create condition with basic operator', () => {
    const preset = getPresetById('eq')!;
    const condition = createConditionFromPreset(preset, '{{userId}}', '123');

    expect(condition).toEqual({
      left: '{{userId}}',
      operator: 'eq',
      right: '123',
    });
  });

  it('should create condition with regex from preset', () => {
    const preset = getPresetById('isEmail')!;
    const condition = createConditionFromPreset(preset, '{{email}}');

    expect(condition).toEqual({
      left: '{{email}}',
      operator: 'matches',
      right: preset.regex,
    });
  });

  it('should prioritize preset regex over provided right value', () => {
    const preset = getPresetById('isUrl')!;
    const condition = createConditionFromPreset(preset, '{{url}}', 'ignoredValue');

    expect(condition).toEqual({
      left: '{{url}}',
      operator: 'matches',
      right: preset.regex,
    });
  });

  it('should use provided right value when preset has no regex', () => {
    const preset = getPresetById('contains')!;
    const condition = createConditionFromPreset(preset, '{{text}}', 'hello');

    expect(condition).toEqual({
      left: '{{text}}',
      operator: 'contains',
      right: 'hello',
    });
  });

  it('should handle unary operators', () => {
    const preset = getPresetById('isEmpty')!;
    const condition = createConditionFromPreset(preset, '{{value}}');

    expect(condition).toEqual({
      left: '{{value}}',
      operator: 'isEmpty',
      right: undefined,
    });
  });

  it('should create condition for customRegex with provided pattern', () => {
    const preset = getPresetById('customRegex')!;
    const condition = createConditionFromPreset(preset, '{{data}}', '^[0-9]{3}$');

    expect(condition).toEqual({
      left: '{{data}}',
      operator: 'matches',
      right: '^[0-9]{3}$',
    });
  });
});

describe('resolvePresetFromCondition', () => {
  it('should resolve simple comparison operators', () => {
    const conditions: Condition[] = [
      { left: '{{a}}', operator: 'eq', right: '5' },
      { left: '{{a}}', operator: 'ne', right: '5' },
      { left: '{{a}}', operator: 'gt', right: '5' },
      { left: '{{a}}', operator: 'gte', right: '5' },
      { left: '{{a}}', operator: 'lt', right: '5' },
      { left: '{{a}}', operator: 'lte', right: '5' },
    ];

    for (const condition of conditions) {
      const presetId = resolvePresetFromCondition(condition);
      expect(presetId).toBe(condition.operator);
    }
  });

  it('should resolve string operators', () => {
    const conditions: Condition[] = [
      { left: '{{text}}', operator: 'contains', right: 'hello' },
      { left: '{{text}}', operator: 'startsWith', right: 'hello' },
      { left: '{{text}}', operator: 'endsWith', right: 'world' },
    ];

    for (const condition of conditions) {
      const presetId = resolvePresetFromCondition(condition);
      expect(presetId).toBe(condition.operator);
    }
  });

  it('should resolve unary operators', () => {
    const conditions: Condition[] = [
      { left: '{{value}}', operator: 'isEmpty' },
      { left: '{{value}}', operator: 'exists' },
    ];

    for (const condition of conditions) {
      const presetId = resolvePresetFromCondition(condition);
      expect(presetId).toBe(condition.operator);
    }
  });

  it('should resolve validation presets by matching regex', () => {
    const isEmailPreset = getPresetById('isEmail')!;
    const condition: Condition = {
      left: '{{email}}',
      operator: 'matches',
      right: isEmailPreset.regex,
    };

    const presetId = resolvePresetFromCondition(condition);
    expect(presetId).toBe('isEmail');
  });

  it('should resolve isUrl by matching regex', () => {
    const isUrlPreset = getPresetById('isUrl')!;
    const condition: Condition = {
      left: '{{url}}',
      operator: 'matches',
      right: isUrlPreset.regex,
    };

    const presetId = resolvePresetFromCondition(condition);
    expect(presetId).toBe('isUrl');
  });

  it('should resolve isUuid by matching regex', () => {
    const isUuidPreset = getPresetById('isUuid')!;
    const condition: Condition = {
      left: '{{id}}',
      operator: 'matches',
      right: isUuidPreset.regex,
    };

    const presetId = resolvePresetFromCondition(condition);
    expect(presetId).toBe('isUuid');
  });

  it('should resolve isPhone by matching regex', () => {
    const isPhonePreset = getPresetById('isPhone')!;
    const condition: Condition = {
      left: '{{phone}}',
      operator: 'matches',
      right: isPhonePreset.regex,
    };

    const presetId = resolvePresetFromCondition(condition);
    expect(presetId).toBe('isPhone');
  });

  it('should resolve custom regex pattern to customRegex', () => {
    const condition: Condition = {
      left: '{{code}}',
      operator: 'matches',
      right: '^[A-Z]{3}[0-9]{3}$',
    };

    const presetId = resolvePresetFromCondition(condition);
    expect(presetId).toBe('customRegex');
  });

  it('should default to eq for unknown operators', () => {
    const condition: Condition = {
      left: '{{value}}',
      operator: 'unknownOperator' as any,
      right: 'test',
    };

    const presetId = resolvePresetFromCondition(condition);
    expect(presetId).toBe('eq');
  });

  it('should default to customRegex when matches has no right value', () => {
    const condition: Condition = {
      left: '{{value}}',
      operator: 'matches',
      right: '',
    };

    const presetId = resolvePresetFromCondition(condition);
    // Empty string is truthy enough to enter the matches block, but won't match any preset regex
    expect(presetId).toBe('customRegex');
  });
});
