/**
 * Reverse converter tests — roundtrip verification
 *
 * For each catalog entry, we:
 * 1. Create a Step (the expected output of forward conversion)
 * 2. Run it through the reverse converter (Step → BoundEvent/BoundVerification)
 * 3. Run the result back through the forward converter (BoundEvent/BoundVerification → Step)
 * 4. Assert the output matches the original Step
 *
 * This validates that forward ∘ reverse = identity (modulo known lossy mappings).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import type {
  ClickStep,
  TypeStep,
  HoverStep,
  ScrollStep,
  KeypressStep,
  SelectStep,
  NavigateStep,
  WaitStep,
  MouseOutStep,
  DragAndDropStep,
  FileUploadStep,
  HistoryBackStep,
  HistoryForwardStep,
  AssertElementStep,
  AssertApiStep,
  AssertPageStep,
  AssertStyleStep,
  Step,
  Scenario,
} from '@like-cake/ast-types';
import { ElementBindingRegistry } from '../converters/binding-utils';
import { convertStepToEvent } from '../converters/step-to-event';
import { convertStepToVerification } from '../converters/step-to-verification';
import { convertBoundEventToStep } from '../converters/event-to-step';
import { convertBoundVerificationToStep } from '../converters/verification-to-step';
import { convertScenarioToModel } from '../converters/scenario-to-model';

// ── Helpers ────────────────────────────────────────────────────────────

let registry: ElementBindingRegistry;

beforeEach(() => {
  registry = new ElementBindingRegistry();
});

/**
 * Roundtrip helper for events:
 * Step → (reverse) → BoundEvent + ElementBinding → (forward) → Step
 */
const eventRoundtrip = (step: Step): Step | null => {
  const reverseResult = convertStepToEvent(step, registry);
  if (!reverseResult) return null;

  const bindings = registry.getAll();
  const forwardResult = convertBoundEventToStep(reverseResult.boundEvent, bindings);
  if (!forwardResult.ok) return null;

  return forwardResult.step;
};

/**
 * Roundtrip helper for verifications:
 * Step → (reverse) → BoundVerification + ElementBinding → (forward) → Step
 */
const verificationRoundtrip = (step: Step): Step | null => {
  const reverseResult = convertStepToVerification(step, registry);
  if (!reverseResult) return null;

  const bindings = registry.getAll();
  const forwardResult = convertBoundVerificationToStep(reverseResult.boundVerification, bindings);
  if (!forwardResult.ok) return null;

  return forwardResult.step;
};

// ── Event Roundtrip Tests (15 events) ──────────────────────────────────

describe('Event roundtrip: Step → BoundEvent → Step', () => {
  it('click', () => {
    const step: ClickStep = { type: 'click', selector: '#btn' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'click', selector: '#btn' });
  });

  it('doubleClick (clickCount >= 2)', () => {
    const step: ClickStep = { type: 'click', selector: '#btn', clickCount: 2 };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'click', selector: '#btn', clickCount: 2 });
  });

  it('hover', () => {
    const step: HoverStep = { type: 'hover', selector: '.menu' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'hover', selector: '.menu' });
  });

  it('mouseOut', () => {
    const step: MouseOutStep = { type: 'mouseOut', selector: '.tooltip' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'mouseOut', selector: '.tooltip' });
  });

  it('dragAndDrop', () => {
    const step: DragAndDropStep = { type: 'dragAndDrop', selector: '.item', dropTarget: '.zone' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'dragAndDrop', selector: '.item', dropTarget: '.zone' });
  });

  it('scroll with selector', () => {
    const step: ScrollStep = { type: 'scroll', selector: '.container', position: { x: 0, y: 300 } };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'scroll', selector: '.container', position: { x: 0, y: 300 } });
  });

  it('scroll without selector', () => {
    const step: ScrollStep = { type: 'scroll', position: { x: 0, y: 500 } };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'scroll', position: { x: 0, y: 500 } });
  });

  it('type with value', () => {
    const step: TypeStep = { type: 'type', selector: '#email', value: 'user@test.com' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'type', selector: '#email', value: 'user@test.com' });
  });

  it('type with clear and delay', () => {
    const step: TypeStep = { type: 'type', selector: '#email', value: 'new@val', clear: true, delay: 50 };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'type', selector: '#email', value: 'new@val', clear: true, delay: 50 });
  });

  it('clear (type with empty value + clear)', () => {
    const step: TypeStep = { type: 'type', selector: '#input', value: '', clear: true };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'type', selector: '#input', value: '', clear: true });
  });

  it('keypress without selector', () => {
    const step: KeypressStep = { type: 'keypress', key: 'Enter' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'keypress', key: 'Enter' });
  });

  it('keypress with selector and modifiers', () => {
    const step: KeypressStep = { type: 'keypress', key: 'a', selector: '#input', modifiers: ['Control'] };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'keypress', key: 'a', selector: '#input', modifiers: ['Control'] });
  });

  it('select', () => {
    const step: SelectStep = { type: 'select', selector: '#role', values: 'admin' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'select', selector: '#role', values: 'admin' });
  });

  it('fileUpload', () => {
    const step: FileUploadStep = { type: 'fileUpload', selector: '#file', filePaths: '/tmp/test.png' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'fileUpload', selector: '#file', filePaths: '/tmp/test.png' });
  });

  it('navigate with waitUntil', () => {
    const step: NavigateStep = { type: 'navigate', url: 'https://example.com', waitUntil: 'networkidle2' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'navigate', url: 'https://example.com', waitUntil: 'networkidle2' });
  });

  it('navigate without waitUntil', () => {
    const step: NavigateStep = { type: 'navigate', url: 'https://example.com/page' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'navigate', url: 'https://example.com/page' });
  });

  it('historyBack', () => {
    const step: HistoryBackStep = { type: 'historyBack' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'historyBack' });
  });

  it('historyForward', () => {
    const step: HistoryForwardStep = { type: 'historyForward' };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'historyForward' });
  });

  it('wait', () => {
    const step: WaitStep = { type: 'wait', strategy: 'time', duration: 2000 };
    const result = eventRoundtrip(step);
    expect(result).toEqual({ type: 'wait', strategy: 'time', duration: 2000 });
  });

  it('returns null for non-action steps', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#x', assertion: { type: 'visible' } };
    const result = convertStepToEvent(step, registry);
    expect(result).toBeNull();
  });
});

// ── Verification Roundtrip Tests (22 verifications) ────────────────────

describe('Verification roundtrip: Step → BoundVerification → Step', () => {
  // ── Element (6) ──

  it('visible', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#el', assertion: { type: 'visible' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('hidden', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#el', assertion: { type: 'hidden' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('exists', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#el', assertion: { type: 'exists' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('notExists', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#el', assertion: { type: 'notExists' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('count with operator', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '.items', assertion: { type: 'count', value: 5, operator: 'gte' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('count without operator', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '.items', assertion: { type: 'count', value: 3 } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('elementEmpty (text with empty value)', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#msg', assertion: { type: 'text', value: '', contains: false } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  // ── Content (5) ──

  it('textContains', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#msg', assertion: { type: 'text', value: 'hello', contains: true } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('textEquals', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#msg', assertion: { type: 'text', value: 'exact text', contains: false } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('attributeExists', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#el', assertion: { type: 'attribute', name: 'data-testid' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('attributeValue', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#el', assertion: { type: 'attribute', name: 'data-testid', value: 'login' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('classNameExists (attribute name=class)', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#el', assertion: { type: 'attribute', name: 'class', value: 'active' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  // ── Form (5) ──

  it('checkboxChecked (attribute name=checked)', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#cb', assertion: { type: 'attribute', name: 'checked' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('inputDisabled (attribute name=disabled)', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#btn', assertion: { type: 'attribute', name: 'disabled' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('inputReadonly (attribute name=readonly)', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#field', assertion: { type: 'attribute', name: 'readonly' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('inputEnabled', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#btn', assertion: { type: 'enabled' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('inputValue', () => {
    const step: AssertElementStep = { type: 'assertElement', selector: '#input', assertion: { type: 'value', value: 'test@email.com' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  // ── Page (4) ──

  it('currentUrl with matchType', () => {
    const step: AssertPageStep = { type: 'assertPage', assertion: { type: 'url', value: '/dashboard', matchType: 'contains' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('currentUrl without matchType', () => {
    const step: AssertPageStep = { type: 'assertPage', assertion: { type: 'url', value: 'https://example.com' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('pageTitle', () => {
    const step: AssertPageStep = { type: 'assertPage', assertion: { type: 'title', value: 'Dashboard' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('documentExists', () => {
    const step: AssertPageStep = { type: 'assertPage', assertion: { type: 'documentLoaded' } };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  // ── Style (1) ──

  it('cssStyle', () => {
    const step: AssertStyleStep = { type: 'assertStyle', selector: '#el', property: 'color', value: 'rgb(0, 0, 0)' };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  // ── API (2) ──

  it('apiResponse with status and jsonPath', () => {
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/api/users', method: 'GET' },
      expect: { status: 200, jsonPath: { '$.data.id': 42 } },
    };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('apiResponse without jsonPath', () => {
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/api/users' },
      expect: { status: 200 },
    };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('apiCalled (waitFor: true)', () => {
    const step: AssertApiStep = {
      type: 'assertApi',
      match: { url: '/api/login', method: 'POST' },
      waitFor: true,
    };
    expect(verificationRoundtrip(step)).toEqual(step);
  });

  it('returns null for non-assertion steps', () => {
    const step: ClickStep = { type: 'click', selector: '#btn' };
    const result = convertStepToVerification(step, registry);
    expect(result).toBeNull();
  });
});

// ── ElementBindingRegistry deduplication ────────────────────────────────

describe('ElementBindingRegistry', () => {
  it('deduplicates same string selector', () => {
    const reg = new ElementBindingRegistry();
    const b1 = reg.getOrCreate('#btn', 'button 1');
    const b2 = reg.getOrCreate('#btn', 'button 2');

    expect(b1.id).toBe(b2.id);
    expect(reg.getAll()).toHaveLength(1);
  });

  it('deduplicates same object selector', () => {
    const reg = new ElementBindingRegistry();
    const sel = { strategy: 'css' as const, value: '.item' };
    const b1 = reg.getOrCreate(sel, 'item 1');
    const b2 = reg.getOrCreate(sel, 'item 2');

    expect(b1.id).toBe(b2.id);
    expect(reg.getAll()).toHaveLength(1);
  });

  it('creates separate bindings for different selectors', () => {
    const reg = new ElementBindingRegistry();
    reg.getOrCreate('#a', 'link a');
    reg.getOrCreate('#b', 'link b');

    expect(reg.getAll()).toHaveLength(2);
  });

  it('deduplicates across event and verification reverse mappings', () => {
    const reg = new ElementBindingRegistry();
    const click: ClickStep = { type: 'click', selector: '#btn' };
    const visible: AssertElementStep = { type: 'assertElement', selector: '#btn', assertion: { type: 'visible' } };

    convertStepToEvent(click, reg);
    convertStepToVerification(visible, reg);

    // Same selector → same binding
    expect(reg.getAll()).toHaveLength(1);
  });
});

// ── convertScenarioToModel ──────────────────────────────────────────────

describe('convertScenarioToModel', () => {
  const makeScenario = (steps: Step[], name = 'Test Scenario'): Scenario => ({
    id: 'test-scenario',
    name,
    meta: {
      url: 'https://example.com',
      viewport: { width: 1440, height: 900 },
      astSchemaVersion: '1.0.0',
    },
    steps,
  });

  it('creates model with initial and final states for empty scenario', () => {
    const result = convertScenarioToModel(makeScenario([]));

    expect(result.model.states).toHaveLength(1);
    expect(result.model.states[0].isInitial).toBe(true);
    expect(result.model.states[0].isFinal).toBe(true);
    expect(result.model.transitions).toHaveLength(0);
    expect(result.unmappedSteps).toHaveLength(0);
  });

  it('creates states and transitions for action steps', () => {
    const steps: Step[] = [
      { type: 'navigate', url: 'https://example.com/login' },
      { type: 'click', selector: '#btn' },
    ];
    const result = convertScenarioToModel(makeScenario(steps));

    // 시작 + navigate후 + click후 = 3 states
    expect(result.model.states).toHaveLength(3);
    expect(result.model.transitions).toHaveLength(2);
    expect(result.model.states[0].isInitial).toBe(true);
    expect(result.model.states[2].isFinal).toBe(true);
  });

  it('groups consecutive verifications into current state', () => {
    const steps: Step[] = [
      { type: 'navigate', url: 'https://example.com' },
      { type: 'assertElement', selector: '#title', assertion: { type: 'visible' } },
      { type: 'assertElement', selector: '#content', assertion: { type: 'exists' } },
      { type: 'assertPage', assertion: { type: 'title', value: 'Home' } },
    ];
    const result = convertScenarioToModel(makeScenario(steps));

    // 시작 + navigate후 = 2 states
    expect(result.model.states).toHaveLength(2);
    expect(result.model.transitions).toHaveLength(1);
    // navigate 후 state에 3개 검증이 그룹핑
    expect(result.model.states[1].verifications).toHaveLength(3);
  });

  it('names navigate states with hostname', () => {
    const steps: Step[] = [
      { type: 'navigate', url: 'https://example.com/dashboard' },
    ];
    const result = convertScenarioToModel(makeScenario(steps));

    expect(result.model.states[1].name).toBe('Page: example.com/dashboard');
  });

  it('handles name collisions with counter', () => {
    const steps: Step[] = [
      { type: 'click', selector: '#a' },
      { type: 'click', selector: '#b' },
    ];
    const result = convertScenarioToModel(makeScenario(steps));

    const names = result.model.states.slice(1).map((s) => s.name);
    expect(names[0]).toBe('After 클릭');
    expect(names[1]).toBe('After 클릭 (2)');
  });

  it('puts snapshotDom steps in unmappedSteps', () => {
    const steps: Step[] = [
      { type: 'click', selector: '#btn' },
      { type: 'snapshotDom', label: 'before-submit' },
    ];
    const result = convertScenarioToModel(makeScenario(steps));

    expect(result.unmappedSteps).toHaveLength(1);
    expect(result.unmappedSteps[0].step.type).toBe('snapshotDom');
    expect(result.unmappedSteps[0].index).toBe(1);
  });

  it('deduplicates element bindings across steps', () => {
    const steps: Step[] = [
      { type: 'click', selector: '#btn' },
      { type: 'assertElement', selector: '#btn', assertion: { type: 'visible' } },
      { type: 'click', selector: '#btn' },
    ];
    const result = convertScenarioToModel(makeScenario(steps));

    // Same selector → 1 binding
    expect(result.model.elementBindings).toHaveLength(1);
  });

  it('uses scenario name and baseUrl', () => {
    const result = convertScenarioToModel(
      makeScenario([], 'Login Flow'),
      { modelName: 'Custom Name' },
    );

    expect(result.model.name).toBe('Custom Name');
    expect(result.model.baseUrl).toBe('https://example.com');
  });

  it('handles mixed actions and verifications correctly', () => {
    const steps: Step[] = [
      { type: 'navigate', url: 'https://example.com/login' },
      { type: 'assertPage', assertion: { type: 'url', value: '/login', matchType: 'contains' } },
      { type: 'type', selector: '#email', value: 'user@test.com' },
      { type: 'type', selector: '#pass', value: 'secret' },
      { type: 'click', selector: '#submit' },
      { type: 'assertElement', selector: '.dashboard', assertion: { type: 'visible' } },
      { type: 'assertApi', match: { url: '/api/auth', method: 'POST' }, expect: { status: 200 } },
    ];
    const result = convertScenarioToModel(makeScenario(steps, 'Login Flow'));

    // States: 시작, navigate후(1 verif), type email후, type pass후, click후(2 verifs)
    expect(result.model.states).toHaveLength(5);
    expect(result.model.transitions).toHaveLength(4);
    expect(result.model.states[1].verifications).toHaveLength(1); // assertPage
    expect(result.model.states[4].verifications).toHaveLength(2); // assertElement + assertApi
    expect(result.model.states[4].isFinal).toBe(true);
    expect(result.unmappedSteps).toHaveLength(0);
  });
});
