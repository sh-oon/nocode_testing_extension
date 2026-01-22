import type { Selector } from '@like-cake/ast-types';
import { describe, expect, it } from 'vitest';
import { toSelectorString } from '../executors/selector-utils';

describe('toSelectorString', () => {
  it('should pass through string selectors', () => {
    expect(toSelectorString('[data-testid="submit"]')).toBe('[data-testid="submit"]');
    expect(toSelectorString('.btn.primary')).toBe('.btn.primary');
  });

  it('should convert testId selector', () => {
    const selector: Selector = {
      strategy: 'testId',
      value: 'submit-button',
    };

    expect(toSelectorString(selector)).toBe('[data-testid="submit-button"]');
  });

  it('should convert role selector without name', () => {
    const selector: Selector = {
      strategy: 'role',
      value: 'button',
      role: 'button',
    };

    expect(toSelectorString(selector)).toBe('[role="button"]');
  });

  it('should convert role selector with name', () => {
    const selector: Selector = {
      strategy: 'role',
      value: 'button',
      role: 'button',
      name: 'Submit',
    };

    expect(toSelectorString(selector)).toBe('[role="button"][aria-label="Submit"]');
  });

  it('should convert css selector', () => {
    const selector: Selector = {
      strategy: 'css',
      value: '.btn.primary',
    };

    expect(toSelectorString(selector)).toBe('.btn.primary');
  });

  it('should convert xpath selector', () => {
    const selector: Selector = {
      strategy: 'xpath',
      value: '//button[@type="submit"]',
    };

    expect(toSelectorString(selector)).toBe('xpath///button[@type="submit"]');
  });
});
