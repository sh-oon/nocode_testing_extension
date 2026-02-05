import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { Selector, SelectorInput } from '@like-cake/ast-types';
import type { DomSnapshot, ScreenshotResult } from '@like-cake/dom-serializer';
import type {
  ClickOptions,
  FoundElement,
  NavigationOptions,
  PlaybackAdapter,
  ScrollOptions,
  TypeOptions,
  WaitOptions,
} from '../types';

/**
 * Puppeteer page interface (subset of actual Puppeteer Page)
 * This allows type-safe integration without requiring Puppeteer as a dependency
 */
export interface PuppeteerPageLike {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  $(selector: string): Promise<unknown>;
  $$(selector: string): Promise<unknown[]>;
  $x(xpath: string): Promise<unknown[]>;
  click(selector: string, options?: Record<string, unknown>): Promise<void>;
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>;
  keyboard: {
    press(key: string, options?: Record<string, unknown>): Promise<void>;
    down(key: string): Promise<void>;
    up(key: string): Promise<void>;
  };
  hover(selector: string): Promise<void>;
  select(selector: string, ...values: string[]): Promise<string[]>;
  waitForSelector(
    selector: string,
    options?: { visible?: boolean; hidden?: boolean; timeout?: number }
  ): Promise<unknown>;
  waitForNavigation(options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  waitForNetworkIdle(options?: { idleTime?: number; timeout?: number }): Promise<void>;
  url(): string;
  title(): Promise<string>;
  screenshot(options?: { fullPage?: boolean; encoding?: string }): Promise<Buffer | string>;
  evaluate<T>(fn: string | ((...args: unknown[]) => T), ...args: unknown[]): Promise<T>;
  setRequestInterception(enabled: boolean): Promise<void>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * Puppeteer adapter configuration
 */
export interface PuppeteerAdapterConfig {
  /** Puppeteer Page instance */
  page: PuppeteerPageLike;
  /** Default timeout for operations */
  defaultTimeout?: number;
}

/**
 * Resolves a SelectorInput to a selector usable by Puppeteer
 */
function resolveSelectorForPuppeteer(selector: SelectorInput): {
  type: 'css' | 'xpath';
  value: string;
} {
  if (typeof selector === 'string') {
    return { type: 'css', value: selector };
  }

  const sel = selector as Selector;

  switch (sel.strategy) {
    case 'testId':
      return { type: 'css', value: `[data-testid="${sel.value}"]` };
    case 'role': {
      const roleSelector = `[role="${sel.role}"]`;
      if (sel.name) {
        return { type: 'css', value: `${roleSelector}[aria-label="${sel.name}"]` };
      }
      return { type: 'css', value: roleSelector };
    }
    case 'css':
      return { type: 'css', value: sel.value };
    case 'xpath':
      return { type: 'xpath', value: sel.value };
    default:
      throw new Error('Invalid selector: no valid selector strategy found');
  }
}

/**
 * Puppeteer adapter - runs in Node.js with Puppeteer
 */
export class PuppeteerAdapter implements PlaybackAdapter {
  readonly name = 'puppeteer';

  private page: PuppeteerPageLike;
  private defaultTimeout: number;
  private apiCalls: CapturedApiCall[] = [];
  private requestHandler: ((request: unknown) => void) | null = null;
  private responseHandler: ((response: unknown) => void) | null = null;

  constructor(config: PuppeteerAdapterConfig) {
    this.page = config.page;
    this.defaultTimeout = config.defaultTimeout ?? 30000;
  }

  async initialize(): Promise<void> {
    // Puppeteer page should already be initialized
  }

  async destroy(): Promise<void> {
    await this.stopApiInterception();
    this.apiCalls = [];
  }

  async navigate(url: string, options?: NavigationOptions): Promise<void> {
    await this.page.goto(url, {
      waitUntil: options?.waitUntil ?? 'load',
      timeout: options?.timeout ?? this.defaultTimeout,
    });
  }

  async findElement(selector: SelectorInput, options?: WaitOptions): Promise<FoundElement> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const resolved = resolveSelectorForPuppeteer(selector);

    try {
      let element: unknown;

      if (resolved.type === 'xpath') {
        await this.page.waitForSelector(`xpath/${resolved.value}`, { timeout });
        const elements = await this.page.$x(resolved.value);
        element = elements[0];
      } else {
        await this.page.waitForSelector(resolved.value, { timeout });
        element = await this.page.$(resolved.value);
      }

      if (!element) {
        return { found: false };
      }

      // Get element properties using page.evaluate
      const props = await this.page.evaluate(
        `(function(el) {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          const isVisible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0;

          const attrs = {};
          for (const attr of el.attributes) {
            attrs[attr.name] = attr.value;
          }

          return {
            boundingRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            isVisible,
            textContent: el.textContent ?? undefined,
            attributes: attrs,
          };
        })(arguments[0])`,
        element
      );

      const typedProps = props as {
        boundingRect: { x: number; y: number; width: number; height: number };
        isVisible: boolean;
        textContent: string;
        attributes: Record<string, string>;
      };

      return {
        found: true,
        element,
        ...typedProps,
      };
    } catch {
      return { found: false };
    }
  }

  private async getSelector(selector: SelectorInput): Promise<string> {
    const resolved = resolveSelectorForPuppeteer(selector);
    if (resolved.type === 'xpath') {
      return `xpath/${resolved.value}`;
    }
    return resolved.value;
  }

  async click(selector: SelectorInput, options?: ClickOptions): Promise<void> {
    const sel = await this.getSelector(selector);

    const clickOptions: Record<string, unknown> = {};
    if (options?.button) {
      clickOptions.button = options.button;
    }
    if (options?.clickCount) {
      clickOptions.clickCount = options.clickCount;
    }
    if (options?.position) {
      clickOptions.offset = options.position;
    }

    // Handle modifiers
    if (options?.modifiers?.length) {
      for (const mod of options.modifiers) {
        await this.page.keyboard.down(mod);
      }
    }

    await this.page.click(sel, clickOptions);

    if (options?.modifiers?.length) {
      for (const mod of options.modifiers) {
        await this.page.keyboard.up(mod);
      }
    }
  }

  async type(selector: SelectorInput, text: string, options?: TypeOptions): Promise<void> {
    const sel = await this.getSelector(selector);

    if (options?.clear) {
      // Triple-click to select all and then type
      await this.page.click(sel, { clickCount: 3 });
    }

    await this.page.type(sel, text, { delay: options?.delay });
  }

  async keypress(key: string, selector?: SelectorInput, modifiers?: string[]): Promise<void> {
    if (selector) {
      const sel = await this.getSelector(selector);
      await this.page.click(sel); // Focus the element
    }

    // Handle modifiers
    if (modifiers?.length) {
      for (const mod of modifiers) {
        await this.page.keyboard.down(mod);
      }
    }

    await this.page.keyboard.press(key);

    if (modifiers?.length) {
      for (const mod of modifiers) {
        await this.page.keyboard.up(mod);
      }
    }
  }

  async hover(selector: SelectorInput, _position?: { x: number; y: number }): Promise<void> {
    const sel = await this.getSelector(selector);
    await this.page.hover(sel);
  }

  async scroll(selector?: SelectorInput, options?: ScrollOptions): Promise<void> {
    if (selector) {
      const sel = await this.getSelector(selector);
      const behavior = options?.behavior ?? 'auto';
      await this.page.evaluate(
        `(function() {
          const el = document.querySelector(arguments[0]);
          el?.scrollIntoView({ behavior: arguments[1], block: 'center' });
        })()`,
        sel,
        behavior
      );
    } else if (options?.position) {
      const x = options.position.x;
      const y = options.position.y;
      const behavior = options.behavior ?? 'auto';
      await this.page.evaluate(
        `(function() {
          window.scrollTo({ left: arguments[0], top: arguments[1], behavior: arguments[2] });
        })()`,
        x,
        y,
        behavior
      );
    }
  }

  async select(selector: SelectorInput, values: string | string[]): Promise<void> {
    const sel = await this.getSelector(selector);
    const valueArray = Array.isArray(values) ? values : [values];
    await this.page.select(sel, ...valueArray);
  }

  async waitForSelector(
    selector: SelectorInput,
    state?: 'visible' | 'hidden' | 'attached' | 'detached',
    options?: WaitOptions
  ): Promise<void> {
    const sel = await this.getSelector(selector);

    const waitOptions: { visible?: boolean; hidden?: boolean; timeout?: number } = {
      timeout: options?.timeout ?? this.defaultTimeout,
    };

    if (state === 'visible') {
      waitOptions.visible = true;
    } else if (state === 'hidden' || state === 'detached') {
      waitOptions.hidden = true;
    }

    await this.page.waitForSelector(sel, waitOptions);
  }

  async waitForNavigation(options?: NavigationOptions): Promise<void> {
    await this.page.waitForNavigation({
      waitUntil: options?.waitUntil ?? 'load',
      timeout: options?.timeout ?? this.defaultTimeout,
    });
  }

  async waitForNetworkIdle(options?: WaitOptions): Promise<void> {
    await this.page.waitForNetworkIdle({
      idleTime: 500,
      timeout: options?.timeout ?? this.defaultTimeout,
    });
  }

  async wait(duration: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, duration));
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async captureSnapshot(options?: {
    computedStyles?: string[];
    fullPage?: boolean;
  }): Promise<DomSnapshot> {
    // Execute dom-serializer in page context
    const snapshot = await this.page.evaluate(
      `(function() {
        const opts = arguments[0] || {};
        // This assumes dom-serializer is injected into the page
        const serializer = window.__domSerializer;
        if (serializer) {
          return serializer.captureSnapshot({
            includeComputedStyles: !!(opts.computedStyles && opts.computedStyles.length),
            styleProperties: opts.computedStyles,
          });
        }
        throw new Error('DOM serializer not injected');
      })()`,
      options ?? {}
    );

    return snapshot as DomSnapshot;
  }

  async captureScreenshot(options?: { fullPage?: boolean }): Promise<ScreenshotResult> {
    const screenshot = await this.page.screenshot({
      fullPage: options?.fullPage,
      encoding: 'base64',
    });

    return {
      data: screenshot as string,
      format: 'png',
      width: 0, // Would need to get actual dimensions
      height: 0,
      timestamp: Date.now(),
    };
  }

  getApiCalls(): CapturedApiCall[] {
    return [...this.apiCalls];
  }

  clearApiCalls(): void {
    this.apiCalls = [];
  }

  async startApiInterception(): Promise<void> {
    await this.page.setRequestInterception(true);

    const requestIdMap = new Map<string, CapturedApiCall>();

    this.requestHandler = (request: unknown) => {
      const req = request as {
        url: () => string;
        method: () => string;
        headers: () => Record<string, string>;
        postData: () => string | undefined;
        continue: () => void;
      };

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const call: CapturedApiCall = {
        request: {
          id,
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          body: req.postData(),
          timestamp: Date.now(),
          initiator: 'fetch',
        },
        pending: true,
      };

      requestIdMap.set(req.url() + req.method(), call);
      this.apiCalls.push(call);

      req.continue();
    };

    this.responseHandler = (response: unknown) => {
      const res = response as {
        url: () => string;
        request: () => { method: () => string };
        status: () => number;
        statusText: () => string;
        headers: () => Record<string, string>;
        json: () => Promise<unknown>;
      };

      const key = res.url() + res.request().method();
      const call = requestIdMap.get(key);

      if (call) {
        const startTime = call.request.timestamp;
        call.response = {
          status: res.status(),
          statusText: res.statusText(),
          headers: res.headers(),
          body: undefined, // Would need async handling for body
          responseTime: Date.now() - startTime,
        };
        call.pending = false;
        requestIdMap.delete(key);
      }
    };

    this.page.on('request', this.requestHandler);
    this.page.on('response', this.responseHandler);
  }

  async stopApiInterception(): Promise<void> {
    if (this.requestHandler) {
      this.page.off('request', this.requestHandler);
      this.requestHandler = null;
    }
    if (this.responseHandler) {
      this.page.off('response', this.responseHandler);
      this.responseHandler = null;
    }
    await this.page.setRequestInterception(false);
  }

  async assertElement(
    selector: SelectorInput,
    assertion: {
      type: string;
      value?: unknown;
      name?: string;
      contains?: boolean;
      operator?: string;
    }
  ): Promise<{ passed: boolean; message: string }> {
    const sel = await this.getSelector(selector);

    const result = await this.page.evaluate(
      `(function() {
        const s = arguments[0];
        const a = arguments[1];
        const elements = document.querySelectorAll(s);
        const element = elements[0];

        const isVisible = (el) => {
          if (!el || !(el instanceof HTMLElement)) return false;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0
          );
        };

        switch (a.type) {
          case 'visible':
            return {
              passed: !!element && isVisible(element),
              message: element && isVisible(element) ? 'Element is visible' : 'Element is not visible',
            };
          case 'hidden':
            return {
              passed: !element || !isVisible(element),
              message: !element || !isVisible(element) ? 'Element is hidden' : 'Element is visible',
            };
          case 'exists':
            return { passed: !!element, message: element ? 'Element exists' : 'Element does not exist' };
          case 'notExists':
            return { passed: !element, message: !element ? 'Element does not exist' : 'Element exists' };
          case 'text': {
            const text = element?.textContent ?? '';
            const expected = String(a.value ?? '');
            if (a.contains) {
              return {
                passed: text.includes(expected),
                message: text.includes(expected)
                  ? 'Text contains "' + expected + '"'
                  : 'Text does not contain "' + expected + '"',
              };
            }
            return {
              passed: text.trim() === expected.trim(),
              message:
                text.trim() === expected.trim() ? 'Text matches' : 'Text does not match: "' + text + '" vs "' + expected + '"',
            };
          }
          case 'attribute': {
            const attrVal = element?.getAttribute(a.name ?? '');
            if (a.value === undefined) {
              return { passed: attrVal !== null, message: attrVal !== null ? 'Attribute exists' : 'Attribute missing' };
            }
            return { passed: attrVal === a.value, message: attrVal === a.value ? 'Attribute matches' : 'Attr mismatch' };
          }
          case 'count': {
            const count = elements.length;
            const expected = Number(a.value ?? 0);
            const op = a.operator ?? 'eq';
            let passed = false;
            switch (op) {
              case 'eq':
                passed = count === expected;
                break;
              case 'gt':
                passed = count > expected;
                break;
              case 'gte':
                passed = count >= expected;
                break;
              case 'lt':
                passed = count < expected;
                break;
              case 'lte':
                passed = count <= expected;
                break;
            }
            return { passed, message: 'Count: ' + count + ' ' + op + ' ' + expected + ' = ' + passed };
          }
          default:
            return { passed: false, message: 'Unknown assertion: ' + a.type };
        }
      })()`,
      sel,
      assertion
    );

    return result as { passed: boolean; message: string };
  }
}
