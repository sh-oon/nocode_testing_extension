import { describe, expect, it } from 'vitest';
import type { ElementBinding, AccessibilityInfo } from '../types/element-binding';
import type { TestModel } from '../types/model';
import { validateBindingAccessibility, getMaxImpact } from '../validators/accessibility';
import { validateTestModel, countIssues } from '../validators/model-validator';

// ── Fixtures ────────────────────────────────────────────────────────────

const makeA11yInfo = (overrides: Partial<AccessibilityInfo> = {}): AccessibilityInfo => ({
  focusable: true,
  keyboardAccessible: true,
  ariaAttributes: {},
  violations: [],
  ...overrides,
});

const makeBinding = (id: string, overrides: Partial<ElementBinding> = {}): ElementBinding => ({
  id,
  selector: `#${id}`,
  candidates: [],
  selectionMethod: 'manual',
  label: `element-${id}`,
  pageUrl: 'https://example.com',
  createdAt: Date.now(),
  ...overrides,
});

const makeMinimalModel = (overrides: Partial<TestModel> = {}): TestModel => ({
  id: 'test-model',
  name: 'Test Model',
  states: [
    { id: 's1', name: 'Start', verifications: [], isInitial: true },
    { id: 's2', name: 'End', verifications: [], isFinal: true },
  ],
  transitions: [
    {
      id: 't1',
      sourceStateId: 's1',
      targetStateId: 's2',
      event: { eventId: 'navigate', elementBindingId: null, params: { url: 'https://example.com' } },
    },
  ],
  elementBindings: [],
  baseUrl: 'https://example.com',
  meta: { createdAt: Date.now(), updatedAt: Date.now(), version: 1 },
  ...overrides,
});

// ── Accessibility Validation ────────────────────────────────────────────

describe('validateBindingAccessibility', () => {
  it('returns empty array when no accessibility info', () => {
    const binding = makeBinding('btn');
    expect(validateBindingAccessibility(binding, 'click')).toEqual([]);
  });

  it('detects missing-role on click target', () => {
    const binding = makeBinding('btn', {
      accessibility: makeA11yInfo({ role: undefined }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'missing-role')).toBe(true);
  });

  it('detects non-interactive role', () => {
    const binding = makeBinding('div', {
      accessibility: makeA11yInfo({ role: 'presentation', name: 'some' }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'non-interactive-role')).toBe(true);
  });

  it('accepts interactive role', () => {
    const binding = makeBinding('btn', {
      accessibility: makeA11yInfo({ role: 'button', name: 'Submit' }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'missing-role')).toBe(false);
    expect(warnings.some((w) => w.rule === 'non-interactive-role')).toBe(false);
  });

  it('detects missing accessible name', () => {
    const binding = makeBinding('btn', {
      accessibility: makeA11yInfo({ role: 'button', name: undefined }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'missing-name')).toBe(true);
  });

  it('detects not-focusable on click target', () => {
    const binding = makeBinding('btn', {
      accessibility: makeA11yInfo({ role: 'button', name: 'OK', focusable: false }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'not-focusable')).toBe(true);
  });

  it('detects not-keyboard-accessible', () => {
    const binding = makeBinding('btn', {
      accessibility: makeA11yInfo({ role: 'button', name: 'OK', keyboardAccessible: false }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'not-keyboard-accessible')).toBe(true);
  });

  it('detects low contrast', () => {
    const binding = makeBinding('txt', {
      accessibility: makeA11yInfo({ role: 'button', name: 'OK', contrastRatio: 2.1 }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'low-contrast')).toBe(true);
  });

  it('passes contrast at 4.5', () => {
    const binding = makeBinding('txt', {
      accessibility: makeA11yInfo({ role: 'button', name: 'OK', contrastRatio: 4.5 }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'low-contrast')).toBe(false);
  });

  it('detects missing-testid for string selector', () => {
    const binding = makeBinding('div', {
      selector: '.some-class',
      accessibility: makeA11yInfo({ role: 'button', name: 'OK' }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'missing-testid')).toBe(true);
  });

  it('no missing-testid warning for testId strategy', () => {
    const binding = makeBinding('btn', {
      selector: { strategy: 'testId', value: 'submit-btn' },
      accessibility: makeA11yInfo({ role: 'button', name: 'Submit' }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'missing-testid')).toBe(false);
  });

  it('includes pre-existing violations', () => {
    const binding = makeBinding('btn', {
      accessibility: makeA11yInfo({
        role: 'button',
        name: 'OK',
        violations: [{ rule: 'color-contrast', impact: 'serious', message: 'Contrast too low' }],
      }),
    });
    const warnings = validateBindingAccessibility(binding, 'click');
    expect(warnings.some((w) => w.rule === 'color-contrast')).toBe(true);
  });

  it('skips role checks for assert context', () => {
    const binding = makeBinding('div', {
      accessibility: makeA11yInfo({ role: undefined }),
    });
    const warnings = validateBindingAccessibility(binding, 'assert');
    expect(warnings.some((w) => w.rule === 'missing-role')).toBe(false);
  });
});

describe('getMaxImpact', () => {
  it('returns null for empty array', () => {
    expect(getMaxImpact([])).toBeNull();
  });

  it('returns critical when present', () => {
    const warnings = [
      { bindingId: 'a', bindingLabel: 'a', rule: 'r', impact: 'minor' as const, message: 'm' },
      { bindingId: 'b', bindingLabel: 'b', rule: 'r', impact: 'critical' as const, message: 'm' },
    ];
    expect(getMaxImpact(warnings)).toBe('critical');
  });
});

// ── Model Validation ────────────────────────────────────────────────────

describe('validateTestModel', () => {
  it('passes for valid minimal model', () => {
    const model = makeMinimalModel();
    const issues = validateTestModel(model);
    const { errors } = countIssues(issues);
    expect(errors).toBe(0);
  });

  it('detects no-initial-state', () => {
    const model = makeMinimalModel({
      states: [{ id: 's2', name: 'End', verifications: [], isFinal: true }],
    });
    const issues = validateTestModel(model);
    expect(issues.some((i) => i.code === 'no-initial-state')).toBe(true);
  });

  it('detects no-final-state', () => {
    const model = makeMinimalModel({
      states: [{ id: 's1', name: 'Start', verifications: [], isInitial: true }],
    });
    const issues = validateTestModel(model);
    expect(issues.some((i) => i.code === 'no-final-state')).toBe(true);
  });

  it('detects multiple-initial-states', () => {
    const model = makeMinimalModel({
      states: [
        { id: 's1', name: 'Start 1', verifications: [], isInitial: true },
        { id: 's2', name: 'Start 2', verifications: [], isInitial: true },
        { id: 's3', name: 'End', verifications: [], isFinal: true },
      ],
    });
    const issues = validateTestModel(model);
    expect(issues.some((i) => i.code === 'multiple-initial-states')).toBe(true);
  });

  it('detects missing-event on transition', () => {
    const model = makeMinimalModel({
      transitions: [{
        id: 't1',
        sourceStateId: 's1',
        targetStateId: 's2',
        event: { eventId: '', elementBindingId: null, params: {} },
      }],
    });
    const issues = validateTestModel(model);
    expect(issues.some((i) => i.code === 'missing-event')).toBe(true);
  });

  it('detects missing-required-binding for click event', () => {
    const model = makeMinimalModel({
      transitions: [{
        id: 't1',
        sourceStateId: 's1',
        targetStateId: 's2',
        event: { eventId: 'click', elementBindingId: null, params: {} },
      }],
    });
    const issues = validateTestModel(model);
    expect(issues.some((i) => i.code === 'missing-required-binding')).toBe(true);
  });

  it('detects missing-required-param for type event', () => {
    const binding = makeBinding('input');
    const model = makeMinimalModel({
      elementBindings: [binding],
      transitions: [{
        id: 't1',
        sourceStateId: 's1',
        targetStateId: 's2',
        event: { eventId: 'type', elementBindingId: 'input', params: {} },
      }],
    });
    const issues = validateTestModel(model);
    expect(issues.some((i) => i.code === 'missing-required-param')).toBe(true);
  });

  it('detects unreachable-state', () => {
    const model = makeMinimalModel({
      states: [
        { id: 's1', name: 'Start', verifications: [], isInitial: true },
        { id: 's2', name: 'End', verifications: [], isFinal: true },
        { id: 's3', name: 'Orphan', verifications: [] },
      ],
    });
    const issues = validateTestModel(model);
    expect(issues.some((i) => i.code === 'unreachable-state')).toBe(true);
  });

  it('detects orphan-binding', () => {
    const binding = makeBinding('unused');
    const model = makeMinimalModel({ elementBindings: [binding] });
    const issues = validateTestModel(model);
    expect(issues.some((i) => i.code === 'orphan-binding')).toBe(true);
  });

  it('detects accessibility warnings on transition bindings', () => {
    const binding = makeBinding('btn', {
      accessibility: makeA11yInfo({ role: undefined }),
    });
    const model = makeMinimalModel({
      elementBindings: [binding],
      transitions: [{
        id: 't1',
        sourceStateId: 's1',
        targetStateId: 's2',
        event: { eventId: 'click', elementBindingId: 'btn', params: {} },
      }],
    });
    const issues = validateTestModel(model);
    expect(issues.some((i) => i.code === 'a11y-missing-role')).toBe(true);
  });

  it('sorts errors before warnings', () => {
    const model = makeMinimalModel({
      states: [
        { id: 's1', name: 'Start', verifications: [], isInitial: true },
        // no final state → error
        { id: 's3', name: 'Orphan', verifications: [] }, // unreachable → warning
      ],
      transitions: [],
    });
    const issues = validateTestModel(model);
    const firstError = issues.findIndex((i) => i.type === 'error');
    const firstWarning = issues.findIndex((i) => i.type === 'warning');
    if (firstError !== -1 && firstWarning !== -1) {
      expect(firstError).toBeLessThan(firstWarning);
    }
  });
});

describe('countIssues', () => {
  it('counts errors and warnings separately', () => {
    const issues = validateTestModel(makeMinimalModel({
      states: [
        { id: 's1', name: 'Start', verifications: [], isInitial: true },
        // no final → error
      ],
      transitions: [],
    }));
    const { errors, warnings } = countIssues(issues);
    expect(errors).toBeGreaterThan(0);
    expect(typeof warnings).toBe('number');
  });
});
