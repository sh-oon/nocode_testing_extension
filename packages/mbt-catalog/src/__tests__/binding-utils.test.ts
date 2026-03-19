import type { SelectorInput } from '@like-cake/ast-types';
import { describe, expect, it } from 'vitest';
import {
  createElementBindingFromSelector,
  ElementBindingRegistry,
  serializeSelector,
} from '../converters/binding-utils';

// ── serializeSelector ────────────────────────────────────────────────────

describe('serializeSelector', () => {
  it('returns string selector as-is', () => {
    const result = serializeSelector('.my-button');
    expect(result).toBe('.my-button');
  });

  it('serializes testId strategy as "testId:value"', () => {
    const selector: SelectorInput = { strategy: 'testId', value: 'login-btn' };
    expect(serializeSelector(selector)).toBe('testId:login-btn');
  });

  it('serializes css strategy as "css:value"', () => {
    const selector: SelectorInput = { strategy: 'css', value: '.submit' };
    expect(serializeSelector(selector)).toBe('css:.submit');
  });

  it('serializes xpath strategy as "xpath:value"', () => {
    const selector: SelectorInput = { strategy: 'xpath', value: '//button[@id="ok"]' };
    expect(serializeSelector(selector)).toBe('xpath://button[@id="ok"]');
  });

  it('serializes role strategy with accessible name as "role:roleName:accessibleName"', () => {
    const selector: SelectorInput = {
      strategy: 'role',
      value: 'button',
      role: 'button',
      name: 'Submit',
    };
    expect(serializeSelector(selector)).toBe('role:button:Submit');
  });

  it('serializes role strategy without accessible name as "role:roleName:"', () => {
    const selector: SelectorInput = { strategy: 'role', value: 'textbox', role: 'textbox' };
    expect(serializeSelector(selector)).toBe('role:textbox:');
  });
});

// ── createElementBindingFromSelector ─────────────────────────────────────

describe('createElementBindingFromSelector', () => {
  const selector: SelectorInput = { strategy: 'testId', value: 'email-input' };
  const label = '이메일 입력';
  const pageUrl = 'https://example.com/login';

  it('creates a binding with the provided selector, label, and pageUrl', () => {
    const binding = createElementBindingFromSelector(selector, label, pageUrl);
    expect(binding.selector).toEqual(selector);
    expect(binding.label).toBe(label);
    expect(binding.pageUrl).toBe(pageUrl);
  });

  it('sets selectionMethod to "recording"', () => {
    const binding = createElementBindingFromSelector(selector, label, pageUrl);
    expect(binding.selectionMethod).toBe('recording');
  });

  it('initializes candidates as an empty array', () => {
    const binding = createElementBindingFromSelector(selector, label, pageUrl);
    expect(binding.candidates).toEqual([]);
  });

  it('sets createdAt to a numeric timestamp', () => {
    const before = Date.now();
    const binding = createElementBindingFromSelector(selector, label, pageUrl);
    const after = Date.now();
    expect(typeof binding.createdAt).toBe('number');
    expect(binding.createdAt).toBeGreaterThanOrEqual(before);
    expect(binding.createdAt).toBeLessThanOrEqual(after);
  });

  it('assigns a non-empty string id', () => {
    const binding = createElementBindingFromSelector(selector, label, pageUrl);
    expect(typeof binding.id).toBe('string');
    expect(binding.id.length).toBeGreaterThan(0);
  });

  it('defaults pageUrl to empty string when omitted', () => {
    const binding = createElementBindingFromSelector(selector, label);
    expect(binding.pageUrl).toBe('');
  });
});

// ── ElementBindingRegistry ───────────────────────────────────────────────

describe('ElementBindingRegistry', () => {
  it('getOrCreate returns a new binding for a new selector', () => {
    const registry = new ElementBindingRegistry();
    const selector: SelectorInput = { strategy: 'css', value: '.btn' };
    const binding = registry.getOrCreate(selector, 'Button', 'https://example.com');
    expect(binding).toBeDefined();
    expect(binding.label).toBe('Button');
  });

  it('getOrCreate returns the same binding for the same string selector (dedup)', () => {
    const registry = new ElementBindingRegistry();
    const first = registry.getOrCreate('.my-btn', 'First', 'https://example.com');
    const second = registry.getOrCreate('.my-btn', 'Second', 'https://example.com');
    expect(first.id).toBe(second.id);
  });

  it('getOrCreate returns the same binding for the same object selector (dedup)', () => {
    const registry = new ElementBindingRegistry();
    const selectorA: SelectorInput = { strategy: 'testId', value: 'submit' };
    const selectorB: SelectorInput = { strategy: 'testId', value: 'submit' };
    const first = registry.getOrCreate(selectorA, 'Submit', 'https://example.com');
    const second = registry.getOrCreate(selectorB, 'Submit Again', 'https://example.com');
    expect(first.id).toBe(second.id);
  });

  it('different selectors produce different bindings', () => {
    const registry = new ElementBindingRegistry();
    const selectorA: SelectorInput = { strategy: 'css', value: '.btn-a' };
    const selectorB: SelectorInput = { strategy: 'css', value: '.btn-b' };
    const bindingA = registry.getOrCreate(selectorA, 'A', 'https://example.com');
    const bindingB = registry.getOrCreate(selectorB, 'B', 'https://example.com');
    expect(bindingA.id).not.toBe(bindingB.id);
  });

  it('getAll returns all created bindings', () => {
    const registry = new ElementBindingRegistry();
    registry.getOrCreate({ strategy: 'css', value: '.a' }, 'A', 'https://example.com');
    registry.getOrCreate({ strategy: 'css', value: '.b' }, 'B', 'https://example.com');
    registry.getOrCreate({ strategy: 'testId', value: 'c' }, 'C', 'https://example.com');
    const all = registry.getAll();
    expect(all).toHaveLength(3);
  });

  it('getAll length matches unique selector count even with duplicates', () => {
    const registry = new ElementBindingRegistry();
    const selector: SelectorInput = {
      strategy: 'role',
      value: 'button',
      role: 'button',
      name: 'OK',
    };
    registry.getOrCreate(selector, 'OK Button', 'https://example.com');
    registry.getOrCreate(selector, 'OK Button duplicate', 'https://example.com');
    registry.getOrCreate({ strategy: 'css', value: '.cancel' }, 'Cancel', 'https://example.com');
    const all = registry.getAll();
    expect(all).toHaveLength(2);
  });
});
