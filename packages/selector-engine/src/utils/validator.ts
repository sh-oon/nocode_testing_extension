import type { Selector, SelectorInput, SelectorStrategy } from '@like-cake/ast-types';

/**
 * Validation result for a selector
 */
export interface ValidationResult {
  /** Whether the selector is valid */
  isValid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Warnings that don't prevent usage */
  warnings: string[];
}

/**
 * Validate a selector input
 */
export function validateSelector(input: SelectorInput): ValidationResult {
  // String selectors
  if (typeof input === 'string') {
    return validateSelectorString(input);
  }

  // Object selectors
  return validateSelectorObject(input);
}

/**
 * Validate a CSS selector string
 */
export function validateSelectorString(selector: string): ValidationResult {
  const warnings: string[] = [];

  if (!selector || selector.trim().length === 0) {
    return {
      isValid: false,
      error: 'Selector string cannot be empty',
      warnings,
    };
  }

  // Check for common issues
  if (selector.includes('undefined') || selector.includes('null')) {
    return {
      isValid: false,
      error: 'Selector contains invalid value (undefined or null)',
      warnings,
    };
  }

  // Warn about fragile patterns
  if (/\d{5,}/.test(selector)) {
    warnings.push('Selector contains long numeric sequence (may be unstable)');
  }

  if (/:nth-child\(\d+\)/.test(selector) && !selector.includes('[')) {
    warnings.push('Positional selector without unique identifier (may be fragile)');
  }

  if (selector.split('>').length > 5) {
    warnings.push('Deep descendant chain (may break with DOM changes)');
  }

  // Try to validate CSS syntax (basic check)
  try {
    // In browser context, we could use document.querySelector to validate
    // For now, do basic pattern matching
    if (/[[\]{}()]/.test(selector)) {
      // Check for balanced brackets
      if (!hasBalancedBrackets(selector)) {
        return {
          isValid: false,
          error: 'Unbalanced brackets in selector',
          warnings,
        };
      }
    }
  } catch {
    return {
      isValid: false,
      error: 'Invalid selector syntax',
      warnings,
    };
  }

  return {
    isValid: true,
    warnings,
  };
}

/**
 * Validate a Selector object
 */
export function validateSelectorObject(selector: Selector): ValidationResult {
  const warnings: string[] = [];

  // Validate strategy
  const validStrategies: SelectorStrategy[] = ['testId', 'role', 'css', 'xpath'];
  if (!validStrategies.includes(selector.strategy)) {
    return {
      isValid: false,
      error: `Invalid strategy: ${selector.strategy}`,
      warnings,
    };
  }

  // Validate value
  if (!selector.value || selector.value.trim().length === 0) {
    return {
      isValid: false,
      error: 'Selector value cannot be empty',
      warnings,
    };
  }

  // Strategy-specific validation
  switch (selector.strategy) {
    case 'testId':
      return validateTestIdSelector(selector.value, warnings);
    case 'role':
      return validateRoleSelector(selector, warnings);
    case 'css':
      return validateCssSelector(selector.value, warnings);
    case 'xpath':
      return validateXPathSelector(selector.value, warnings);
  }
}

function validateTestIdSelector(value: string, warnings: string[]): ValidationResult {
  if (/\s/.test(value)) {
    return {
      isValid: false,
      error: 'Test ID should not contain whitespace',
      warnings,
    };
  }

  if (value.length > 100) {
    warnings.push('Test ID is unusually long');
  }

  return { isValid: true, warnings };
}

function validateRoleSelector(selector: Selector, warnings: string[]): ValidationResult {
  if (selector.strategy !== 'role') {
    return { isValid: true, warnings };
  }

  const validRoles = [
    'alert',
    'alertdialog',
    'application',
    'article',
    'banner',
    'button',
    'cell',
    'checkbox',
    'columnheader',
    'combobox',
    'complementary',
    'contentinfo',
    'definition',
    'dialog',
    'directory',
    'document',
    'feed',
    'figure',
    'form',
    'grid',
    'gridcell',
    'group',
    'heading',
    'img',
    'link',
    'list',
    'listbox',
    'listitem',
    'log',
    'main',
    'marquee',
    'math',
    'menu',
    'menubar',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'navigation',
    'none',
    'note',
    'option',
    'presentation',
    'progressbar',
    'radio',
    'radiogroup',
    'region',
    'row',
    'rowgroup',
    'rowheader',
    'scrollbar',
    'search',
    'searchbox',
    'separator',
    'slider',
    'spinbutton',
    'status',
    'switch',
    'tab',
    'table',
    'tablist',
    'tabpanel',
    'term',
    'textbox',
    'timer',
    'toolbar',
    'tooltip',
    'tree',
    'treegrid',
    'treeitem',
  ];

  if ('role' in selector && !validRoles.includes(selector.role as string)) {
    warnings.push(`Unknown ARIA role: ${selector.role}`);
  }

  return { isValid: true, warnings };
}

function validateCssSelector(value: string, warnings: string[]): ValidationResult {
  // Basic CSS selector validation
  const result = validateSelectorString(value);
  return {
    ...result,
    warnings: [...result.warnings, ...warnings],
  };
}

function validateXPathSelector(value: string, warnings: string[]): ValidationResult {
  // Basic XPath validation
  if (!value.startsWith('/') && !value.startsWith('(')) {
    return {
      isValid: false,
      error: 'XPath must start with / or (',
      warnings,
    };
  }

  if (!hasBalancedBrackets(value)) {
    return {
      isValid: false,
      error: 'Unbalanced brackets in XPath',
      warnings,
    };
  }

  if (value.length > 500) {
    warnings.push('XPath is very long (may be fragile)');
  }

  return { isValid: true, warnings };
}

/**
 * Check if a string has balanced brackets
 */
function hasBalancedBrackets(str: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = {
    '(': ')',
    '[': ']',
    '{': '}',
  };

  for (const char of str) {
    if (char in pairs) {
      stack.push(pairs[char]);
    } else if (Object.values(pairs).includes(char)) {
      if (stack.pop() !== char) {
        return false;
      }
    }
  }

  return stack.length === 0;
}

/**
 * Check if a selector is likely to be stable over time
 */
export function isSelectorStable(input: SelectorInput): boolean {
  const result = validateSelector(input);
  return result.isValid && result.warnings.length === 0;
}
