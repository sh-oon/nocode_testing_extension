// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTION_CHECKS,
  checkActionability,
  type ActionabilityChecks,
} from '../actionability';
import { PuppeteerAdapter, type PuppeteerPageLike } from '../adapters/puppeteer-adapter';

// ─── checkActionability pure function tests (jsdom) ─────────────

const ALL_CHECKS: ActionabilityChecks = {
  attached: true,
  visible: true,
  enabled: true,
  stable: true,
  receivesEvents: true,
  editable: true,
};

const NO_CHECKS: ActionabilityChecks = {
  attached: false,
  visible: false,
  enabled: false,
  stable: false,
  receivesEvents: false,
  editable: false,
};

function createElement(
  tag: string,
  attrs: Record<string, string> = {},
  style: Partial<CSSStyleDeclaration> = {},
): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  Object.assign(el.style, style);
  document.body.appendChild(el);
  return el;
}

describe('checkActionability', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // ── attached ──

  it('should fail for detached element', () => {
    const el = document.createElement('button');
    // NOT appended to DOM
    const result = checkActionability(el, { ...NO_CHECKS, attached: true });
    expect(result.passed).toBe(false);
    expect(result.failure?.check).toBe('attached');
    expect(result.failure?.message).toContain('detached');
  });

  it('should pass for attached element', () => {
    const el = createElement('button');
    const result = checkActionability(el, { ...NO_CHECKS, attached: true });
    expect(result.passed).toBe(true);
  });

  // ── visible ──

  it('should fail for display:none', () => {
    const el = createElement('button', {}, { display: 'none' });
    const result = checkActionability(el, { ...NO_CHECKS, visible: true });
    expect(result.passed).toBe(false);
    expect(result.failure?.check).toBe('visible');
    expect(result.failure?.message).toContain('display:none');
  });

  it('should fail for visibility:hidden', () => {
    const el = createElement('button', {}, { visibility: 'hidden' });
    const result = checkActionability(el, { ...NO_CHECKS, visible: true });
    expect(result.passed).toBe(false);
    expect(result.failure?.message).toContain('visibility:hidden');
  });

  it('should fail for opacity:0', () => {
    const el = createElement('button', {}, { opacity: '0' });
    const result = checkActionability(el, { ...NO_CHECKS, visible: true });
    expect(result.passed).toBe(false);
    expect(result.failure?.message).toContain('opacity:0');
  });

  // ── enabled ──

  it('should fail for disabled button', () => {
    const el = createElement('button', { disabled: '' });
    const result = checkActionability(el, { ...NO_CHECKS, enabled: true });
    expect(result.passed).toBe(false);
    expect(result.failure?.check).toBe('enabled');
    expect(result.failure?.message).toContain('disabled');
  });

  it('should fail for aria-disabled="true"', () => {
    const el = createElement('button', { 'aria-disabled': 'true' });
    const result = checkActionability(el, { ...NO_CHECKS, enabled: true });
    expect(result.passed).toBe(false);
    expect(result.failure?.message).toContain('aria-disabled');
  });

  it('should fail for element inside disabled fieldset', () => {
    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    const input = document.createElement('input');
    fieldset.appendChild(input);
    document.body.appendChild(fieldset);

    const result = checkActionability(input, { ...NO_CHECKS, enabled: true });
    expect(result.passed).toBe(false);
    expect(result.failure?.message).toContain('disabled fieldset');
  });

  it('should pass for element inside legend of disabled fieldset', () => {
    const fieldset = document.createElement('fieldset');
    fieldset.disabled = true;
    const legend = document.createElement('legend');
    const input = document.createElement('input');
    legend.appendChild(input);
    fieldset.appendChild(legend);
    document.body.appendChild(fieldset);

    const result = checkActionability(input, { ...NO_CHECKS, enabled: true });
    expect(result.passed).toBe(true);
  });

  it('should pass for enabled button', () => {
    const el = createElement('button');
    const result = checkActionability(el, { ...NO_CHECKS, enabled: true });
    expect(result.passed).toBe(true);
  });

  // ── editable ──

  it('should fail for readonly input', () => {
    const el = createElement('input', { readonly: '' }) as HTMLInputElement;
    el.readOnly = true;
    const result = checkActionability(el, { ...NO_CHECKS, editable: true });
    expect(result.passed).toBe(false);
    expect(result.failure?.check).toBe('editable');
    expect(result.failure?.message).toContain('readonly');
  });

  it('should fail for aria-readonly="true"', () => {
    const el = createElement('input', { 'aria-readonly': 'true' });
    const result = checkActionability(el, { ...NO_CHECKS, editable: true });
    expect(result.passed).toBe(false);
    expect(result.failure?.message).toContain('aria-readonly');
  });

  it('should fail for non-editable element (e.g. div)', () => {
    const el = createElement('div');
    const result = checkActionability(el, { ...NO_CHECKS, editable: true });
    expect(result.passed).toBe(false);
    expect(result.failure?.message).toContain('not an editable field');
  });

  it('should pass for contentEditable element', () => {
    const el = createElement('div', { contenteditable: 'true' });
    const result = checkActionability(el, { ...NO_CHECKS, editable: true });
    expect(result.passed).toBe(true);
  });

  it('should pass for writable input', () => {
    const el = createElement('input');
    const result = checkActionability(el, { ...NO_CHECKS, editable: true });
    expect(result.passed).toBe(true);
  });

  // ── all checks passing ──

  it('should return passed with boundingRect when all non-layout checks pass', () => {
    const el = createElement('input');
    // Note: visible check is skipped because jsdom returns zero-size boundingRect
    const result = checkActionability(el, {
      attached: true,
      visible: false,
      enabled: true,
      stable: false,
      receivesEvents: false,
      editable: true,
    });
    expect(result.passed).toBe(true);
    expect(result.boundingRect).toBeDefined();
  });

  // ── action-specific check mapping ──

  it('hover action should NOT check enabled', () => {
    const checks = ACTION_CHECKS.hover;
    expect(checks.enabled).toBe(false);
    expect(checks.editable).toBe(false);
    expect(checks.stable).toBe(true);
    expect(checks.receivesEvents).toBe(true);
  });

  it('type action should NOT check stable/receivesEvents, but should check editable', () => {
    const checks = ACTION_CHECKS.type;
    expect(checks.stable).toBe(false);
    expect(checks.receivesEvents).toBe(false);
    expect(checks.editable).toBe(true);
    expect(checks.enabled).toBe(true);
  });

  it('click action should check enabled/stable/receivesEvents but NOT editable', () => {
    const checks = ACTION_CHECKS.click;
    expect(checks.enabled).toBe(true);
    expect(checks.stable).toBe(true);
    expect(checks.receivesEvents).toBe(true);
    expect(checks.editable).toBe(false);
  });

  it('select action should check enabled but NOT stable/receivesEvents/editable', () => {
    const checks = ACTION_CHECKS.select;
    expect(checks.enabled).toBe(true);
    expect(checks.stable).toBe(false);
    expect(checks.receivesEvents).toBe(false);
    expect(checks.editable).toBe(false);
  });
});

// ─── PuppeteerAdapter integration tests ─────────────────────────

function createMockPage(): PuppeteerPageLike {
  return {
    goto: vi.fn().mockResolvedValue(undefined),
    $: vi.fn(),
    $$: vi.fn(),
    $x: vi.fn(),
    click: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
      down: vi.fn().mockResolvedValue(undefined),
      up: vi.fn().mockResolvedValue(undefined),
    },
    hover: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockResolvedValue([]),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    waitForNavigation: vi.fn().mockResolvedValue(undefined),
    waitForNetworkIdle: vi.fn().mockResolvedValue(undefined),
    url: vi.fn().mockReturnValue('about:blank'),
    title: vi.fn().mockResolvedValue(''),
    screenshot: vi.fn(),
    evaluate: vi.fn().mockResolvedValue(undefined),
    setRequestInterception: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
  };
}

describe('PuppeteerAdapter actionability integration', () => {
  it('should call page.evaluate with ACTIONABILITY_POLL_FN before click', async () => {
    const page = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.click('#btn');

    // First evaluate call should be the actionability poll
    const evaluateCalls = (page.evaluate as ReturnType<typeof vi.fn>).mock.calls;
    expect(evaluateCalls.length).toBeGreaterThanOrEqual(1);

    const [fnStr, selector, checksJson, timeout] = evaluateCalls[0];
    expect(fnStr).toContain('runChecks');
    expect(selector).toBe('#btn');

    const checks = JSON.parse(checksJson);
    expect(checks.attached).toBe(true);
    expect(checks.enabled).toBe(true);
    expect(checks.stable).toBe(true);
    expect(checks.receivesEvents).toBe(true);
    expect(checks.editable).toBe(false);

    expect(timeout).toBe(30000);
  });

  it('should call page.evaluate with ACTIONABILITY_POLL_FN before type', async () => {
    const page = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.type('#input', 'hello');

    const evaluateCalls = (page.evaluate as ReturnType<typeof vi.fn>).mock.calls;
    const [, , checksJson] = evaluateCalls[0];
    const checks = JSON.parse(checksJson);
    expect(checks.editable).toBe(true);
    expect(checks.stable).toBe(false);
    expect(checks.receivesEvents).toBe(false);
  });

  it('should call page.evaluate with ACTIONABILITY_POLL_FN before hover', async () => {
    const page = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.hover('#link');

    const evaluateCalls = (page.evaluate as ReturnType<typeof vi.fn>).mock.calls;
    const [, , checksJson] = evaluateCalls[0];
    const checks = JSON.parse(checksJson);
    expect(checks.enabled).toBe(false);
    expect(checks.stable).toBe(true);
  });

  it('should call page.evaluate with ACTIONABILITY_POLL_FN before select', async () => {
    const page = createMockPage();
    const adapter = new PuppeteerAdapter({ page });

    await adapter.select('#dropdown', 'opt1');

    const evaluateCalls = (page.evaluate as ReturnType<typeof vi.fn>).mock.calls;
    const [, , checksJson] = evaluateCalls[0];
    const checks = JSON.parse(checksJson);
    expect(checks.enabled).toBe(true);
    expect(checks.stable).toBe(false);
  });

  it('should propagate actionability failure as error', async () => {
    const page = createMockPage();
    (page.evaluate as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Actionability timeout after 30000ms: Element is disabled'),
    );

    const adapter = new PuppeteerAdapter({ page });

    await expect(adapter.click('#btn')).rejects.toThrow('Element is disabled');
  });
});
