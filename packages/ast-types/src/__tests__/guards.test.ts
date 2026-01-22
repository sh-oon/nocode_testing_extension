import { describe, expect, it } from 'vitest';
import {
  isAssertApiStep,
  isAssertElementStep,
  isAssertionStep,
  isClickStep,
  isCssSelector,
  isHoverStep,
  isKeypressStep,
  isNavigateStep,
  isObservationStep,
  isRoleSelector,
  isScrollStep,
  isSelectorObject,
  isSelectStep,
  isSnapshotDomStep,
  isTestIdSelector,
  isTypeStep,
  isUIActionStep,
  isWaitStep,
  isXPathSelector,
} from '../guards';
import type { Step } from '../types';

describe('Step Type Guards', () => {
  const navigateStep: Step = { type: 'navigate', url: '/home' };
  const clickStep: Step = { type: 'click', selector: 'button' };
  const typeStep: Step = {
    type: 'type',
    selector: 'input',
    value: 'test',
  };
  const keypressStep: Step = { type: 'keypress', key: 'Enter' };
  const waitStep: Step = { type: 'wait', strategy: 'time', duration: 1000 };
  const hoverStep: Step = { type: 'hover', selector: '.menu' };
  const scrollStep: Step = { type: 'scroll', position: { y: 100 } };
  const selectStep: Step = {
    type: 'select',
    selector: 'select',
    values: 'option1',
  };
  const assertApiStep: Step = {
    type: 'assertApi',
    match: { url: '/api/test' },
  };
  const assertElementStep: Step = {
    type: 'assertElement',
    selector: '.element',
    assertion: { type: 'visible' },
  };
  const snapshotDomStep: Step = {
    type: 'snapshotDom',
    label: 'test-snapshot',
  };

  describe('Individual type guards', () => {
    it('isNavigateStep', () => {
      expect(isNavigateStep(navigateStep)).toBe(true);
      expect(isNavigateStep(clickStep)).toBe(false);
    });

    it('isClickStep', () => {
      expect(isClickStep(clickStep)).toBe(true);
      expect(isClickStep(navigateStep)).toBe(false);
    });

    it('isTypeStep', () => {
      expect(isTypeStep(typeStep)).toBe(true);
      expect(isTypeStep(clickStep)).toBe(false);
    });

    it('isKeypressStep', () => {
      expect(isKeypressStep(keypressStep)).toBe(true);
      expect(isKeypressStep(clickStep)).toBe(false);
    });

    it('isWaitStep', () => {
      expect(isWaitStep(waitStep)).toBe(true);
      expect(isWaitStep(clickStep)).toBe(false);
    });

    it('isHoverStep', () => {
      expect(isHoverStep(hoverStep)).toBe(true);
      expect(isHoverStep(clickStep)).toBe(false);
    });

    it('isScrollStep', () => {
      expect(isScrollStep(scrollStep)).toBe(true);
      expect(isScrollStep(clickStep)).toBe(false);
    });

    it('isSelectStep', () => {
      expect(isSelectStep(selectStep)).toBe(true);
      expect(isSelectStep(clickStep)).toBe(false);
    });

    it('isAssertApiStep', () => {
      expect(isAssertApiStep(assertApiStep)).toBe(true);
      expect(isAssertApiStep(clickStep)).toBe(false);
    });

    it('isAssertElementStep', () => {
      expect(isAssertElementStep(assertElementStep)).toBe(true);
      expect(isAssertElementStep(clickStep)).toBe(false);
    });

    it('isSnapshotDomStep', () => {
      expect(isSnapshotDomStep(snapshotDomStep)).toBe(true);
      expect(isSnapshotDomStep(clickStep)).toBe(false);
    });
  });

  describe('Category type guards', () => {
    it('isUIActionStep', () => {
      expect(isUIActionStep(navigateStep)).toBe(true);
      expect(isUIActionStep(clickStep)).toBe(true);
      expect(isUIActionStep(typeStep)).toBe(true);
      expect(isUIActionStep(keypressStep)).toBe(true);
      expect(isUIActionStep(waitStep)).toBe(true);
      expect(isUIActionStep(hoverStep)).toBe(true);
      expect(isUIActionStep(scrollStep)).toBe(true);
      expect(isUIActionStep(selectStep)).toBe(true);
      expect(isUIActionStep(assertApiStep)).toBe(false);
      expect(isUIActionStep(assertElementStep)).toBe(false);
      expect(isUIActionStep(snapshotDomStep)).toBe(false);
    });

    it('isAssertionStep', () => {
      expect(isAssertionStep(assertApiStep)).toBe(true);
      expect(isAssertionStep(assertElementStep)).toBe(true);
      expect(isAssertionStep(clickStep)).toBe(false);
      expect(isAssertionStep(snapshotDomStep)).toBe(false);
    });

    it('isObservationStep', () => {
      expect(isObservationStep(snapshotDomStep)).toBe(true);
      expect(isObservationStep(clickStep)).toBe(false);
      expect(isObservationStep(assertApiStep)).toBe(false);
    });
  });
});

describe('Selector Type Guards', () => {
  it('isSelectorObject', () => {
    expect(isSelectorObject('[data-testid="test"]')).toBe(false);
    expect(isSelectorObject({ strategy: 'testId', value: 'test' })).toBe(true);
  });

  it('isTestIdSelector', () => {
    expect(isTestIdSelector({ strategy: 'testId', value: 'test' })).toBe(true);
    expect(isTestIdSelector({ strategy: 'css', value: '.test' })).toBe(false);
  });

  it('isRoleSelector', () => {
    expect(isRoleSelector({ strategy: 'role', value: 'button', role: 'button' })).toBe(true);
    expect(isRoleSelector({ strategy: 'testId', value: 'test' })).toBe(false);
  });

  it('isCssSelector', () => {
    expect(isCssSelector({ strategy: 'css', value: '.test' })).toBe(true);
    expect(isCssSelector({ strategy: 'testId', value: 'test' })).toBe(false);
  });

  it('isXPathSelector', () => {
    expect(isXPathSelector({ strategy: 'xpath', value: '//button[@id="test"]' })).toBe(true);
    expect(isXPathSelector({ strategy: 'testId', value: 'test' })).toBe(false);
  });
});
