import { describe, expect, it } from 'vitest';
import {
  CssGenerator,
  isDynamicClass,
  RoleGenerator,
  TestIdGenerator,
  XPathGenerator,
} from '../generators';
import type { ElementInfo } from '../types';

describe('TestIdGenerator', () => {
  const generator = new TestIdGenerator();

  const elementWithTestId: ElementInfo = {
    tagName: 'button',
    classNames: [],
    testId: 'submit-button',
    attributes: {},
  };

  const elementWithoutTestId: ElementInfo = {
    tagName: 'button',
    classNames: ['btn'],
    attributes: {},
  };

  it('should generate selector for element with testId', () => {
    const result = generator.generate(elementWithTestId);

    expect(result).not.toBeNull();
    expect(result!.selector.strategy).toBe('testId');
    expect(result!.selector.value).toBe('submit-button');
    expect(result!.isUnique).toBe(true);
  });

  it('should return null for element without testId', () => {
    expect(generator.canGenerate(elementWithoutTestId)).toBe(false);
    expect(generator.generate(elementWithoutTestId)).toBeNull();
  });

  it('should have high score for semantic naming', () => {
    const result = generator.generate({
      ...elementWithTestId,
      testId: 'btn-submit',
    });

    expect(result!.score).toBeGreaterThanOrEqual(100);
  });

  it('should penalize very long testIds', () => {
    const longTestId = 'a'.repeat(60);
    const result = generator.generate({
      ...elementWithTestId,
      testId: longTestId,
    });

    expect(result!.score).toBeLessThan(100);
  });
});

describe('RoleGenerator', () => {
  const generator = new RoleGenerator();

  it('should generate selector for explicit role', () => {
    const element: ElementInfo = {
      tagName: 'div',
      classNames: [],
      role: 'button',
      ariaLabel: 'Submit',
      attributes: {},
    };

    const result = generator.generate(element);

    expect(result).not.toBeNull();
    expect(result!.selector.strategy).toBe('role');
    expect(result!.selector).toHaveProperty('role', 'button');
    expect(result!.selector).toHaveProperty('name', 'Submit');
  });

  it('should use implicit role for buttons', () => {
    const element: ElementInfo = {
      tagName: 'button',
      classNames: [],
      textContent: 'Click me',
      attributes: {},
    };

    const result = generator.generate(element);

    expect(result).not.toBeNull();
    expect(result!.selector).toHaveProperty('role', 'button');
    expect(result!.selector).toHaveProperty('name', 'Click me');
  });

  it('should use aria-label as accessible name', () => {
    const element: ElementInfo = {
      tagName: 'button',
      classNames: [],
      ariaLabel: 'Close dialog',
      textContent: 'X',
      attributes: {},
    };

    const result = generator.generate(element);

    expect(result!.selector).toHaveProperty('name', 'Close dialog');
  });

  it('should return higher score for interactive roles', () => {
    const button: ElementInfo = {
      tagName: 'button',
      classNames: [],
      ariaLabel: 'Submit',
      attributes: {},
    };

    const region: ElementInfo = {
      tagName: 'section',
      classNames: [],
      role: 'region',
      attributes: {},
    };

    const buttonResult = generator.generate(button);
    const regionResult = generator.generate(region);

    expect(buttonResult!.score).toBeGreaterThan(regionResult!.score);
  });
});

describe('CssGenerator', () => {
  const generator = new CssGenerator();

  it('should generate ID selector', () => {
    const element: ElementInfo = {
      tagName: 'div',
      id: 'main-content',
      classNames: [],
      attributes: {},
    };

    const result = generator.generate(element);

    expect(result!.selector.strategy).toBe('css');
    expect(result!.selector.value).toBe('#main-content');
    expect(result!.isUnique).toBe(true);
  });

  it('should skip dynamic-looking IDs', () => {
    const element: ElementInfo = {
      tagName: 'div',
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // UUID-like dynamic ID
      classNames: ['header'],
      attributes: {},
    };

    const result = generator.generate(element);

    // Should fall back to class selector since ID looks dynamic
    expect(result!.selector.value).not.toContain('#');
  });

  it('should filter out dynamic classes', () => {
    const element: ElementInfo = {
      tagName: 'div',
      classNames: ['header', 'css-abc123', 'sc-dkrFOg', 'main-nav'],
      attributes: {},
    };

    const result = generator.generate(element);

    // Should not include dynamic classes
    expect(result!.selector.value).not.toContain('css-');
    expect(result!.selector.value).not.toContain('sc-');
    expect(result!.selector.value).toContain('header');
  });

  it('should prefer BEM-like classes', () => {
    const element: ElementInfo = {
      tagName: 'div',
      classNames: ['container', 'nav__item--active'],
      attributes: {},
    };

    const result = generator.generate(element);

    expect(result!.selector.value).toContain('nav__item--active');
  });

  it('should generate attribute selector for semantic attributes', () => {
    const element: ElementInfo = {
      tagName: 'input',
      classNames: [],
      attributes: {
        name: 'email',
        type: 'email',
      },
    };

    const result = generator.generate(element);

    expect(result!.selector.value).toContain('[name=');
  });

  it('should generate positional selector when needed', () => {
    const element: ElementInfo = {
      tagName: 'li',
      classNames: [],
      attributes: {},
      siblingIndex: 2,
      siblingCount: 5,
    };

    const result = generator.generate(element);

    expect(result!.selector.value).toContain(':nth-of-type(3)');
  });
});

describe('XPathGenerator', () => {
  const generator = new XPathGenerator();

  it('should generate text-based XPath for buttons', () => {
    const element: ElementInfo = {
      tagName: 'button',
      classNames: [],
      textContent: 'Submit Form',
      attributes: {},
    };

    const result = generator.generate(element);

    expect(result!.selector.strategy).toBe('xpath');
    expect(result!.selector.value).toContain('text()');
    expect(result!.selector.value).toContain('Submit Form');
  });

  it('should generate attribute-based XPath', () => {
    const element: ElementInfo = {
      tagName: 'input',
      classNames: [],
      textContent: '',
      attributes: {
        name: 'username',
      },
    };

    const result = generator.generate(element);

    expect(result!.selector.value).toContain('@name="username"');
  });

  it('should skip text-based XPath for long content', () => {
    const element: ElementInfo = {
      tagName: 'button',
      classNames: [],
      textContent: 'a'.repeat(100),
      attributes: {},
    };

    const result = generator.generate(element);

    // Should not use text-based selector for long text (over 50 chars)
    // Result may be null or use a different strategy
    if (result) {
      expect(result.selector.value).not.toContain('text()');
    } else {
      expect(result).toBeNull();
    }
  });

  it('should use parent context when available', () => {
    const element: ElementInfo = {
      tagName: 'span',
      classNames: [],
      attributes: {},
      parent: {
        tagName: 'header',
        classNames: [],
        attributes: {},
      },
      siblingIndex: 0,
    };

    const result = generator.generate(element);

    expect(result!.selector.value).toContain('header');
  });
});

describe('isDynamicClass', () => {
  it('should detect CSS-in-JS patterns', () => {
    expect(isDynamicClass('css-1abc2de')).toBe(true);
    expect(isDynamicClass('sc-fzXqRJ')).toBe(true);
    expect(isDynamicClass('jsx-abc123')).toBe(true);
  });

  it('should not flag normal classes', () => {
    expect(isDynamicClass('button')).toBe(false);
    expect(isDynamicClass('nav__item')).toBe(false);
    expect(isDynamicClass('btn-primary')).toBe(false);
  });
});
