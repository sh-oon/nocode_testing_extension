// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ASSERT_ELEMENT_EVAL_SCRIPT,
  type AssertionInput,
  type AssertionResult,
  runElementAssertion,
} from '../assert-element-logic';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createElement(
  tag: string,
  attrs: Record<string, string> = {},
  textContent?: string
): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  if (textContent !== undefined) {
    el.textContent = textContent;
  }
  document.body.appendChild(el);
  return el;
}

/**
 * Make getComputedStyle return a visible style (display:block, visibility:visible, opacity:1)
 * and getBoundingClientRect return a non-zero rect.
 */
function mockVisibleElement(el: HTMLElement): void {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    display: 'block',
    visibility: 'visible',
    opacity: '1',
  } as CSSStyleDeclaration);

  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    width: 100,
    height: 40,
    top: 0,
    left: 0,
    bottom: 40,
    right: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

/**
 * Make getComputedStyle return an invisible style variant.
 */
function mockInvisibleElement(
  el: HTMLElement,
  overrides: Partial<{ display: string; visibility: string; opacity: string }> = {}
): void {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    display: overrides.display ?? 'none',
    visibility: overrides.visibility ?? 'visible',
    opacity: overrides.opacity ?? '1',
  } as CSSStyleDeclaration);

  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

// ─── runElementAssertion ─────────────────────────────────────────────────────

describe('runElementAssertion', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // ── visible ──────────────────────────────────────────────────────────────

  describe('visible', () => {
    it('passes when element exists and is visible', () => {
      const el = createElement('button');
      mockVisibleElement(el);

      const result = runElementAssertion([el], { type: 'visible' });

      expect(result.passed).toBe(true);
      expect(result.message).toBe('Element is visible');
    });

    it('fails when element is hidden via display:none', () => {
      const el = createElement('button');
      mockInvisibleElement(el, { display: 'none' });

      const result = runElementAssertion([el], { type: 'visible' });

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Element is not visible');
    });

    it('fails when element list is empty', () => {
      const result = runElementAssertion([], { type: 'visible' });

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Element is not visible');
    });

    it('fails when element has visibility:hidden', () => {
      const el = createElement('div');
      mockInvisibleElement(el, { display: 'block', visibility: 'hidden' });

      const result = runElementAssertion([el], { type: 'visible' });

      expect(result.passed).toBe(false);
    });

    it('fails when element has opacity:0', () => {
      const el = createElement('div');
      mockInvisibleElement(el, { display: 'block', visibility: 'visible', opacity: '0' });

      const result = runElementAssertion([el], { type: 'visible' });

      expect(result.passed).toBe(false);
    });
  });

  // ── hidden ───────────────────────────────────────────────────────────────

  describe('hidden', () => {
    it('passes when element list is empty', () => {
      const result = runElementAssertion([], { type: 'hidden' });

      expect(result.passed).toBe(true);
      expect(result.message).toBe('Element is hidden');
    });

    it('passes when element has display:none', () => {
      const el = createElement('div');
      mockInvisibleElement(el, { display: 'none' });

      const result = runElementAssertion([el], { type: 'hidden' });

      expect(result.passed).toBe(true);
      expect(result.message).toBe('Element is hidden');
    });

    it('fails when element is fully visible', () => {
      const el = createElement('button');
      mockVisibleElement(el);

      const result = runElementAssertion([el], { type: 'hidden' });

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Element is visible but expected hidden');
    });
  });

  // ── exists ───────────────────────────────────────────────────────────────

  describe('exists', () => {
    it('passes when at least one element is present', () => {
      const el = createElement('span');

      const result = runElementAssertion([el], { type: 'exists' });

      expect(result.passed).toBe(true);
      expect(result.message).toBe('Element exists');
    });

    it('fails when element list is empty', () => {
      const result = runElementAssertion([], { type: 'exists' });

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Element does not exist');
    });
  });

  // ── notExists ────────────────────────────────────────────────────────────

  describe('notExists', () => {
    it('passes when element list is empty', () => {
      const result = runElementAssertion([], { type: 'notExists' });

      expect(result.passed).toBe(true);
      expect(result.message).toBe('Element does not exist as expected');
    });

    it('fails when element is present', () => {
      const el = createElement('div');

      const result = runElementAssertion([el], { type: 'notExists' });

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Element exists but expected not to');
    });
  });

  // ── text ─────────────────────────────────────────────────────────────────

  describe('text', () => {
    describe('exact match (default)', () => {
      it('passes when text content matches exactly', () => {
        const el = createElement('p', {}, 'Hello World');

        const result = runElementAssertion([el], { type: 'text', value: 'Hello World' });

        expect(result.passed).toBe(true);
        expect(result.message).toBe('Text matches "Hello World"');
      });

      it('fails when text content does not match', () => {
        const el = createElement('p', {}, 'Hello World');

        const result = runElementAssertion([el], { type: 'text', value: 'Goodbye' });

        expect(result.passed).toBe(false);
        expect(result.message).toContain('expected: "Goodbye"');
        expect(result.message).toContain('actual: "Hello World"');
      });

      it('passes when trimmed values match despite surrounding whitespace', () => {
        const el = createElement('p', {}, '  trimmed  ');

        const result = runElementAssertion([el], { type: 'text', value: 'trimmed' });

        expect(result.passed).toBe(true);
      });

      it('passes with empty expected value when element has no text', () => {
        const el = createElement('div');

        const result = runElementAssertion([el], { type: 'text', value: '' });

        expect(result.passed).toBe(true);
      });
    });

    describe('contains match', () => {
      it('passes when text contains the expected substring', () => {
        const el = createElement('p', {}, 'The quick brown fox');

        const result = runElementAssertion([el], {
          type: 'text',
          value: 'quick brown',
          contains: true,
        });

        expect(result.passed).toBe(true);
        expect(result.message).toBe('Text contains "quick brown"');
      });

      it('fails when text does not contain the expected substring', () => {
        const el = createElement('p', {}, 'Hello World');

        const result = runElementAssertion([el], {
          type: 'text',
          value: 'missing',
          contains: true,
        });

        expect(result.passed).toBe(false);
        expect(result.message).toContain('does not contain "missing"');
        expect(result.message).toContain('"Hello World"');
      });
    });
  });

  // ── attribute ────────────────────────────────────────────────────────────

  describe('attribute', () => {
    describe('existence check (no value)', () => {
      it('passes when attribute exists', () => {
        const el = createElement('input', { 'data-testid': 'my-input' });

        const result = runElementAssertion([el], { type: 'attribute', name: 'data-testid' });

        expect(result.passed).toBe(true);
        expect(result.message).toBe('Attribute "data-testid" exists');
      });

      it('fails when attribute does not exist', () => {
        const el = createElement('input');

        const result = runElementAssertion([el], { type: 'attribute', name: 'data-testid' });

        expect(result.passed).toBe(false);
        expect(result.message).toBe('Attribute "data-testid" does not exist');
      });
    });

    describe('value match', () => {
      it('passes when attribute value matches expected', () => {
        const el = createElement('a', { href: 'https://example.com' });

        const result = runElementAssertion([el], {
          type: 'attribute',
          name: 'href',
          value: 'https://example.com',
        });

        expect(result.passed).toBe(true);
        expect(result.message).toBe('Attribute "href" equals "https://example.com"');
      });

      it('fails when attribute value does not match', () => {
        const el = createElement('a', { href: 'https://example.com' });

        const result = runElementAssertion([el], {
          type: 'attribute',
          name: 'href',
          value: 'https://other.com',
        });

        expect(result.passed).toBe(false);
        expect(result.message).toContain('expected: "https://other.com"');
        expect(result.message).toContain('actual: "https://example.com"');
      });
    });

    describe('boolean attributes (checked / disabled)', () => {
      it('passes existence check for checked attribute', () => {
        const el = createElement('input', { type: 'checkbox', checked: '' });

        const result = runElementAssertion([el], { type: 'attribute', name: 'checked' });

        expect(result.passed).toBe(true);
      });

      it('passes existence check for disabled attribute', () => {
        const el = createElement('button', { disabled: '' });

        const result = runElementAssertion([el], { type: 'attribute', name: 'disabled' });

        expect(result.passed).toBe(true);
      });

      it('fails existence check for absent checked attribute', () => {
        const el = createElement('input', { type: 'checkbox' });

        const result = runElementAssertion([el], { type: 'attribute', name: 'checked' });

        expect(result.passed).toBe(false);
      });
    });
  });

  // ── count ────────────────────────────────────────────────────────────────

  describe('count', () => {
    const makeElements = (n: number): HTMLElement[] =>
      Array.from({ length: n }, () => createElement('li'));

    it('passes with eq operator when count matches exactly', () => {
      const result = runElementAssertion(makeElements(3), {
        type: 'count',
        value: 3,
        operator: 'eq',
      });

      expect(result.passed).toBe(true);
      expect(result.message).toContain('3 eq 3');
    });

    it('fails with eq operator when count differs', () => {
      const result = runElementAssertion(makeElements(2), {
        type: 'count',
        value: 3,
        operator: 'eq',
      });

      expect(result.passed).toBe(false);
      expect(result.message).toContain('2 is not eq 3');
    });

    it('passes with gt operator when count is greater', () => {
      const result = runElementAssertion(makeElements(5), {
        type: 'count',
        value: 3,
        operator: 'gt',
      });

      expect(result.passed).toBe(true);
    });

    it('fails with gt operator when count is equal', () => {
      const result = runElementAssertion(makeElements(3), {
        type: 'count',
        value: 3,
        operator: 'gt',
      });

      expect(result.passed).toBe(false);
    });

    it('passes with gte operator when count equals threshold', () => {
      const result = runElementAssertion(makeElements(3), {
        type: 'count',
        value: 3,
        operator: 'gte',
      });

      expect(result.passed).toBe(true);
    });

    it('fails with gte operator when count is below threshold', () => {
      const result = runElementAssertion(makeElements(2), {
        type: 'count',
        value: 3,
        operator: 'gte',
      });

      expect(result.passed).toBe(false);
    });

    it('passes with lt operator when count is less', () => {
      const result = runElementAssertion(makeElements(2), {
        type: 'count',
        value: 5,
        operator: 'lt',
      });

      expect(result.passed).toBe(true);
    });

    it('fails with lt operator when count equals threshold', () => {
      const result = runElementAssertion(makeElements(5), {
        type: 'count',
        value: 5,
        operator: 'lt',
      });

      expect(result.passed).toBe(false);
    });

    it('passes with lte operator when count equals threshold', () => {
      const result = runElementAssertion(makeElements(4), {
        type: 'count',
        value: 4,
        operator: 'lte',
      });

      expect(result.passed).toBe(true);
    });

    it('fails with lte operator when count exceeds threshold', () => {
      const result = runElementAssertion(makeElements(6), {
        type: 'count',
        value: 4,
        operator: 'lte',
      });

      expect(result.passed).toBe(false);
    });

    it('defaults to eq operator when operator is omitted', () => {
      const result = runElementAssertion(makeElements(2), { type: 'count', value: 2 });

      expect(result.passed).toBe(true);
    });
  });

  // ── enabled ──────────────────────────────────────────────────────────────

  describe('enabled', () => {
    it('passes when element does not have disabled attribute', () => {
      const el = createElement('button');

      const result = runElementAssertion([el], { type: 'enabled' });

      expect(result.passed).toBe(true);
      expect(result.message).toBe('Element is enabled');
    });

    it('fails when element has disabled attribute', () => {
      const el = createElement('button', { disabled: '' });

      const result = runElementAssertion([el], { type: 'enabled' });

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Element is disabled but expected enabled');
    });

    it('fails when element list is empty (treated as disabled)', () => {
      const result = runElementAssertion([], { type: 'enabled' });

      expect(result.passed).toBe(false);
    });

    it('passes for an enabled input element', () => {
      const el = createElement('input', { type: 'text' });

      const result = runElementAssertion([el], { type: 'enabled' });

      expect(result.passed).toBe(true);
    });
  });

  // ── value ─────────────────────────────────────────────────────────────────

  describe('value', () => {
    it('passes when input value matches expected', () => {
      const el = createElement('input') as HTMLInputElement;
      (el as HTMLInputElement).value = 'hello@example.com';

      const result = runElementAssertion([el], {
        type: 'value',
        value: 'hello@example.com',
      });

      expect(result.passed).toBe(true);
      expect(result.message).toBe('Value matches "hello@example.com"');
    });

    it('fails when input value does not match expected', () => {
      const el = createElement('input') as HTMLInputElement;
      (el as HTMLInputElement).value = 'actual-value';

      const result = runElementAssertion([el], { type: 'value', value: 'expected-value' });

      expect(result.passed).toBe(false);
      expect(result.message).toContain('expected: "expected-value"');
      expect(result.message).toContain('actual: "actual-value"');
    });

    it('passes for a textarea element with matching value', () => {
      const el = createElement('textarea') as HTMLTextAreaElement;
      (el as HTMLTextAreaElement).value = 'multi\nline';

      const result = runElementAssertion([el], { type: 'value', value: 'multi\nline' });

      expect(result.passed).toBe(true);
    });

    it('passes for empty value expectation on fresh input', () => {
      const el = createElement('input');

      const result = runElementAssertion([el], { type: 'value', value: '' });

      expect(result.passed).toBe(true);
    });

    it('fails when element list is empty', () => {
      const result = runElementAssertion([], { type: 'value', value: 'something' });

      expect(result.passed).toBe(false);
      expect(result.message).toContain('actual: ""');
    });
  });

  // ── unknown type fallback ─────────────────────────────────────────────────

  describe('unknown assertion type', () => {
    it('returns failed result with descriptive message', () => {
      const el = createElement('div');

      const result = runElementAssertion([el], { type: 'nonExistent' } as AssertionInput);

      expect(result.passed).toBe(false);
      expect(result.message).toBe('Unknown assertion type: nonExistent');
    });

    it('fails even with empty element list', () => {
      const result = runElementAssertion([], { type: 'bogusCheck' } as AssertionInput);

      expect(result.passed).toBe(false);
      expect(result.message).toContain('Unknown assertion type: bogusCheck');
    });
  });
});

// ─── ASSERT_ELEMENT_EVAL_SCRIPT (serialized page.evaluate string) ────────────
//
// We verify the script by executing it through a Function constructor to simulate
// what page.evaluate does — it serialises elements via querySelectorAll inside
// the injected script, so we seed the document and pass a CSS selector string.

describe('ASSERT_ELEMENT_EVAL_SCRIPT', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  /**
   * Run the eval script the same way page.evaluate would.
   *
   * The IIFE uses `arguments[0]` / `arguments[1]` to receive the selector and
   * assertion object.  We strip the trailing `()` self-invocation and convert
   * it into a named function so we can call it with explicit arguments.
   */
  function runScript(selector: string, assertion: AssertionInput): AssertionResult {
    // ASSERT_ELEMENT_EVAL_SCRIPT ends with `)()`
    // We drop the final `()` and call the resulting function ourselves so that
    // arguments[0] and arguments[1] are properly populated.
    const scriptWithoutInvocation = ASSERT_ELEMENT_EVAL_SCRIPT.replace(/\)\(\)\s*$/, ')');
    // biome-ignore lint/security/noNewFunction: intentional — mirrors page.evaluate execution model
    const iife = new Function(`return ${scriptWithoutInvocation}`)() as (
      s: string,
      a: AssertionInput
    ) => AssertionResult;
    return iife(selector, assertion);
  }

  it('exists: passes when element is present in DOM', () => {
    const el = document.createElement('button');
    el.id = 'submit-btn';
    document.body.appendChild(el);

    const result = runScript('#submit-btn', { type: 'exists' });

    expect(result.passed).toBe(true);
    expect(result.message).toBe('Element exists');
  });

  it('exists: fails when selector matches nothing', () => {
    const result = runScript('#ghost', { type: 'exists' });

    expect(result.passed).toBe(false);
    expect(result.message).toBe('Element does not exist');
  });

  it('notExists: passes when selector matches nothing', () => {
    const result = runScript('#ghost', { type: 'notExists' });

    expect(result.passed).toBe(true);
  });

  it('notExists: fails when element is present', () => {
    const el = document.createElement('div');
    el.id = 'present';
    document.body.appendChild(el);

    const result = runScript('#present', { type: 'notExists' });

    expect(result.passed).toBe(false);
  });

  it('text (exact): passes for matching textContent', () => {
    const p = document.createElement('p');
    p.id = 'para';
    p.textContent = 'Hello';
    document.body.appendChild(p);

    const result = runScript('#para', { type: 'text', value: 'Hello' });

    expect(result.passed).toBe(true);
  });

  it('text (contains): fails for non-matching substring', () => {
    const p = document.createElement('p');
    p.id = 'para';
    p.textContent = 'World';
    document.body.appendChild(p);

    const result = runScript('#para', { type: 'text', value: 'missing', contains: true });

    expect(result.passed).toBe(false);
  });

  it('attribute existence: passes when attribute is present', () => {
    const input = document.createElement('input');
    input.id = 'the-input';
    input.setAttribute('data-testid', 'login-field');
    document.body.appendChild(input);

    const result = runScript('#the-input', { type: 'attribute', name: 'data-testid' });

    expect(result.passed).toBe(true);
  });

  it('attribute value: fails on mismatch', () => {
    const a = document.createElement('a');
    a.id = 'link';
    a.setAttribute('href', '/home');
    document.body.appendChild(a);

    const result = runScript('#link', { type: 'attribute', name: 'href', value: '/about' });

    expect(result.passed).toBe(false);
  });

  it('count (eq): passes for correct element count', () => {
    for (let i = 0; i < 3; i++) {
      const li = document.createElement('li');
      li.className = 'item';
      document.body.appendChild(li);
    }

    const result = runScript('.item', { type: 'count', value: 3, operator: 'eq' });

    expect(result.passed).toBe(true);
  });

  it('count (lt): fails when count equals threshold', () => {
    for (let i = 0; i < 2; i++) {
      const li = document.createElement('li');
      li.className = 'row';
      document.body.appendChild(li);
    }

    const result = runScript('.row', { type: 'count', value: 2, operator: 'lt' });

    expect(result.passed).toBe(false);
  });

  it('enabled: passes for non-disabled button', () => {
    const btn = document.createElement('button');
    btn.id = 'go';
    document.body.appendChild(btn);

    const result = runScript('#go', { type: 'enabled' });

    expect(result.passed).toBe(true);
  });

  it('enabled: fails for disabled input', () => {
    const input = document.createElement('input');
    input.id = 'locked';
    input.setAttribute('disabled', '');
    document.body.appendChild(input);

    const result = runScript('#locked', { type: 'enabled' });

    expect(result.passed).toBe(false);
  });

  it('value: passes for matching input value', () => {
    const input = document.createElement('input');
    input.id = 'email';
    input.value = 'user@test.com';
    document.body.appendChild(input);

    const result = runScript('#email', { type: 'value', value: 'user@test.com' });

    expect(result.passed).toBe(true);
  });

  it('value: fails when input value differs', () => {
    const input = document.createElement('input');
    input.id = 'name';
    input.value = 'Alice';
    document.body.appendChild(input);

    const result = runScript('#name', { type: 'value', value: 'Bob' });

    expect(result.passed).toBe(false);
  });

  it('unknown type: returns failed result', () => {
    const div = document.createElement('div');
    div.id = 'x';
    document.body.appendChild(div);

    const result = runScript('#x', { type: 'unknown-type' } as AssertionInput);

    expect(result.passed).toBe(false);
    expect(result.message).toContain('Unknown assertion');
  });
});
