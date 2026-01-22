import type { CssSelector } from '@like-cake/ast-types';
import {
  DEFAULT_GENERATOR_OPTIONS,
  type ElementInfo,
  type GeneratorOptions,
  type SelectorGenerator,
  type SelectorResult,
} from '../types';

/**
 * CSS.escape polyfill for Node.js environment
 * Based on https://drafts.csswg.org/cssom/#serialize-an-identifier
 */
function cssEscape(value: string): string {
  const string = String(value);
  const length = string.length;
  let result = '';

  for (let i = 0; i < length; i++) {
    const char = string.charAt(i);
    const codePoint = string.charCodeAt(i);

    // If the character is NULL, use replacement character
    if (codePoint === 0x0000) {
      result += '\uFFFD';
      continue;
    }

    if (
      // Control characters
      (codePoint >= 0x0001 && codePoint <= 0x001f) ||
      codePoint === 0x007f ||
      // First character: digit
      (i === 0 && codePoint >= 0x0030 && codePoint <= 0x0039) ||
      // Second character: digit (first was hyphen)
      (i === 1 && codePoint >= 0x0030 && codePoint <= 0x0039 && string.charCodeAt(0) === 0x002d)
    ) {
      result += `\\${codePoint.toString(16)} `;
      continue;
    }

    // First character: hyphen followed by nothing or another hyphen
    if (i === 0 && codePoint === 0x002d && length === 1) {
      result += `\\${char}`;
      continue;
    }

    // Safe characters
    if (
      codePoint >= 0x0080 ||
      codePoint === 0x002d || // hyphen
      codePoint === 0x005f || // underscore
      (codePoint >= 0x0030 && codePoint <= 0x0039) || // digits
      (codePoint >= 0x0041 && codePoint <= 0x005a) || // uppercase
      (codePoint >= 0x0061 && codePoint <= 0x007a) // lowercase
    ) {
      result += char;
      continue;
    }

    // Escape other characters
    result += `\\${char}`;
  }

  return result;
}

/**
 * Patterns that indicate dynamically generated classes
 */
const DYNAMIC_CLASS_PATTERNS = [
  /^[a-z]{1,3}[A-Z][a-zA-Z0-9]{4,}$/, // CSS-in-JS patterns (e.g., 'aB1234')
  /^_[a-zA-Z0-9]+$/, // Underscore prefix patterns
  /^css-[a-zA-Z0-9]+$/, // Emotion-like patterns
  /^sc-[a-zA-Z]+$/, // Styled-components
  /^jsx-[a-zA-Z0-9]+$/, // JSX-based styling
  /^svelte-[a-zA-Z0-9]+$/, // Svelte styles
  /^[a-f0-9]{8,}$/, // Hash-only classes
];

/**
 * Generator for CSS selectors
 * Third priority - fallback when testId and role are not available
 */
export class CssGenerator implements SelectorGenerator {
  readonly strategy = 'css' as const;

  canGenerate(_element: ElementInfo): boolean {
    // Can always generate a CSS selector (at minimum, tag name)
    return true;
  }

  generate(element: ElementInfo, options?: GeneratorOptions): SelectorResult | null {
    const opts = { ...DEFAULT_GENERATOR_OPTIONS, ...options };

    const strategies = [
      () => this.generateById(element),
      () => this.generateByClasses(element, opts),
      () => this.generateByAttributes(element, opts),
      () => this.generateByTagAndPosition(element),
    ];

    for (const strategy of strategies) {
      const result = strategy();
      if (result) {
        return result;
      }
    }

    // Fallback to just tag name (not unique)
    return this.generateByTag(element);
  }

  private generateById(element: ElementInfo): SelectorResult | null {
    if (!element.id || element.id.trim().length === 0) {
      return null;
    }

    const id = element.id.trim();

    // Skip dynamic-looking IDs
    if (/^[a-f0-9-]{20,}$/.test(id) || /^\d+$/.test(id)) {
      return null;
    }

    const selector: CssSelector = {
      strategy: 'css',
      value: `#${cssEscape(id)}`,
    };

    return {
      selector,
      score: 90,
      isUnique: true,
      description: `ID: ${id}`,
    };
  }

  private generateByClasses(
    element: ElementInfo,
    options: Required<GeneratorOptions>
  ): SelectorResult | null {
    const stableClasses = this.getStableClasses(element.classNames, options);

    if (stableClasses.length === 0) {
      return null;
    }

    // Use most specific classes (prefer BEM-like naming)
    const sortedClasses = this.sortClassesBySpecificity(stableClasses);
    const selectedClasses = sortedClasses.slice(0, 2); // Max 2 classes

    const classSelector = selectedClasses.map((c) => `.${cssEscape(c)}`).join('');
    const fullSelector = `${element.tagName}${classSelector}`;

    const selector: CssSelector = {
      strategy: 'css',
      value: fullSelector,
    };

    return {
      selector,
      score: this.calculateClassScore(selectedClasses),
      isUnique: false, // Classes may not be unique
      description: `CSS: ${fullSelector}`,
    };
  }

  private generateByAttributes(
    element: ElementInfo,
    options: Required<GeneratorOptions>
  ): SelectorResult | null {
    const ignoreAttrs = new Set([...options.ignoreAttributes, 'data-testid', 'role', 'aria-label']);

    // Find semantic attributes
    const semanticAttrs = ['name', 'type', 'placeholder', 'title', 'alt', 'href', 'src'];
    for (const attr of semanticAttrs) {
      const value = element.attributes[attr];
      if (value && !ignoreAttrs.has(attr)) {
        const escapedValue = cssEscape(value);
        const selectorValue = `${element.tagName}[${attr}="${escapedValue}"]`;

        const selector: CssSelector = {
          strategy: 'css',
          value: selectorValue,
        };

        return {
          selector,
          score: 75,
          isUnique: attr === 'name',
          description: `CSS: ${selectorValue}`,
        };
      }
    }

    return null;
  }

  private generateByTagAndPosition(element: ElementInfo): SelectorResult | null {
    if (element.siblingIndex === undefined || element.siblingCount === undefined) {
      return null;
    }

    if (element.siblingCount <= 1) {
      return null;
    }

    const nthChild = `:nth-of-type(${element.siblingIndex + 1})`;
    const selectorValue = `${element.tagName}${nthChild}`;

    const selector: CssSelector = {
      strategy: 'css',
      value: selectorValue,
    };

    return {
      selector,
      score: 50,
      isUnique: false,
      description: `CSS: ${selectorValue} (positional)`,
    };
  }

  private generateByTag(element: ElementInfo): SelectorResult {
    const selector: CssSelector = {
      strategy: 'css',
      value: element.tagName,
    };

    return {
      selector,
      score: 20,
      isUnique: false,
      description: `CSS: ${element.tagName} (tag only)`,
    };
  }

  private getStableClasses(classNames: string[], options: Required<GeneratorOptions>): string[] {
    const ignoreSet = new Set(options.ignoreClasses);

    return classNames.filter((className) => {
      if (ignoreSet.has(className)) {
        return false;
      }

      // Filter out dynamic-looking classes
      return !DYNAMIC_CLASS_PATTERNS.some((pattern) => pattern.test(className));
    });
  }

  private sortClassesBySpecificity(classes: string[]): string[] {
    return [...classes].sort((a, b) => {
      // BEM-like classes are more specific
      const aIsBem = a.includes('__') || a.includes('--');
      const bIsBem = b.includes('__') || b.includes('--');
      if (aIsBem !== bIsBem) {
        return aIsBem ? -1 : 1;
      }

      // Longer class names are often more specific
      return b.length - a.length;
    });
  }

  private calculateClassScore(classes: string[]): number {
    let score = 70;

    // BEM-like naming is more reliable
    if (classes.some((c) => c.includes('__') || c.includes('--'))) {
      score += 10;
    }

    // Multiple classes increase specificity
    if (classes.length > 1) {
      score += 5;
    }

    return Math.min(85, score);
  }
}

/**
 * Check if a class name appears to be dynamically generated
 */
export function isDynamicClass(className: string): boolean {
  return DYNAMIC_CLASS_PATTERNS.some((pattern) => pattern.test(className));
}
