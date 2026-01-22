import { describe, expect, it } from 'vitest';
import {
  getBestSelector,
  SELECTOR_PRIORITY,
  SelectorPrioritizer,
  selectorToQueryString,
} from '../strategies';
import type { ElementInfo } from '../types';

describe('SelectorPrioritizer', () => {
  const prioritizer = new SelectorPrioritizer();

  describe('getBestSelector', () => {
    it('should prefer testId over other strategies', () => {
      const element: ElementInfo = {
        tagName: 'button',
        id: 'submit',
        classNames: ['btn', 'btn-primary'],
        testId: 'submit-btn',
        role: 'button',
        ariaLabel: 'Submit',
        attributes: {},
      };

      const result = prioritizer.getBestSelector(element);

      expect(result).not.toBeNull();
      expect(result!.selector.strategy).toBe('testId');
      expect(result!.selector.value).toBe('submit-btn');
    });

    it('should fall back to role when testId is not available', () => {
      const element: ElementInfo = {
        tagName: 'button',
        classNames: ['btn'],
        ariaLabel: 'Submit',
        attributes: {},
      };

      const result = prioritizer.getBestSelector(element);

      expect(result).not.toBeNull();
      expect(result!.selector.strategy).toBe('role');
    });

    it('should fall back to CSS when testId and role are not useful', () => {
      const element: ElementInfo = {
        tagName: 'div',
        id: 'container',
        classNames: ['wrapper'],
        attributes: {},
      };

      const result = prioritizer.getBestSelector(element);

      expect(result!.selector.strategy).toBe('css');
    });

    it('should use XPath as last resort', () => {
      const element: ElementInfo = {
        tagName: 'span',
        classNames: [],
        textContent: 'Hello World',
        attributes: {},
      };

      const result = prioritizer.getBestSelector(element);

      // Could be CSS (tag only) or XPath
      expect(['css', 'xpath']).toContain(result!.selector.strategy);
    });
  });

  describe('prioritize', () => {
    it('should return all available selectors', () => {
      const element: ElementInfo = {
        tagName: 'button',
        id: 'submit',
        classNames: ['btn'],
        testId: 'submit-btn',
        role: 'button',
        ariaLabel: 'Submit',
        textContent: 'Submit',
        attributes: {},
      };

      const result = prioritizer.prioritize(element);

      expect(result).not.toBeNull();
      expect(result!.all.length).toBeGreaterThan(1);
      expect(result!.best.selector.strategy).toBe('testId');
    });

    it('should provide fallbacks', () => {
      const element: ElementInfo = {
        tagName: 'button',
        testId: 'submit',
        role: 'button',
        ariaLabel: 'Submit',
        classNames: [],
        attributes: {},
      };

      const result = prioritizer.prioritize(element);

      expect(result!.fallbacks.length).toBeGreaterThan(0);
      expect(result!.fallbacks[0].selector.strategy).not.toBe('testId');
    });

    it('should respect minScore option', () => {
      const element: ElementInfo = {
        tagName: 'div',
        classNames: [],
        attributes: {},
      };

      const result = prioritizer.prioritize(element, { minScore: 80 });

      // Low-quality selectors should be filtered out
      if (result) {
        for (const r of result.all) {
          expect(r.score).toBeGreaterThanOrEqual(80);
        }
      }
    });

    it('should respect requireUnique option', () => {
      const element: ElementInfo = {
        tagName: 'button',
        testId: 'submit',
        classNames: ['btn'],
        attributes: {},
      };

      const result = prioritizer.prioritize(element, { requireUnique: true });

      if (result) {
        for (const r of result.all) {
          expect(r.isUnique).toBe(true);
        }
      }
    });

    it('should respect maxFallbacks option', () => {
      const element: ElementInfo = {
        tagName: 'button',
        testId: 'submit',
        role: 'button',
        ariaLabel: 'Submit',
        id: 'submit-id',
        classNames: ['btn'],
        textContent: 'Submit',
        attributes: {},
      };

      const result = prioritizer.prioritize(element, { maxFallbacks: 1 });

      expect(result!.fallbacks.length).toBeLessThanOrEqual(1);
    });
  });

  describe('generateWithStrategy', () => {
    it('should generate selector with specific strategy', () => {
      const element: ElementInfo = {
        tagName: 'button',
        testId: 'submit',
        classNames: ['btn'],
        attributes: {},
      };

      const cssResult = prioritizer.generateWithStrategy(element, 'css');
      expect(cssResult).not.toBeNull();
      expect(cssResult!.selector.strategy).toBe('css');

      const testIdResult = prioritizer.generateWithStrategy(element, 'testId');
      expect(testIdResult!.selector.strategy).toBe('testId');
    });

    it('should return null for unavailable strategy', () => {
      const element: ElementInfo = {
        tagName: 'div',
        classNames: [],
        attributes: {},
      };

      const result = prioritizer.generateWithStrategy(element, 'testId');
      expect(result).toBeNull();
    });
  });

  describe('getAvailableStrategies', () => {
    it('should list all available strategies', () => {
      const element: ElementInfo = {
        tagName: 'button',
        testId: 'submit',
        role: 'button',
        classNames: ['btn'],
        attributes: {},
      };

      const strategies = prioritizer.getAvailableStrategies(element);

      expect(strategies).toContain('testId');
      expect(strategies).toContain('role');
      expect(strategies).toContain('css');
    });
  });
});

describe('getBestSelector helper', () => {
  it('should return selector object directly', () => {
    const element: ElementInfo = {
      tagName: 'button',
      testId: 'test-btn',
      classNames: [],
      attributes: {},
    };

    const selector = getBestSelector(element);

    expect(selector).not.toBeNull();
    expect(selector!.strategy).toBe('testId');
    expect(selector!.value).toBe('test-btn');
  });
});

describe('selectorToQueryString', () => {
  it('should convert testId selector', () => {
    const query = selectorToQueryString({
      strategy: 'testId',
      value: 'submit-btn',
    });

    expect(query).toBe('[data-testid="submit-btn"]');
  });

  it('should convert role selector with name', () => {
    const query = selectorToQueryString({
      strategy: 'role',
      value: 'button[name="Submit"]',
      role: 'button',
      name: 'Submit',
    });

    expect(query).toContain('role="button"');
    expect(query).toContain('aria-label="Submit"');
  });

  it('should pass through CSS selector', () => {
    const query = selectorToQueryString({
      strategy: 'css',
      value: '#main .btn-primary',
    });

    expect(query).toBe('#main .btn-primary');
  });

  it('should prefix XPath selector', () => {
    const query = selectorToQueryString({
      strategy: 'xpath',
      value: '//button[@id="submit"]',
    });

    expect(query.startsWith('xpath:')).toBe(true);
  });
});

describe('SELECTOR_PRIORITY', () => {
  it('should have correct priority order', () => {
    expect(SELECTOR_PRIORITY[0]).toBe('testId');
    expect(SELECTOR_PRIORITY[1]).toBe('role');
    expect(SELECTOR_PRIORITY[2]).toBe('css');
    expect(SELECTOR_PRIORITY[3]).toBe('xpath');
  });
});
