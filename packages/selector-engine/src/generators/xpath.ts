import type { XPathSelector } from '@like-cake/ast-types';
import {
  DEFAULT_GENERATOR_OPTIONS,
  type ElementInfo,
  type GeneratorOptions,
  type SelectorGenerator,
  type SelectorResult,
} from '../types';

/**
 * Generator for XPath selectors
 * Lowest priority - fallback when other strategies fail
 */
export class XPathGenerator implements SelectorGenerator {
  readonly strategy = 'xpath' as const;

  canGenerate(_element: ElementInfo): boolean {
    // Can always generate an XPath
    return true;
  }

  generate(element: ElementInfo, options?: GeneratorOptions): SelectorResult | null {
    const opts = { ...DEFAULT_GENERATOR_OPTIONS, ...options };

    const strategies = [
      () => this.generateByTextContent(element),
      () => this.generateByAttributes(element, opts),
      () => this.generateByPosition(element),
    ];

    for (const strategy of strategies) {
      const result = strategy();
      if (result) {
        return result;
      }
    }

    // Use pre-computed XPath if available
    if (element.xpath) {
      return this.createResult(element.xpath, 30, 'Pre-computed XPath');
    }

    return null;
  }

  private generateByTextContent(element: ElementInfo): SelectorResult | null {
    if (!element.textContent || element.textContent.length === 0) {
      return null;
    }

    const text = element.textContent.trim();

    // Skip if text is too long or contains special characters
    if (text.length > 50 || text.includes('"') || text.includes('\n')) {
      return null;
    }

    // For buttons and links, text-based XPath is reliable
    const textBasedTags = ['button', 'a', 'label', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    if (!textBasedTags.includes(element.tagName)) {
      return null;
    }

    const xpath = `//${element.tagName}[normalize-space(text())="${text}"]`;

    return this.createResult(xpath, 60, `XPath by text: "${text}"`);
  }

  private generateByAttributes(
    element: ElementInfo,
    _options: Required<GeneratorOptions>
  ): SelectorResult | null {
    // Prefer semantic attributes for XPath
    const attributePriority = [
      'name',
      'title',
      'alt',
      'placeholder',
      'aria-describedby',
      'data-cy',
      'data-test',
    ];

    for (const attr of attributePriority) {
      const value = element.attributes[attr];
      if (value) {
        const xpath = `//${element.tagName}[@${attr}="${this.escapeXPathValue(value)}"]`;
        return this.createResult(xpath, 55, `XPath by @${attr}`);
      }
    }

    return null;
  }

  private generateByPosition(element: ElementInfo): SelectorResult | null {
    // Build positional XPath from element and its parent
    if (!element.parent) {
      if (element.siblingIndex !== undefined) {
        const xpath = `//${element.tagName}[${element.siblingIndex + 1}]`;
        return this.createResult(xpath, 35, 'XPath positional');
      }
      return null;
    }

    // Simple parent-child positional XPath
    const parentSelector = this.getParentXPathPart(element.parent);
    if (parentSelector) {
      const childPart =
        element.siblingIndex !== undefined
          ? `${element.tagName}[${element.siblingIndex + 1}]`
          : element.tagName;

      const xpath = `${parentSelector}/${childPart}`;
      return this.createResult(xpath, 40, 'XPath with parent context');
    }

    return null;
  }

  private getParentXPathPart(parent: ElementInfo): string | null {
    // Try to build a unique parent selector
    if (parent.id) {
      return `//${parent.tagName}[@id="${this.escapeXPathValue(parent.id)}"]`;
    }

    if (parent.testId) {
      return `//${parent.tagName}[@data-testid="${this.escapeXPathValue(parent.testId)}"]`;
    }

    // Semantic elements are usually unique
    const semanticTags = ['header', 'footer', 'main', 'nav', 'aside', 'article', 'section'];
    if (semanticTags.includes(parent.tagName)) {
      return `//${parent.tagName}`;
    }

    return null;
  }

  private createResult(xpath: string, score: number, description: string): SelectorResult {
    const selector: XPathSelector = {
      strategy: 'xpath',
      value: xpath,
    };

    return {
      selector,
      score,
      isUnique: false,
      description,
    };
  }

  private escapeXPathValue(value: string): string {
    // XPath 1.0 string escaping
    if (!value.includes('"')) {
      return value;
    }
    if (!value.includes("'")) {
      return value.replace(/"/g, "'");
    }
    // Complex case: use concat for values with both quote types
    return value.replace(/"/g, '&quot;');
  }
}

/**
 * Build an absolute XPath for an element
 */
export function buildAbsoluteXPath(element: ElementInfo, maxDepth = 10): string {
  const parts: string[] = [];
  let current: ElementInfo | undefined = element;
  let depth = 0;

  while (current && depth < maxDepth) {
    const part =
      current.siblingIndex !== undefined
        ? `${current.tagName}[${current.siblingIndex + 1}]`
        : current.tagName;
    parts.unshift(part);
    current = current.parent;
    depth++;
  }

  return `/${parts.join('/')}`;
}
