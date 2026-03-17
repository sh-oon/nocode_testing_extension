import { describe, expect, it } from 'vitest';
import type { SelectorInput } from '@like-cake/ast-types';
import type { ElementBinding } from '../types/element-binding';
import type { BoundEvent, BoundVerification, TestModel } from '../types/model';
import type { TestPath } from '../converters/types';
import { convertBoundEventToStep } from '../converters/event-to-step';
import { convertBoundVerificationToStep } from '../converters/verification-to-step';
import { convertModelToXStateMachineConfig } from '../converters/model-to-xstate';
import { convertTestPathToScenario } from '../converters/path-to-scenario';

// ── Test fixtures ───────────────────────────────────────────────────────

const makeSelector = (value: string): SelectorInput => ({
  strategy: 'css',
  value,
});

const makeBinding = (id: string, selector: string): ElementBinding => ({
  id,
  selector: makeSelector(selector),
  candidates: [],
  selectionMethod: 'manual',
  label: `element-${id}`,
  pageUrl: 'https://example.com',
  createdAt: Date.now(),
});

const bindings: ElementBinding[] = [
  makeBinding('btn-login', '[data-testid="login-btn"]'),
  makeBinding('input-email', '[data-testid="email"]'),
  makeBinding('dropdown-role', '[data-testid="role-select"]'),
  makeBinding('scroll-area', '[data-testid="scroll-container"]'),
];

// ── Event → Step tests ──────────────────────────────────────────────────

describe('convertBoundEventToStep', () => {
  it('converts click event', () => {
    const event: BoundEvent = { eventId: 'click', elementBindingId: 'btn-login', params: {} };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'click', selector: makeSelector('[data-testid="login-btn"]') },
    });
  });

  it('converts doubleClick with clickCount: 2', () => {
    const event: BoundEvent = { eventId: 'doubleClick', elementBindingId: 'btn-login', params: {} };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'click', selector: makeSelector('[data-testid="login-btn"]'), clickCount: 2 },
    });
  });

  it('converts hover event', () => {
    const event: BoundEvent = { eventId: 'hover', elementBindingId: 'btn-login', params: {} };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'hover', selector: makeSelector('[data-testid="login-btn"]') },
    });
  });

  it('converts scroll event with optional selector', () => {
    const event: BoundEvent = {
      eventId: 'scroll',
      elementBindingId: 'scroll-area',
      params: { x: 0, y: 300 },
    };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'scroll',
        selector: makeSelector('[data-testid="scroll-container"]'),
        position: { x: 0, y: 300 },
      },
    });
  });

  it('converts scroll event without selector', () => {
    const event: BoundEvent = { eventId: 'scroll', elementBindingId: null, params: { x: 0, y: 500 } };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'scroll', position: { x: 0, y: 500 } },
    });
  });

  it('converts type event with all params', () => {
    const event: BoundEvent = {
      eventId: 'type',
      elementBindingId: 'input-email',
      params: { value: 'user@test.com', clear: true, delay: 50 },
    };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'type',
        selector: makeSelector('[data-testid="email"]'),
        value: 'user@test.com',
        clear: true,
        delay: 50,
      },
    });
  });

  it('converts clear event as type with empty value', () => {
    const event: BoundEvent = { eventId: 'clear', elementBindingId: 'input-email', params: {} };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'type',
        selector: makeSelector('[data-testid="email"]'),
        value: '',
        clear: true,
      },
    });
  });

  it('converts keypress event', () => {
    const event: BoundEvent = { eventId: 'keypress', elementBindingId: null, params: { key: 'Enter' } };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'keypress', key: 'Enter' },
    });
  });

  it('converts select event', () => {
    const event: BoundEvent = {
      eventId: 'select',
      elementBindingId: 'dropdown-role',
      params: { value: 'admin' },
    };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'select',
        selector: makeSelector('[data-testid="role-select"]'),
        values: 'admin',
      },
    });
  });

  it('converts navigate event', () => {
    const event: BoundEvent = {
      eventId: 'navigate',
      elementBindingId: null,
      params: { url: 'https://example.com/dashboard', waitUntil: 'networkidle2' },
    };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'navigate', url: 'https://example.com/dashboard', waitUntil: 'networkidle2' },
    });
  });

  it('converts wait event', () => {
    const event: BoundEvent = { eventId: 'wait', elementBindingId: null, params: { duration: 2000 } };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'wait', strategy: 'time', duration: 2000 },
    });
  });

  // ── Phase 4 events (previously null-mapped, now supported) ──

  it('converts mouseout event', () => {
    const event: BoundEvent = { eventId: 'mouseout', elementBindingId: 'btn-login', params: {} };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'mouseOut', selector: makeSelector('[data-testid="login-btn"]') },
    });
  });

  it('converts dragAndDrop event', () => {
    const event: BoundEvent = {
      eventId: 'dragAndDrop',
      elementBindingId: 'btn-login',
      params: { dropTarget: '.drop-zone' },
    };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'dragAndDrop', selector: makeSelector('[data-testid="login-btn"]'), dropTarget: '.drop-zone' },
    });
  });

  it('converts fileUpload event', () => {
    const event: BoundEvent = {
      eventId: 'fileUpload',
      elementBindingId: 'input-email',
      params: { filePath: '/tmp/test.png' },
    };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'fileUpload', selector: makeSelector('[data-testid="email"]'), filePaths: '/tmp/test.png' },
    });
  });

  it('converts historyBack event', () => {
    const event: BoundEvent = { eventId: 'historyBack', elementBindingId: null, params: {} };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({ ok: true, step: { type: 'historyBack' } });
  });

  it('converts historyForward event', () => {
    const event: BoundEvent = { eventId: 'historyForward', elementBindingId: null, params: {} };
    const result = convertBoundEventToStep(event, bindings);
    expect(result).toEqual({ ok: true, step: { type: 'historyForward' } });
  });

  it('returns error for unknown event ID', () => {
    const event: BoundEvent = { eventId: 'unknownEvent', elementBindingId: null, params: {} };
    const result = convertBoundEventToStep(event, bindings);
    expect(result.ok).toBe(false);
  });
});

// ── Verification → Step tests ───────────────────────────────────────────

describe('convertBoundVerificationToStep', () => {
  it('converts visible verification', () => {
    const v: BoundVerification = { verificationId: 'visible', elementBindingId: 'btn-login', params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'assertElement', selector: makeSelector('[data-testid="login-btn"]'), assertion: { type: 'visible' } },
    });
  });

  it('converts hidden verification', () => {
    const v: BoundVerification = { verificationId: 'hidden', elementBindingId: 'btn-login', params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'assertElement', selector: makeSelector('[data-testid="login-btn"]'), assertion: { type: 'hidden' } },
    });
  });

  it('converts exists verification', () => {
    const v: BoundVerification = { verificationId: 'exists', elementBindingId: 'btn-login', params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'assertElement', selector: makeSelector('[data-testid="login-btn"]'), assertion: { type: 'exists' } },
    });
  });

  it('converts notExists verification', () => {
    const v: BoundVerification = { verificationId: 'notExists', elementBindingId: 'btn-login', params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'assertElement', selector: makeSelector('[data-testid="login-btn"]'), assertion: { type: 'notExists' } },
    });
  });

  it('converts count verification with operator', () => {
    const v: BoundVerification = {
      verificationId: 'count',
      elementBindingId: 'btn-login',
      params: { value: 3, operator: 'gte' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="login-btn"]'),
        assertion: { type: 'count', value: 3, operator: 'gte' },
      },
    });
  });

  it('converts elementEmpty verification', () => {
    const v: BoundVerification = { verificationId: 'elementEmpty', elementBindingId: 'input-email', params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="email"]'),
        assertion: { type: 'text', value: '', contains: false },
      },
    });
  });

  it('converts textContains verification', () => {
    const v: BoundVerification = {
      verificationId: 'textContains',
      elementBindingId: 'btn-login',
      params: { value: 'Log' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="login-btn"]'),
        assertion: { type: 'text', value: 'Log', contains: true },
      },
    });
  });

  it('converts textEquals verification', () => {
    const v: BoundVerification = {
      verificationId: 'textEquals',
      elementBindingId: 'btn-login',
      params: { value: 'Login' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="login-btn"]'),
        assertion: { type: 'text', value: 'Login', contains: false },
      },
    });
  });

  it('converts attributeExists verification', () => {
    const v: BoundVerification = {
      verificationId: 'attributeExists',
      elementBindingId: 'btn-login',
      params: { name: 'data-testid' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="login-btn"]'),
        assertion: { type: 'attribute', name: 'data-testid' },
      },
    });
  });

  it('converts attributeValue verification', () => {
    const v: BoundVerification = {
      verificationId: 'attributeValue',
      elementBindingId: 'btn-login',
      params: { name: 'role', value: 'button' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="login-btn"]'),
        assertion: { type: 'attribute', name: 'role', value: 'button' },
      },
    });
  });

  it('converts classNameExists verification', () => {
    const v: BoundVerification = {
      verificationId: 'classNameExists',
      elementBindingId: 'btn-login',
      params: { value: 'active' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="login-btn"]'),
        assertion: { type: 'attribute', name: 'class', value: 'active' },
      },
    });
  });

  it('converts checkboxChecked verification', () => {
    const v: BoundVerification = { verificationId: 'checkboxChecked', elementBindingId: 'btn-login', params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="login-btn"]'),
        assertion: { type: 'attribute', name: 'checked' },
      },
    });
  });

  it('converts inputDisabled verification', () => {
    const v: BoundVerification = { verificationId: 'inputDisabled', elementBindingId: 'input-email', params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="email"]'),
        assertion: { type: 'attribute', name: 'disabled' },
      },
    });
  });

  it('converts inputReadonly verification', () => {
    const v: BoundVerification = { verificationId: 'inputReadonly', elementBindingId: 'input-email', params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="email"]'),
        assertion: { type: 'attribute', name: 'readonly' },
      },
    });
  });

  it('converts apiResponse verification', () => {
    const v: BoundVerification = {
      verificationId: 'apiResponse',
      elementBindingId: null,
      params: { url: '/api/users', method: 'GET', status: 200, jsonPath: '$.data.id', expectedValue: '42' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertApi',
        match: { url: '/api/users', method: 'GET' },
        expect: { status: 200, jsonPath: { '$.data.id': '42' } },
      },
    });
  });

  it('converts apiCalled verification', () => {
    const v: BoundVerification = {
      verificationId: 'apiCalled',
      elementBindingId: null,
      params: { url: '/api/login', method: 'POST' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertApi',
        match: { url: '/api/login', method: 'POST' },
        waitFor: true,
      },
    });
  });

  // ── Phase 4 verifications (previously null-mapped, now supported) ──

  it('converts inputEnabled verification', () => {
    const v: BoundVerification = { verificationId: 'inputEnabled', elementBindingId: 'input-email', params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="email"]'),
        assertion: { type: 'enabled' },
      },
    });
  });

  it('converts inputValue verification', () => {
    const v: BoundVerification = {
      verificationId: 'inputValue',
      elementBindingId: 'input-email',
      params: { value: 'test@example.com' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertElement',
        selector: makeSelector('[data-testid="email"]'),
        assertion: { type: 'value', value: 'test@example.com' },
      },
    });
  });

  it('converts currentUrl verification', () => {
    const v: BoundVerification = {
      verificationId: 'currentUrl',
      elementBindingId: null,
      params: { url: '/dashboard', matchType: 'contains' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertPage',
        assertion: { type: 'url', value: '/dashboard', matchType: 'contains' },
      },
    });
  });

  it('converts pageTitle verification', () => {
    const v: BoundVerification = {
      verificationId: 'pageTitle',
      elementBindingId: null,
      params: { title: 'Dashboard' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'assertPage', assertion: { type: 'title', value: 'Dashboard' } },
    });
  });

  it('converts documentExists verification', () => {
    const v: BoundVerification = { verificationId: 'documentExists', elementBindingId: null, params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: { type: 'assertPage', assertion: { type: 'documentLoaded' } },
    });
  });

  it('converts cssStyle verification', () => {
    const v: BoundVerification = {
      verificationId: 'cssStyle',
      elementBindingId: 'btn-login',
      params: { property: 'color', value: 'rgb(0, 0, 0)' },
      critical: true,
    };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result).toEqual({
      ok: true,
      step: {
        type: 'assertStyle',
        selector: makeSelector('[data-testid="login-btn"]'),
        property: 'color',
        value: 'rgb(0, 0, 0)',
      },
    });
  });

  it('returns error for unknown verification ID', () => {
    const v: BoundVerification = { verificationId: 'unknownVerification', elementBindingId: null, params: {}, critical: true };
    const result = convertBoundVerificationToStep(v, bindings);
    expect(result.ok).toBe(false);
  });
});

// ── Model → XState tests ────────────────────────────────────────────────

describe('convertModelToXStateMachineConfig', () => {
  const makeModel = (overrides: Partial<TestModel> = {}): TestModel => ({
    id: 'model-1',
    name: 'Login Flow',
    states: [
      {
        id: 'login-page',
        name: 'Login Page',
        verifications: [
          { verificationId: 'visible', elementBindingId: 'btn-login', params: {}, critical: true },
        ],
        isInitial: true,
      },
      {
        id: 'dashboard',
        name: 'Dashboard',
        verifications: [],
        isFinal: true,
      },
    ],
    transitions: [
      {
        id: 'do-login',
        sourceStateId: 'login-page',
        targetStateId: 'dashboard',
        event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
      },
    ],
    elementBindings: bindings,
    baseUrl: 'https://example.com',
    variables: { username: 'admin' },
    meta: { createdAt: 0, updatedAt: 0, version: 1 },
    ...overrides,
  });

  it('sets initial state correctly', () => {
    const config = convertModelToXStateMachineConfig(makeModel());
    expect(config.initial).toBe('login-page');
  });

  it('sets final state type', () => {
    const config = convertModelToXStateMachineConfig(makeModel());
    expect(config.states.dashboard.type).toBe('final');
  });

  it('adds entry action for states with verifications', () => {
    const config = convertModelToXStateMachineConfig(makeModel());
    expect(config.states['login-page'].entry).toEqual(['verify_login-page']);
    expect(config.states.dashboard.entry).toBeUndefined();
  });

  it('maps transitions to on events', () => {
    const config = convertModelToXStateMachineConfig(makeModel());
    expect(config.states['login-page'].on).toEqual({
      'do-login': {
        target: 'dashboard',
        meta: { transitionId: 'do-login' },
      },
    });
  });

  it('includes guard when transition has a condition', () => {
    const model = makeModel({
      transitions: [
        {
          id: 'do-login',
          sourceStateId: 'login-page',
          targetStateId: 'dashboard',
          event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
          guard: { left: '{{isAdmin}}', operator: 'eq', right: 'true' },
        },
      ],
    });
    const config = convertModelToXStateMachineConfig(model);
    const transition = config.states['login-page'].on?.['do-login'];
    expect(transition).toEqual({
      target: 'dashboard',
      guard: {
        type: 'flowCondition',
        params: { condition: { left: '{{isAdmin}}', operator: 'eq', right: 'true' } },
      },
      meta: { transitionId: 'do-login' },
    });
  });

  it('groups multiple transitions with same event key as array', () => {
    const model = makeModel({
      states: [
        { id: 's1', name: 'S1', verifications: [], isInitial: true },
        { id: 's2', name: 'S2', verifications: [] },
        { id: 's3', name: 'S3', verifications: [], isFinal: true },
      ],
      transitions: [
        {
          id: 'go',
          sourceStateId: 's1',
          targetStateId: 's2',
          event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
        },
        {
          id: 'go',
          sourceStateId: 's1',
          targetStateId: 's3',
          event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
          guard: { left: '{{flag}}', operator: 'eq', right: 'true' },
        },
      ],
    });
    const config = convertModelToXStateMachineConfig(model);
    const transitions = config.states.s1.on?.go;
    expect(Array.isArray(transitions)).toBe(true);
    expect(transitions).toHaveLength(2);
  });

  it('sets context with model metadata', () => {
    const config = convertModelToXStateMachineConfig(makeModel());
    expect(config.context).toEqual({
      modelId: 'model-1',
      baseUrl: 'https://example.com',
      variables: { username: 'admin' },
    });
  });

  it('includes state meta with name and verificationCount', () => {
    const config = convertModelToXStateMachineConfig(makeModel());
    expect(config.states['login-page'].meta).toEqual({
      name: 'Login Page',
      verificationCount: 1,
    });
    expect(config.states.dashboard.meta).toEqual({
      name: 'Dashboard',
      verificationCount: 0,
    });
  });

  it('throws when no initial state exists', () => {
    const model = makeModel({
      states: [{ id: 's1', name: 'S1', verifications: [] }],
      transitions: [],
    });
    expect(() => convertModelToXStateMachineConfig(model)).toThrow('no initial state');
  });
});

// ── Path → Scenario tests ───────────────────────────────────────────────

describe('convertTestPathToScenario', () => {
  const model: TestModel = {
    id: 'model-1',
    name: 'Login Flow',
    states: [
      {
        id: 'login-page',
        name: 'Login Page',
        verifications: [
          { verificationId: 'visible', elementBindingId: 'btn-login', params: {}, critical: true },
        ],
        isInitial: true,
      },
      {
        id: 'dashboard',
        name: 'Dashboard',
        verifications: [
          { verificationId: 'textContains', elementBindingId: 'btn-login', params: { value: 'Welcome' }, critical: true },
          { verificationId: 'apiCalled', elementBindingId: null, params: { url: '/api/me', method: 'GET' }, critical: false },
        ],
      },
    ],
    transitions: [
      {
        id: 't1',
        sourceStateId: 'login-page',
        targetStateId: 'dashboard',
        event: { eventId: 'click', elementBindingId: 'btn-login', params: {} },
      },
    ],
    elementBindings: bindings,
    baseUrl: 'https://example.com',
    variables: { token: 'abc' },
    meta: { createdAt: 0, updatedAt: 0, version: 1 },
  };

  const path: TestPath = {
    id: 'path-1',
    name: 'Login → Dashboard',
    modelId: 'model-1',
    nodes: [
      { kind: 'state', state: model.states[0] },
      { kind: 'transition', transition: model.transitions[0] },
      { kind: 'state', state: model.states[1] },
    ],
  };

  it('produces steps in correct order: verifications → action → verifications', () => {
    const { scenario } = convertTestPathToScenario(path, model);
    expect(scenario.steps).toHaveLength(4);
    // State 1 verification
    expect(scenario.steps[0].type).toBe('assertElement');
    // Transition action
    expect(scenario.steps[1].type).toBe('click');
    // State 2 verifications
    expect(scenario.steps[2].type).toBe('assertElement');
    expect(scenario.steps[3].type).toBe('assertApi');
  });

  it('sets optional: true for non-critical verifications', () => {
    const { scenario } = convertTestPathToScenario(path, model);
    // apiCalled verification is non-critical
    expect(scenario.steps[3].optional).toBe(true);
    // visible verification is critical → no optional flag
    expect(scenario.steps[0].optional).toBeUndefined();
  });

  it('sets scenario metadata', () => {
    const { scenario } = convertTestPathToScenario(path, model);
    expect(scenario.id).toBe('path-1');
    expect(scenario.name).toBe('Login → Dashboard');
    expect(scenario.meta.url).toBe('https://example.com');
    expect(scenario.meta.viewport).toEqual({ width: 1280, height: 720 });
    expect(scenario.meta.astSchemaVersion).toBe('1.0.0');
    expect(scenario.variables).toEqual({ token: 'abc' });
  });

  it('collects errors for unsupported mappings without halting', () => {
    const modelWithUnsupported: TestModel = {
      ...model,
      states: [
        {
          id: 'page',
          name: 'Page',
          verifications: [
            { verificationId: 'visible', elementBindingId: 'btn-login', params: {}, critical: true },
            { verificationId: 'unknownFutureVerification', elementBindingId: null, params: {}, critical: true },
          ],
          isInitial: true,
        },
      ],
      transitions: [],
    };

    const pathWithUnsupported: TestPath = {
      id: 'path-2',
      name: 'Just a page',
      modelId: 'model-1',
      nodes: [{ kind: 'state', state: modelWithUnsupported.states[0] }],
    };

    const { scenario, errors } = convertTestPathToScenario(pathWithUnsupported, modelWithUnsupported);
    // Only the supported verification becomes a step
    expect(scenario.steps).toHaveLength(1);
    expect(scenario.steps[0].type).toBe('assertElement');
    // The unsupported one is collected in errors
    expect(errors).toHaveLength(1);
    expect(errors[0].catalogEntryId).toBe('unknownFutureVerification');
  });

  it('collects errors for unsupported events in transitions', () => {
    const modelWithUnsupportedEvent: TestModel = {
      ...model,
      states: [
        { id: 's1', name: 'S1', verifications: [], isInitial: true },
        { id: 's2', name: 'S2', verifications: [] },
      ],
      transitions: [
        {
          id: 't1',
          sourceStateId: 's1',
          targetStateId: 's2',
          event: { eventId: 'unknownFutureEvent', elementBindingId: 'btn-login', params: {} },
        },
      ],
    };

    const pathWithUnsupportedEvent: TestPath = {
      id: 'path-3',
      name: 'Drag test',
      modelId: 'model-1',
      nodes: [
        { kind: 'state', state: modelWithUnsupportedEvent.states[0] },
        { kind: 'transition', transition: modelWithUnsupportedEvent.transitions[0] },
        { kind: 'state', state: modelWithUnsupportedEvent.states[1] },
      ],
    };

    const { scenario, errors } = convertTestPathToScenario(pathWithUnsupportedEvent, modelWithUnsupportedEvent);
    expect(scenario.steps).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].catalogEntryId).toBe('unknownFutureEvent');
  });
});
