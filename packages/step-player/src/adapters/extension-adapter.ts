import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { Selector, SelectorInput } from '@like-cake/ast-types';
import {
  captureScreenshot as captureDomScreenshot,
  captureSnapshot as captureDomSnapshot,
  type DomSnapshot,
  type ScreenshotResult,
} from '@like-cake/dom-serializer';
import { ACTION_CHECKS, checkActionability } from '../actionability';
import { runElementAssertion } from '../assert-element-logic';
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
 * Default wait options
 */
const DEFAULT_WAIT_OPTIONS: Required<WaitOptions> = {
  timeout: 30000,
  interval: 100,
};

/**
 * Resolves a SelectorInput to a CSS selector string
 */
function resolveSelectorToString(selector: SelectorInput): string {
  if (typeof selector === 'string') {
    return selector;
  }

  const sel = selector as Selector;

  switch (sel.strategy) {
    case 'testId':
      return `[data-testid="${sel.value}"]`;
    case 'role': {
      const roleSelector = `[role="${sel.role}"]`;
      if (sel.name) {
        return `${roleSelector}[aria-label="${sel.name}"]`;
      }
      return roleSelector;
    }
    case 'css':
      return sel.value;
    case 'xpath':
      // For extension adapter, we'll handle xpath separately
      return `xpath:${sel.value}`;
    default:
      throw new Error('Invalid selector: no valid selector strategy found');
  }
}

/**
 * Finds element by selector
 */
function findElementBySelector(selector: SelectorInput): Element | null {
  const selectorStr = resolveSelectorToString(selector);

  if (selectorStr.startsWith('xpath:')) {
    const xpath = selectorStr.slice(6);
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element | null;
  }

  // Handle :has-text() pseudo-selector (not standard CSS)
  const hasTextMatch = selectorStr.match(/^(.+):has-text\("(.+)"\)$/);
  if (hasTextMatch) {
    const [, baseSelector, text] = hasTextMatch;
    const candidates = document.querySelectorAll(baseSelector);
    for (const el of candidates) {
      if (el.textContent?.includes(text)) return el;
    }
    return null;
  }

  return document.querySelector(selectorStr);
}

/**
 * Gets all matching elements
 */
function findAllElements(selector: SelectorInput): Element[] {
  const selectorStr = resolveSelectorToString(selector);

  if (selectorStr.startsWith('xpath:')) {
    const xpath = selectorStr.slice(6);
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    const elements: Element[] = [];
    for (let i = 0; i < result.snapshotLength; i++) {
      const node = result.snapshotItem(i);
      if (node instanceof Element) {
        elements.push(node);
      }
    }
    return elements;
  }

  return Array.from(document.querySelectorAll(selectorStr));
}

/**
 * Checks if element is visible
 */
function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

/**
 * Waits for a condition with timeout
 */
async function waitFor<T>(
  condition: () => T | null | undefined,
  options: Required<WaitOptions>
): Promise<T> {
  const startTime = Date.now();

  while (Date.now() - startTime < options.timeout) {
    const result = condition();
    if (result) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, options.interval));
  }

  throw new Error(`Timeout waiting for condition after ${options.timeout}ms`);
}

/**
 * Simulates a mouse event
 */
function simulateMouseEvent(
  element: Element,
  eventType: string,
  options: {
    clientX?: number;
    clientY?: number;
    button?: number;
    clickCount?: number;
    modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  } = {}
): void {
  const rect = element.getBoundingClientRect();
  const clientX = options.clientX ?? rect.left + rect.width / 2;
  const clientY = options.clientY ?? rect.top + rect.height / 2;

  const eventInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX,
    clientY,
    screenX: clientX,
    screenY: clientY,
    button: options.button ?? 0,
    detail: options.clickCount ?? 1,
    altKey: options.modifiers?.includes('Alt') ?? false,
    ctrlKey: options.modifiers?.includes('Control') ?? false,
    metaKey: options.modifiers?.includes('Meta') ?? false,
    shiftKey: options.modifiers?.includes('Shift') ?? false,
  };

  element.dispatchEvent(new MouseEvent(eventType, eventInit));
}

/**
 * Simulates keyboard input
 */
function simulateKeyboardEvent(
  element: Element,
  eventType: 'keydown' | 'keypress' | 'keyup',
  key: string,
  modifiers?: string[]
): void {
  const eventInit: KeyboardEventInit = {
    bubbles: true,
    cancelable: true,
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    altKey: modifiers?.includes('Alt') ?? false,
    ctrlKey: modifiers?.includes('Control') ?? false,
    metaKey: modifiers?.includes('Meta') ?? false,
    shiftKey: modifiers?.includes('Shift') ?? false,
  };

  element.dispatchEvent(new KeyboardEvent(eventType, eventInit));
}

/**
 * Extension adapter - runs in browser context via Content Script
 */
export class ExtensionAdapter implements PlaybackAdapter {
  readonly name = 'extension';

  private apiCalls: CapturedApiCall[] = [];
  private apiInterceptionActive = false;

  async initialize(): Promise<void> {
    // Extension adapter initializes in browser context
    // Nothing special needed here as we're already in the page context
  }

  async destroy(): Promise<void> {
    await this.stopApiInterception();
    this.apiCalls = [];
  }

  async navigate(url: string, options?: NavigationOptions): Promise<void> {
    const absoluteUrl = new URL(url, window.location.href).href;

    // Set up navigation promise before changing location
    const navigationPromise = new Promise<void>((resolve) => {
      const handler = () => {
        window.removeEventListener('load', handler);
        resolve();
      };
      window.addEventListener('load', handler);
    });

    window.location.href = absoluteUrl;

    if (options?.waitUntil === 'load') {
      await navigationPromise;
    }
  }

  async findElement(selector: SelectorInput, options?: WaitOptions): Promise<FoundElement> {
    const opts = { ...DEFAULT_WAIT_OPTIONS, ...options };

    try {
      const element = await waitFor(() => findElementBySelector(selector), opts);

      const rect = element.getBoundingClientRect();
      const visible = isElementVisible(element);

      return {
        found: true,
        element,
        boundingRect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        isVisible: visible,
        textContent: element.textContent ?? undefined,
        attributes: this.getElementAttributes(element),
      };
    } catch {
      return { found: false };
    }
  }

  private getElementAttributes(element: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    for (const attr of element.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  /**
   * Ensures an element is actionable before performing an action.
   * Polls via rAF, checking all required conditions per action type.
   * Returns the ready element for immediate use.
   */
  private async ensureActionable(
    selector: SelectorInput,
    action: 'click' | 'hover' | 'type' | 'select',
    timeout = DEFAULT_WAIT_OPTIONS.timeout
  ): Promise<Element> {
    const checks = ACTION_CHECKS[action];
    const startTime = Date.now();
    let lastFailure = '';
    let prevRect: { x: number; y: number; width: number; height: number } | null = null;

    const pollFrame = (): Promise<Element> =>
      new Promise<Element>((resolve, reject) => {
        const tick = () => {
          if (Date.now() - startTime > timeout) {
            reject(
              new Error(
                `Actionability timeout after ${timeout}ms: ${lastFailure || 'element not found'}`
              )
            );
            return;
          }

          const element = findElementBySelector(selector);
          if (!element) {
            lastFailure = 'Element not found';
            prevRect = null;
            requestAnimationFrame(tick);
            return;
          }

          const result = checkActionability(element, checks);
          if (!result.passed) {
            lastFailure = result.failure!.message;
            prevRect = null;
            requestAnimationFrame(tick);
            return;
          }

          // Stability: compare boundingRect across 2 frames
          if (checks.stable && result.boundingRect) {
            const cur = result.boundingRect;
            if (
              !prevRect ||
              prevRect.x !== cur.x ||
              prevRect.y !== cur.y ||
              prevRect.width !== cur.width ||
              prevRect.height !== cur.height
            ) {
              prevRect = cur;
              lastFailure = 'Element position is not stable';
              requestAnimationFrame(tick);
              return;
            }
          }

          resolve(element);
        };

        requestAnimationFrame(tick);
      });

    return pollFrame();
  }

  async click(selector: SelectorInput, options?: ClickOptions): Promise<void> {
    const element = await this.ensureActionable(selector, 'click');

    // Scroll element into view
    element.scrollIntoView({ behavior: 'auto', block: 'center' });

    // Calculate click position
    const rect = element.getBoundingClientRect();
    const clientX = options?.position?.x ?? rect.left + rect.width / 2;
    const clientY = options?.position?.y ?? rect.top + rect.height / 2;

    const mouseOptions = {
      clientX,
      clientY,
      button: options?.button === 'right' ? 2 : options?.button === 'middle' ? 1 : 0,
      clickCount: options?.clickCount ?? 1,
      modifiers: options?.modifiers,
    };

    // Simulate mouse events sequence
    simulateMouseEvent(element, 'mouseenter', mouseOptions);
    simulateMouseEvent(element, 'mouseover', mouseOptions);
    simulateMouseEvent(element, 'mousemove', mouseOptions);
    simulateMouseEvent(element, 'mousedown', mouseOptions);

    // Focus the element if focusable
    if (element instanceof HTMLElement && element.tabIndex >= 0) {
      element.focus();
    }

    simulateMouseEvent(element, 'mouseup', mouseOptions);
    simulateMouseEvent(element, 'click', mouseOptions);

    // Handle double click
    if (options?.clickCount === 2) {
      simulateMouseEvent(element, 'dblclick', mouseOptions);
    }
  }

  async type(selector: SelectorInput, text: string, options?: TypeOptions): Promise<void> {
    const element = (await this.ensureActionable(selector, 'type')) as HTMLElement;

    // Focus the element
    element.focus();

    // Clear existing content if requested
    if (options?.clear && element instanceof HTMLInputElement) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Type each character
    const delay = options?.delay ?? 0;

    for (const char of text) {
      simulateKeyboardEvent(element, 'keydown', char);
      simulateKeyboardEvent(element, 'keypress', char);

      // Update input value
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (element.isContentEditable) {
        document.execCommand('insertText', false, char);
      }

      simulateKeyboardEvent(element, 'keyup', char);

      if (delay > 0) {
        await this.wait(delay);
      }
    }

    // Trigger change event
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async keypress(key: string, selector?: SelectorInput, modifiers?: string[]): Promise<void> {
    let element: Element | null = document.activeElement;

    if (selector) {
      const found = await this.findElement(selector);
      if (!found.found || !found.element) {
        throw new Error(`Element not found: ${JSON.stringify(selector)}`);
      }
      element = found.element as Element;
      (element as HTMLElement).focus?.();
    }

    if (!element) {
      element = document.body;
    }

    simulateKeyboardEvent(element, 'keydown', key, modifiers);
    simulateKeyboardEvent(element, 'keypress', key, modifiers);
    simulateKeyboardEvent(element, 'keyup', key, modifiers);

    // Handle special keys
    if (key === 'Enter' && element instanceof HTMLFormElement) {
      element.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }

  async hover(selector: SelectorInput, position?: { x: number; y: number }): Promise<void> {
    const element = await this.ensureActionable(selector, 'hover');
    const rect = element.getBoundingClientRect();
    const clientX = position?.x ?? rect.left + rect.width / 2;
    const clientY = position?.y ?? rect.top + rect.height / 2;

    simulateMouseEvent(element, 'mouseenter', { clientX, clientY });
    simulateMouseEvent(element, 'mouseover', { clientX, clientY });
    simulateMouseEvent(element, 'mousemove', { clientX, clientY });
  }

  async scroll(selector?: SelectorInput, options?: ScrollOptions): Promise<void> {
    if (selector) {
      const found = await this.findElement(selector);
      if (!found.found || !found.element) {
        throw new Error(`Element not found: ${JSON.stringify(selector)}`);
      }

      (found.element as Element).scrollIntoView({
        behavior: options?.behavior ?? 'auto',
        block: 'center',
      });
    } else if (options?.position) {
      window.scrollTo({
        left: options.position.x,
        top: options.position.y,
        behavior: options.behavior ?? 'auto',
      });
    }
  }

  async select(selector: SelectorInput, values: string | string[]): Promise<void> {
    const selectElement = (await this.ensureActionable(selector, 'select')) as HTMLSelectElement;
    if (!(selectElement instanceof HTMLSelectElement)) {
      throw new Error('Element is not a select element');
    }

    const valueArray = Array.isArray(values) ? values : [values];

    // Set selected state for matching options
    for (const option of selectElement.options) {
      option.selected = valueArray.includes(option.value);
    }

    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async waitForSelector(
    selector: SelectorInput,
    state?: 'visible' | 'hidden' | 'attached' | 'detached',
    options?: WaitOptions
  ): Promise<void> {
    const opts = { ...DEFAULT_WAIT_OPTIONS, ...options };

    await waitFor(() => {
      const element = findElementBySelector(selector);

      switch (state) {
        case 'hidden':
          return !element || !isElementVisible(element) ? true : null;
        case 'detached':
          return !element ? true : null;
        case 'attached':
          return element ? true : null;
        default:
          return element && isElementVisible(element) ? true : null;
      }
    }, opts);
  }

  async waitForNavigation(options?: NavigationOptions): Promise<void> {
    const timeout = options?.timeout ?? 30000;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Navigation timeout after ${timeout}ms`));
      }, timeout);

      const handler = () => {
        clearTimeout(timer);
        window.removeEventListener('load', handler);
        resolve();
      };

      window.addEventListener('load', handler);
    });
  }

  async waitForNetworkIdle(options?: WaitOptions): Promise<void> {
    const opts = { ...DEFAULT_WAIT_OPTIONS, ...options };
    const idleTime = 500; // Consider idle after 500ms of no requests

    let lastRequestTime = Date.now();
    const startTime = Date.now();

    while (Date.now() - startTime < opts.timeout) {
      // Check if we have pending requests
      const hasPendingRequests = this.apiCalls.some((call) => call.pending);

      if (hasPendingRequests) {
        lastRequestTime = Date.now();
      } else if (Date.now() - lastRequestTime >= idleTime) {
        return;
      }

      await this.wait(opts.interval);
    }

    throw new Error(`Network idle timeout after ${opts.timeout}ms`);
  }

  async waitForDomStable(options?: WaitOptions & { stabilityThreshold?: number }): Promise<void> {
    const stabilityThreshold = options?.stabilityThreshold ?? 1500;
    const timeout = options?.timeout ?? DEFAULT_WAIT_OPTIONS.timeout;

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const globalTimer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`DOM stability timeout after ${timeout}ms`));
      }, timeout);

      const observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          observer.disconnect();
          clearTimeout(globalTimer);
          resolve();
        }, stabilityThreshold);
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });

      // If DOM is already stable, resolve after stabilityThreshold
      timer = setTimeout(() => {
        observer.disconnect();
        clearTimeout(globalTimer);
        resolve();
      }, stabilityThreshold);
    });
  }

  async wait(duration: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, duration));
  }

  async getCurrentUrl(): Promise<string> {
    return window.location.href;
  }

  async getTitle(): Promise<string> {
    return document.title;
  }

  async captureSnapshot(options?: {
    computedStyles?: string[];
    fullPage?: boolean;
  }): Promise<DomSnapshot> {
    return captureDomSnapshot({
      includeComputedStyles: !!options?.computedStyles?.length,
      styleProperties: options?.computedStyles,
    });
  }

  async captureScreenshot(options?: { fullPage?: boolean }): Promise<ScreenshotResult> {
    return captureDomScreenshot({
      fullPage: options?.fullPage,
    });
  }

  getApiCalls(): CapturedApiCall[] {
    return [...this.apiCalls];
  }

  clearApiCalls(): void {
    this.apiCalls = [];
  }

  async startApiInterception(): Promise<void> {
    if (this.apiInterceptionActive) {
      return;
    }

    // Import and start the API interceptor
    const { createApiInterceptor } = await import('@like-cake/api-interceptor');
    const interceptor = createApiInterceptor({
      onResponse: (call: CapturedApiCall) => {
        this.apiCalls.push(call);
      },
    });
    interceptor.start();
    this.apiInterceptionActive = true;
  }

  async stopApiInterception(): Promise<void> {
    // The interceptor should be stopped via its own method
    // For now, just mark as inactive
    this.apiInterceptionActive = false;
  }

  async goBack(): Promise<void> {
    window.history.back();
    // Wait briefly for navigation to process
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async goForward(): Promise<void> {
    window.history.forward();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  async mouseOut(selector: SelectorInput): Promise<void> {
    const elements = findAllElements(selector);
    const element = elements[0];
    if (!element) throw new Error(`Element not found for mouseOut: ${JSON.stringify(selector)}`);

    element.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
  }

  async dragAndDrop(source: SelectorInput, target: SelectorInput): Promise<void> {
    const sourceElements = findAllElements(source);
    const targetElements = findAllElements(target);
    const sourceEl = sourceElements[0];
    const targetEl = targetElements[0];
    if (!sourceEl)
      throw new Error(`Source element not found for dragAndDrop: ${JSON.stringify(source)}`);
    if (!targetEl)
      throw new Error(`Target element not found for dragAndDrop: ${JSON.stringify(target)}`);

    const dataTransfer = new DataTransfer();
    sourceEl.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer }));
    targetEl.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }));
    targetEl.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
    sourceEl.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
  }

  async uploadFile(_selector: SelectorInput, _filePaths: string | string[]): Promise<void> {
    // File upload via extension content script is limited — files can't be set programmatically
    // from content scripts due to security restrictions. This requires devtools protocol support.
    throw new Error(
      'File upload is not supported in the extension adapter. Use the Puppeteer adapter.'
    );
  }

  async getComputedStyle(selector: SelectorInput, property: string): Promise<string> {
    const elements = findAllElements(selector);
    const element = elements[0];
    if (!element)
      throw new Error(`Element not found for getComputedStyle: ${JSON.stringify(selector)}`);

    return window.getComputedStyle(element).getPropertyValue(property);
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
    const elements = findAllElements(selector);
    return runElementAssertion(elements, assertion);
  }
}
