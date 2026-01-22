import type { Selector, SelectorInput } from '@like-cake/ast-types';
import type { Page } from 'puppeteer';

/**
 * Normalize selector input to always return a string selector
 */
function normalizeSelector(selector: SelectorInput): string {
  // If it's already a string, return it directly
  if (typeof selector === 'string') {
    return selector;
  }

  // Convert Selector object to string
  return toSelectorStringFromObject(selector);
}

/**
 * Convert Selector object to a Puppeteer-compatible selector string
 */
function toSelectorStringFromObject(selector: Selector): string {
  switch (selector.strategy) {
    case 'testId':
      return `[data-testid="${selector.value}"]`;
    case 'role':
      // RoleSelector uses 'role' field for the role value, 'name' for aria-label
      if (selector.name) {
        return `[role="${selector.role}"][aria-label="${selector.name}"]`;
      }
      return `[role="${selector.role}"]`;
    case 'css':
      return selector.value;
    case 'xpath':
      // XPath needs special handling
      return `xpath/${selector.value}`;
    default:
      throw new Error(`Unknown selector strategy: ${(selector as Selector).strategy}`);
  }
}

/**
 * Convert SelectorInput to a Puppeteer-compatible selector string
 */
export function toSelectorString(selector: SelectorInput): string {
  return normalizeSelector(selector);
}

/**
 * Check if selector is XPath
 */
function isXPathSelector(selector: SelectorInput): boolean {
  if (typeof selector === 'string') {
    return selector.startsWith('xpath/') || selector.startsWith('//');
  }
  return selector.strategy === 'xpath';
}

/**
 * Get XPath value from selector
 */
function getXPathValue(selector: SelectorInput): string {
  if (typeof selector === 'string') {
    if (selector.startsWith('xpath/')) {
      return selector.slice(6);
    }
    return selector;
  }
  return selector.value;
}

/**
 * Wait for and find element using selector
 */
export async function findElement(page: Page, selector: SelectorInput, timeout?: number) {
  const selectorString = normalizeSelector(selector);

  if (isXPathSelector(selector)) {
    // Use XPath locator
    const xpath = getXPathValue(selector);
    const xpathSelector = xpath.startsWith('xpath/') ? xpath : `xpath/${xpath}`;
    await page.waitForSelector(xpathSelector, {
      visible: true,
      timeout: timeout ?? 30000,
    });
    return page.$(xpathSelector);
  }

  await page.waitForSelector(selectorString, {
    visible: true,
    timeout: timeout ?? 30000,
  });

  return page.$(selectorString);
}

/**
 * Wait for element with specific visibility state
 */
export async function waitForElement(
  page: Page,
  selector: SelectorInput,
  state: 'visible' | 'hidden' | 'attached' | 'detached' = 'visible',
  timeout?: number
) {
  const selectorString = normalizeSelector(selector);

  switch (state) {
    case 'visible':
      await page.waitForSelector(selectorString, {
        visible: true,
        timeout: timeout ?? 30000,
      });
      break;
    case 'hidden':
      await page.waitForSelector(selectorString, {
        hidden: true,
        timeout: timeout ?? 30000,
      });
      break;
    case 'attached':
      await page.waitForSelector(selectorString, {
        timeout: timeout ?? 30000,
      });
      break;
    case 'detached':
      await page.waitForSelector(selectorString, {
        hidden: true,
        timeout: timeout ?? 30000,
      });
      break;
  }
}
