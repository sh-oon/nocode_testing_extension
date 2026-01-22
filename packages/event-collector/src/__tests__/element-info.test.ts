import { beforeEach, describe, expect, it } from 'vitest';
import {
  extractElementInfo,
  findInteractiveAncestor,
  isInteractiveElement,
  shouldIgnoreElement,
} from '../utils/element-info';

describe('extractElementInfo', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should extract basic element info', () => {
    document.body.innerHTML = `
      <button id="submit-btn" class="btn primary" data-testid="submit">
        Submit
      </button>
    `;
    const button = document.getElementById('submit-btn')!;
    const info = extractElementInfo(button);

    expect(info.tagName).toBe('button');
    expect(info.id).toBe('submit-btn');
    expect(info.classNames).toEqual(['btn', 'primary']);
    expect(info.testId).toBe('submit');
    expect(info.textContent).toBe('Submit');
  });

  it('should extract ARIA attributes', () => {
    document.body.innerHTML = `
      <div role="button" aria-label="Close dialog">X</div>
    `;
    const div = document.querySelector('div')!;
    const info = extractElementInfo(div);

    expect(info.role).toBe('button');
    expect(info.ariaLabel).toBe('Close dialog');
  });

  it('should extract implicit role for buttons', () => {
    document.body.innerHTML = '<button>Click me</button>';
    const button = document.querySelector('button')!;
    const info = extractElementInfo(button);

    expect(info.role).toBe('button');
  });

  it('should extract parent info', () => {
    document.body.innerHTML = `
      <form id="login-form">
        <input type="text" name="username" />
      </form>
    `;
    const input = document.querySelector('input')!;
    const info = extractElementInfo(input);

    expect(info.parent).toBeDefined();
    expect(info.parent?.tagName).toBe('form');
    expect(info.parent?.id).toBe('login-form');
  });

  it('should limit parent depth', () => {
    document.body.innerHTML = `
      <div id="level1">
        <div id="level2">
          <div id="level3">
            <div id="level4">
              <span id="target">Text</span>
            </div>
          </div>
        </div>
      </div>
    `;
    const target = document.getElementById('target')!;
    const info = extractElementInfo(target, 2);

    // Should have 2 levels of parents
    expect(info.parent).toBeDefined();
    expect(info.parent?.parent).toBeDefined();
    expect(info.parent?.parent?.parent).toBeUndefined();
  });

  it('should extract sibling information', () => {
    document.body.innerHTML = `
      <ul>
        <li>First</li>
        <li>Second</li>
        <li id="target">Third</li>
        <li>Fourth</li>
      </ul>
    `;
    const target = document.getElementById('target')!;
    const info = extractElementInfo(target);

    expect(info.siblingIndex).toBe(2);
    expect(info.siblingCount).toBe(4);
  });

  it('should extract relevant attributes', () => {
    document.body.innerHTML = `
      <input type="email" name="email" placeholder="Enter email" />
    `;
    const input = document.querySelector('input')!;
    const info = extractElementInfo(input);

    expect(info.attributes.type).toBe('email');
    expect(info.attributes.name).toBe('email');
    expect(info.attributes.placeholder).toBe('Enter email');
  });

  it('should build XPath', () => {
    document.body.innerHTML = `
      <div>
        <form>
          <input type="text" />
        </form>
      </div>
    `;
    const input = document.querySelector('input')!;
    const info = extractElementInfo(input);

    expect(info.xpath).toContain('form');
    expect(info.xpath).toContain('input');
  });
});

describe('isInteractiveElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should return true for buttons', () => {
    document.body.innerHTML = '<button>Click</button>';
    const button = document.querySelector('button')!;
    expect(isInteractiveElement(button)).toBe(true);
  });

  it('should return true for links', () => {
    document.body.innerHTML = '<a href="#">Link</a>';
    const link = document.querySelector('a')!;
    expect(isInteractiveElement(link)).toBe(true);
  });

  it('should return true for inputs', () => {
    document.body.innerHTML = '<input type="text" />';
    const input = document.querySelector('input')!;
    expect(isInteractiveElement(input)).toBe(true);
  });

  it('should return true for elements with button role', () => {
    document.body.innerHTML = '<div role="button">Click me</div>';
    const div = document.querySelector('div')!;
    expect(isInteractiveElement(div)).toBe(true);
  });

  it('should return true for elements with tabindex', () => {
    document.body.innerHTML = '<div tabindex="0">Focusable</div>';
    const div = document.querySelector('div')!;
    expect(isInteractiveElement(div)).toBe(true);
  });

  it('should return false for plain divs', () => {
    document.body.innerHTML = '<div>Not interactive</div>';
    const div = document.querySelector('div')!;
    expect(isInteractiveElement(div)).toBe(false);
  });
});

describe('findInteractiveAncestor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should find button ancestor', () => {
    document.body.innerHTML = `
      <button id="btn">
        <span id="text">Click me</span>
      </button>
    `;
    const span = document.getElementById('text')!;
    const ancestor = findInteractiveAncestor(span);

    expect(ancestor?.id).toBe('btn');
  });

  it('should return null if no interactive ancestor', () => {
    document.body.innerHTML = `
      <div>
        <span id="text">Just text</span>
      </div>
    `;
    const span = document.getElementById('text')!;
    const ancestor = findInteractiveAncestor(span);

    expect(ancestor).toBeNull();
  });

  it('should return element itself if interactive', () => {
    document.body.innerHTML = '<button id="btn">Click</button>';
    const button = document.getElementById('btn')!;
    const ancestor = findInteractiveAncestor(button);

    expect(ancestor?.id).toBe('btn');
  });
});

describe('shouldIgnoreElement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should ignore elements matching selector', () => {
    document.body.innerHTML = '<button class="ignore-me">Ignore</button>';
    const button = document.querySelector('button')!;

    expect(shouldIgnoreElement(button, ['.ignore-me'])).toBe(true);
  });

  it('should ignore elements inside ignored parent', () => {
    document.body.innerHTML = `
      <div class="toolbar">
        <button id="btn">Click</button>
      </div>
    `;
    const button = document.getElementById('btn')!;

    expect(shouldIgnoreElement(button, ['.toolbar'])).toBe(true);
  });

  it('should not ignore non-matching elements', () => {
    document.body.innerHTML = '<button class="submit">Submit</button>';
    const button = document.querySelector('button')!;

    expect(shouldIgnoreElement(button, ['.ignore-me'])).toBe(false);
  });
});
