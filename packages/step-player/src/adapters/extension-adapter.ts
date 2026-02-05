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

  async click(selector: SelectorInput, options?: ClickOptions): Promise<void> {
    const found = await this.findElement(selector);
    if (!found.found || !found.element) {
      throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    }

    const element = found.element as Element;

    // Scroll element into view
    element.scrollIntoView({ behavior: 'auto', block: 'center' });
    await this.wait(50); // Small delay after scroll

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
    const found = await this.findElement(selector);
    if (!found.found || !found.element) {
      throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    }

    const element = found.element as HTMLElement;

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
    const found = await this.findElement(selector);
    if (!found.found || !found.element) {
      throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    }

    const element = found.element as Element;
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
    const found = await this.findElement(selector);
    if (!found.found || !found.element) {
      throw new Error(`Element not found: ${JSON.stringify(selector)}`);
    }

    const selectElement = found.element as HTMLSelectElement;
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
    // This would typically call the dom-serializer package
    // For now, returning a placeholder that should be replaced with actual implementation
    const { captureSnapshot } = await import('@like-cake/dom-serializer');
    return captureSnapshot({
      includeComputedStyles: !!options?.computedStyles?.length,
      styleProperties: options?.computedStyles,
    });
  }

  async captureScreenshot(options?: { fullPage?: boolean }): Promise<ScreenshotResult> {
    // This would typically call the dom-serializer package
    const { captureScreenshot } = await import('@like-cake/dom-serializer');
    return captureScreenshot({
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
    const element = elements[0];

    switch (assertion.type) {
      case 'visible':
        if (element && isElementVisible(element)) {
          return { passed: true, message: 'Element is visible' };
        }
        return { passed: false, message: 'Element is not visible' };

      case 'hidden':
        if (!element || !isElementVisible(element)) {
          return { passed: true, message: 'Element is hidden' };
        }
        return { passed: false, message: 'Element is visible but expected hidden' };

      case 'exists':
        if (element) {
          return { passed: true, message: 'Element exists' };
        }
        return { passed: false, message: 'Element does not exist' };

      case 'notExists':
        if (!element) {
          return { passed: true, message: 'Element does not exist as expected' };
        }
        return { passed: false, message: 'Element exists but expected not to' };

      case 'text': {
        const textContent = element?.textContent ?? '';
        const expectedText = String(assertion.value ?? '');

        if (assertion.contains) {
          if (textContent.includes(expectedText)) {
            return { passed: true, message: `Text contains "${expectedText}"` };
          }
          return {
            passed: false,
            message: `Text does not contain "${expectedText}", actual: "${textContent}"`,
          };
        }
        if (textContent.trim() === expectedText.trim()) {
          return { passed: true, message: `Text matches "${expectedText}"` };
        }
        return {
          passed: false,
          message: `Text does not match, expected: "${expectedText}", actual: "${textContent}"`,
        };
      }

      case 'attribute': {
        const attrName = assertion.name ?? '';
        const attrValue = element?.getAttribute(attrName);

        if (assertion.value === undefined) {
          // Just check attribute exists
          if (attrValue !== null) {
            return { passed: true, message: `Attribute "${attrName}" exists` };
          }
          return { passed: false, message: `Attribute "${attrName}" does not exist` };
        }
        if (attrValue === assertion.value) {
          return { passed: true, message: `Attribute "${attrName}" equals "${assertion.value}"` };
        }
        return {
          passed: false,
          message: `Attribute "${attrName}" does not match, expected: "${assertion.value}", actual: "${attrValue}"`,
        };
      }

      case 'count': {
        const count = elements.length;
        const expected = Number(assertion.value ?? 0);
        const op = assertion.operator ?? 'eq';

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

        if (passed) {
          return { passed: true, message: `Element count ${count} ${op} ${expected}` };
        }
        return { passed: false, message: `Element count ${count} is not ${op} ${expected}` };
      }

      default:
        return { passed: false, message: `Unknown assertion type: ${assertion.type}` };
    }
  }
}
