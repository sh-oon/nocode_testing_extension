import type { ElementInfo } from '@like-cake/selector-engine';

/**
 * Extract ElementInfo from a DOM element
 * This is the bridge between DOM and the selector engine
 */
export function extractElementInfo(element: Element, maxParentDepth = 3): ElementInfo {
  const tagName = element.tagName.toLowerCase();

  // Extract basic attributes
  const id = element.id || undefined;
  const classNames = Array.from(element.classList);
  const testId = element.getAttribute('data-testid') || undefined;

  // Extract ARIA attributes
  const role = element.getAttribute('role') || getImplicitRole(element);
  const ariaLabel = element.getAttribute('aria-label') || undefined;

  // Extract text content (limited and trimmed)
  const textContent = getTextContent(element);

  // Extract all attributes
  const attributes = extractAttributes(element);

  // Get sibling information
  const { siblingIndex, siblingCount } = getSiblingInfo(element);

  // Extract parent info recursively
  const parent =
    element.parentElement && maxParentDepth > 0
      ? extractElementInfo(element.parentElement, maxParentDepth - 1)
      : undefined;

  // Build XPath
  const xpath = buildXPath(element);

  return {
    tagName,
    id,
    classNames,
    testId,
    role,
    ariaLabel,
    textContent,
    attributes,
    siblingIndex,
    siblingCount,
    parent,
    xpath,
  };
}

/**
 * Get implicit ARIA role for common elements
 */
function getImplicitRole(element: Element): string | undefined {
  const tagName = element.tagName.toLowerCase();

  const implicitRoles: Record<string, string> = {
    a: 'link',
    article: 'article',
    aside: 'complementary',
    button: 'button',
    footer: 'contentinfo',
    form: 'form',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
    header: 'banner',
    img: 'img',
    input: getInputRole(element as HTMLInputElement),
    li: 'listitem',
    main: 'main',
    nav: 'navigation',
    ol: 'list',
    option: 'option',
    progress: 'progressbar',
    section: 'region',
    select: 'combobox',
    table: 'table',
    td: 'cell',
    textarea: 'textbox',
    th: 'columnheader',
    tr: 'row',
    ul: 'list',
  };

  return implicitRoles[tagName];
}

/**
 * Get role for input element based on type
 */
function getInputRole(input: HTMLInputElement): string {
  const type = input.type?.toLowerCase() || 'text';

  const inputRoles: Record<string, string> = {
    button: 'button',
    checkbox: 'checkbox',
    email: 'textbox',
    number: 'spinbutton',
    password: 'textbox',
    radio: 'radio',
    range: 'slider',
    search: 'searchbox',
    submit: 'button',
    tel: 'textbox',
    text: 'textbox',
    url: 'textbox',
  };

  return inputRoles[type] || 'textbox';
}

/**
 * Get trimmed text content (first 100 chars)
 */
function getTextContent(element: Element): string | undefined {
  const text = element.textContent?.trim();
  if (!text || text.length === 0) {
    return undefined;
  }
  return text.length > 100 ? `${text.substring(0, 100)}...` : text;
}

/**
 * Extract relevant attributes from element
 */
function extractAttributes(element: Element): Record<string, string> {
  const result: Record<string, string> = {};
  const relevantAttrs = [
    'name',
    'type',
    'placeholder',
    'title',
    'alt',
    'href',
    'src',
    'value',
    'aria-describedby',
    'data-cy',
    'data-test',
    'data-automation-id',
  ];

  for (const attr of relevantAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      result[attr] = value;
    }
  }

  return result;
}

/**
 * Get sibling information for the element
 */
function getSiblingInfo(element: Element): { siblingIndex: number; siblingCount: number } {
  const parent = element.parentElement;
  if (!parent) {
    return { siblingIndex: 0, siblingCount: 1 };
  }

  const tagName = element.tagName;
  const siblings = Array.from(parent.children).filter((child) => child.tagName === tagName);

  return {
    siblingIndex: siblings.indexOf(element),
    siblingCount: siblings.length,
  };
}

/**
 * Build a simple XPath for the element
 */
function buildXPath(element: Element, maxDepth = 10): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current && current !== document.documentElement && depth < maxDepth) {
    const tagName = current.tagName.toLowerCase();
    const { siblingIndex, siblingCount } = getSiblingInfo(current);

    const part = siblingCount > 1 ? `${tagName}[${siblingIndex + 1}]` : tagName;
    parts.unshift(part);

    current = current.parentElement;
    depth++;
  }

  return `/${parts.join('/')}`;
}

/**
 * Check if an element matches any of the ignore selectors
 */
export function shouldIgnoreElement(element: Element, ignoreSelectors: string[]): boolean {
  for (const selector of ignoreSelectors) {
    if (element.matches(selector)) {
      return true;
    }
    if (element.closest(selector)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an element is an interactive element
 */
export function isInteractiveElement(element: Element): boolean {
  const interactiveTags = ['a', 'button', 'input', 'select', 'textarea', 'label', 'summary'];
  const tagName = element.tagName.toLowerCase();

  if (interactiveTags.includes(tagName)) {
    return true;
  }

  // Check for interactive roles
  const role = element.getAttribute('role');
  if (role) {
    const interactiveRoles = ['button', 'link', 'checkbox', 'radio', 'textbox', 'menuitem', 'tab'];
    if (interactiveRoles.includes(role)) {
      return true;
    }
  }

  // Check for tabindex
  const tabIndex = element.getAttribute('tabindex');
  if (tabIndex !== null && tabIndex !== '-1') {
    return true;
  }

  // Check for click handlers (via onclick attribute)
  if (element.hasAttribute('onclick')) {
    return true;
  }

  return false;
}

/**
 * Find the closest interactive ancestor of an element
 */
export function findInteractiveAncestor(element: Element): Element | null {
  let current: Element | null = element;

  while (current) {
    if (isInteractiveElement(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}
