import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { Selector, SelectorInput } from '@like-cake/ast-types';
import type { DomSnapshot, ScreenshotResult } from '@like-cake/dom-serializer';
import { ACTION_CHECKS, ACTIONABILITY_POLL_FN } from '../actionability';
import { ASSERT_ELEMENT_EVAL_SCRIPT } from '../assert-element-logic';
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
  goBack(options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  goForward(options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  mouse: {
    move(x: number, y: number): Promise<void>;
  };
}

/**
 * Minimal CDP session interface for type-safe integration without requiring Puppeteer as a dependency.
 * Matches the subset of Puppeteer's CDPSession used for Network observation.
 */
export interface CDPSessionLike {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, handler: (params: unknown) => void): void;
  off(event: string, handler: (params: unknown) => void): void;
}

/**
 * Puppeteer adapter configuration
 */
export interface PuppeteerAdapterConfig {
  /** Puppeteer Page instance */
  page: PuppeteerPageLike;
  /** Optional CDP session for reliable Network-level API observation */
  cdpSession?: CDPSessionLike;
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
/**
 * CDP Network domain event payloads (subset used for API observation)
 */
interface CDPRequestWillBeSent {
  requestId: string;
  request: { url: string; method: string; headers: Record<string, string>; postData?: string };
  type: string;
  timestamp: number;
}

interface CDPResponseReceived {
  requestId: string;
  response: {
    url: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    mimeType: string;
  };
  type: string;
  timestamp: number;
}

interface CDPLoadingFinished {
  requestId: string;
  timestamp: number;
}

export class PuppeteerAdapter implements PlaybackAdapter {
  readonly name = 'puppeteer';

  private page: PuppeteerPageLike;
  private cdpSession: CDPSessionLike | null;
  private defaultTimeout: number;
  private apiCalls: CapturedApiCall[] = [];

  // Puppeteer-level interception state (fallback when no CDP session)
  private pendingRequests = new Map<unknown, CapturedApiCall>();
  private requestHandler: ((request: unknown) => void) | null = null;
  private responseHandler: ((response: unknown) => void) | null = null;

  // CDP-level observation state
  private cdpRequestMap = new Map<string, CapturedApiCall>();
  private cdpHandlers: {
    onRequest: ((params: unknown) => void) | null;
    onResponse: ((params: unknown) => void) | null;
    onFinished: ((params: unknown) => void) | null;
  } = { onRequest: null, onResponse: null, onFinished: null };

  constructor(config: PuppeteerAdapterConfig) {
    this.page = config.page;
    this.cdpSession = config.cdpSession ?? null;
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

  /**
   * Ensures an element is actionable by running Playwright-style checks
   * inside the browser context via page.evaluate.
   */
  private async ensureActionable(
    selector: SelectorInput,
    action: 'click' | 'hover' | 'type' | 'select',
    timeout?: number,
  ): Promise<void> {
    const sel = await this.getSelector(selector);
    const checks = ACTION_CHECKS[action];
    const timeoutMs = timeout ?? this.defaultTimeout;

    await this.page.evaluate(
      ACTIONABILITY_POLL_FN,
      sel,
      JSON.stringify(checks),
      timeoutMs,
    );
  }

  async click(selector: SelectorInput, options?: ClickOptions): Promise<void> {
    const sel = await this.getSelector(selector);
    await this.ensureActionable(selector, 'click');

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
    await this.ensureActionable(selector, 'type');

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
    await this.ensureActionable(selector, 'hover');
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
    await this.ensureActionable(selector, 'select');
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

  async waitForDomStable(options?: WaitOptions & { stabilityThreshold?: number }): Promise<void> {
    const stabilityThreshold = options?.stabilityThreshold ?? 1500;
    const timeout = options?.timeout ?? this.defaultTimeout;

    await this.page.evaluate(
      `(function() {
        var threshold = arguments[0];
        var maxTimeout = arguments[1];
        return new Promise(function(resolve, reject) {
          var timer = null;
          var globalTimer = setTimeout(function() {
            observer.disconnect();
            reject(new Error('DOM stability timeout after ' + maxTimeout + 'ms'));
          }, maxTimeout);

          var observer = new MutationObserver(function() {
            if (timer) clearTimeout(timer);
            timer = setTimeout(function() {
              observer.disconnect();
              clearTimeout(globalTimer);
              resolve(true);
            }, threshold);
          });

          observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
          });

          // If DOM is already stable, resolve after threshold
          timer = setTimeout(function() {
            observer.disconnect();
            clearTimeout(globalTimer);
            resolve(true);
          }, threshold);
        });
      })()`,
      stabilityThreshold,
      timeout
    );
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
    if (this.cdpSession) {
      await this.startCdpNetworkObservation();
    } else {
      await this.startPuppeteerInterception();
    }
  }

  async stopApiInterception(): Promise<void> {
    if (this.cdpSession) {
      await this.stopCdpNetworkObservation();
    } else {
      await this.stopPuppeteerInterception();
    }
  }

  // ─── CDP Network observation (preferred) ──────────────────────
  // Uses passive observation via Network domain. No request pausing,
  // unique requestId per call, and explicit body retrieval via
  // Network.getResponseBody after loadingFinished.

  private async startCdpNetworkObservation(): Promise<void> {
    const cdp = this.cdpSession!;
    this.cdpRequestMap.clear();

    await cdp.send('Network.enable');

    this.cdpHandlers.onRequest = (params: unknown) => {
      const event = params as CDPRequestWillBeSent;
      // Only track XHR/Fetch requests
      if (event.type !== 'XHR' && event.type !== 'Fetch') return;

      const call: CapturedApiCall = {
        request: {
          id: event.requestId,
          url: event.request.url,
          method: event.request.method,
          headers: event.request.headers,
          body: event.request.postData,
          timestamp: Date.now(),
          initiator: 'fetch',
        },
        pending: true,
      };

      this.cdpRequestMap.set(event.requestId, call);
      this.apiCalls.push(call);
    };

    this.cdpHandlers.onResponse = (params: unknown) => {
      const event = params as CDPResponseReceived;
      const call = this.cdpRequestMap.get(event.requestId);
      if (!call) return;

      // Store response metadata immediately (body comes after loadingFinished)
      call.response = {
        status: event.response.status,
        statusText: event.response.statusText,
        headers: event.response.headers,
        body: undefined,
        responseTime: Date.now() - call.request.timestamp,
      };
    };

    this.cdpHandlers.onFinished = (params: unknown) => {
      const event = params as CDPLoadingFinished;
      const call = this.cdpRequestMap.get(event.requestId);
      if (!call?.response) return;

      // Explicitly retrieve response body from browser cache
      cdp
        .send('Network.getResponseBody', { requestId: event.requestId })
        .then((result) => {
          const { body, base64Encoded } = result as { body: string; base64Encoded: boolean };
          if (base64Encoded) {
            call.response!.body = body; // keep as base64 string
          } else {
            // Parse JSON if content-type suggests it
            const contentType = call.response!.headers['content-type'] ?? '';
            if (contentType.includes('application/json')) {
              try {
                call.response!.body = JSON.parse(body);
              } catch {
                call.response!.body = body;
              }
            } else {
              call.response!.body = body;
            }
          }
          call.response!.responseTime = Date.now() - call.request.timestamp;
          call.pending = false;
        })
        .catch(() => {
          // Body unavailable (e.g. redirect, aborted). Mark as completed anyway.
          call.pending = false;
        });
    };

    cdp.on('Network.requestWillBeSent', this.cdpHandlers.onRequest);
    cdp.on('Network.responseReceived', this.cdpHandlers.onResponse);
    cdp.on('Network.loadingFinished', this.cdpHandlers.onFinished);
  }

  private async stopCdpNetworkObservation(): Promise<void> {
    const cdp = this.cdpSession!;

    if (this.cdpHandlers.onRequest) {
      cdp.off('Network.requestWillBeSent', this.cdpHandlers.onRequest);
    }
    if (this.cdpHandlers.onResponse) {
      cdp.off('Network.responseReceived', this.cdpHandlers.onResponse);
    }
    if (this.cdpHandlers.onFinished) {
      cdp.off('Network.loadingFinished', this.cdpHandlers.onFinished);
    }
    this.cdpHandlers = { onRequest: null, onResponse: null, onFinished: null };
    this.cdpRequestMap.clear();

    await cdp.send('Network.disable').catch(() => {});
  }

  // ─── Puppeteer-level interception (fallback) ──────────────────
  // Used when no CDP session is provided. Intercepts requests at the
  // Puppeteer API level. Less reliable for body capture (async race).

  private async startPuppeteerInterception(): Promise<void> {
    await this.page.setRequestInterception(true);

    this.pendingRequests.clear();

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

      this.pendingRequests.set(request, call);
      this.apiCalls.push(call);

      req.continue();
    };

    this.responseHandler = (response: unknown) => {
      const res = response as {
        url: () => string;
        request: () => unknown;
        status: () => number;
        statusText: () => string;
        headers: () => Record<string, string>;
        json: () => Promise<unknown>;
        text: () => Promise<string>;
      };

      const requestRef = res.request();
      const call = this.pendingRequests.get(requestRef);

      if (call) {
        const startTime = call.request.timestamp;
        const headers = res.headers();
        const contentType = headers['content-type'] ?? '';

        const bodyPromise = contentType.includes('application/json')
          ? res.json().catch(() => res.text().catch(() => undefined))
          : res.text().catch(() => undefined);

        bodyPromise.then((body) => {
          call.response = {
            status: res.status(),
            statusText: res.statusText(),
            headers,
            body,
            responseTime: Date.now() - startTime,
          };
          call.pending = false;
        });

        this.pendingRequests.delete(requestRef);
      }
    };

    this.page.on('request', this.requestHandler);
    this.page.on('response', this.responseHandler);
  }

  private async stopPuppeteerInterception(): Promise<void> {
    if (this.requestHandler) {
      this.page.off('request', this.requestHandler);
      this.requestHandler = null;
    }
    if (this.responseHandler) {
      this.page.off('response', this.responseHandler);
      this.responseHandler = null;
    }
    this.pendingRequests.clear();
    await this.page.setRequestInterception(false);
  }

  async goBack(): Promise<void> {
    await this.page.goBack({ waitUntil: 'networkidle2' });
  }

  async goForward(): Promise<void> {
    await this.page.goForward({ waitUntil: 'networkidle2' });
  }

  async mouseOut(selector: SelectorInput): Promise<void> {
    const sel = await this.getSelector(selector);
    // Move mouse to the element first, then move away
    await this.page.hover(sel);
    await this.page.mouse.move(0, 0);
  }

  async dragAndDrop(source: SelectorInput, target: SelectorInput): Promise<void> {
    const sourceSel = await this.getSelector(source);
    const targetSel = await this.getSelector(target);

    // Use page.evaluate to dispatch drag events
    await this.page.evaluate(
      `(function() {
        const source = document.querySelector(arguments[0]);
        const target = document.querySelector(arguments[1]);
        if (!source) throw new Error('Source element not found');
        if (!target) throw new Error('Target element not found');

        const dataTransfer = new DataTransfer();
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }));
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
        source.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
      })()`,
      sourceSel,
      targetSel
    );
  }

  async uploadFile(selector: SelectorInput, filePaths: string | string[]): Promise<void> {
    const sel = await this.getSelector(selector);
    const element = await this.page.$(sel);
    if (!element) throw new Error(`Element not found for uploadFile: ${sel}`);

    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    // Puppeteer ElementHandle exposes uploadFile
    const el = element as unknown as { uploadFile: (...paths: string[]) => Promise<void> };
    if (typeof el.uploadFile === 'function') {
      await el.uploadFile(...paths);
    } else {
      throw new Error('uploadFile is not supported on this element handle');
    }
  }

  async getComputedStyle(selector: SelectorInput, property: string): Promise<string> {
    const sel = await this.getSelector(selector);
    const result = await this.page.evaluate(
      `(function() {
        const el = document.querySelector(arguments[0]);
        if (!el) throw new Error('Element not found');
        return window.getComputedStyle(el).getPropertyValue(arguments[1]);
      })()`,
      sel,
      property
    );
    return result as string;
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
    const result = await this.page.evaluate(ASSERT_ELEMENT_EVAL_SCRIPT, sel, assertion);
    return result as { passed: boolean; message: string };
  }
}
