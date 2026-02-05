import type { RoleSelector } from '@like-cake/ast-types';
import {
  DEFAULT_GENERATOR_OPTIONS,
  type ElementInfo,
  type GeneratorOptions,
  type SelectorGenerator,
  type SelectorResult,
} from '../types';

/**
 * Implicit ARIA roles for common HTML elements
 */
const IMPLICIT_ROLES: Record<string, string> = {
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
  input: 'textbox', // simplified, actual role depends on type
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

/**
 * Generator for role-based selectors (ARIA roles)
 * Second priority after testId
 */
export class RoleGenerator implements SelectorGenerator {
  readonly strategy = 'role' as const;

  canGenerate(element: ElementInfo): boolean {
    const role = this.getRole(element);
    if (!role) return false;

    // Skip generic/landmark roles without a name
    const genericRoles = [
      'generic',
      'group',
      'region',
      'main',
      'complementary',
      'contentinfo',
      'banner',
      'article',
      'section',
    ];
    if (genericRoles.includes(role)) {
      const name = this.getAccessibleName(element);
      return !!name;
    }

    return true;
  }

  generate(element: ElementInfo, options?: GeneratorOptions): SelectorResult | null {
    const opts = { ...DEFAULT_GENERATOR_OPTIONS, ...options };
    const role = this.getRole(element);

    if (!role) {
      return null;
    }

    const name = this.getAccessibleName(element);

    // Skip generic/landmark roles without a name - they're too ambiguous for reliable testing
    // These roles are used for page structure, not interactive elements
    const genericRoles = [
      'generic',
      'group',
      'region',
      'main',
      'complementary',
      'contentinfo',
      'banner',
      'article',
      'section',
    ];
    if (genericRoles.includes(role) && !name) {
      return null;
    }

    const selector: RoleSelector = {
      strategy: 'role',
      value: name ? `${role}[name="${name}"]` : role,
      role,
      ...(name && { name }),
    };

    return {
      selector,
      score: this.calculateScore(role, name, opts),
      isUnique: !!name, // Role + name combination is likely unique
      description: name ? `Role: ${role} with name "${name}"` : `Role: ${role}`,
    };
  }

  private getRole(element: ElementInfo): string | undefined {
    // Explicit role takes precedence
    if (element.role) {
      return element.role;
    }

    // Check for implicit role based on tag name
    return IMPLICIT_ROLES[element.tagName];
  }

  getAccessibleName(element: ElementInfo): string | undefined {
    // aria-label is the most explicit
    if (element.ariaLabel) {
      return element.ariaLabel;
    }

    // For buttons and links, use text content as accessible name
    if (
      ['button', 'a'].includes(element.tagName) &&
      element.textContent &&
      element.textContent.length <= 50
    ) {
      return element.textContent.trim();
    }

    // Check aria-labelledby (would need to resolve, so skip for now)
    return undefined;
  }

  private calculateScore(
    role: string,
    name: string | undefined,
    _options: Required<GeneratorOptions>
  ): number {
    let score = 85; // Base score for role selectors

    // Bonus for having an accessible name (more specific)
    if (name) {
      score += 10;
    }

    // Interactive roles are more reliable
    const interactiveRoles = ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'];
    if (interactiveRoles.includes(role)) {
      score += 5;
    }

    // Penalize generic roles
    const genericRoles = ['generic', 'group', 'region'];
    if (genericRoles.includes(role)) {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Get the effective role for an element
 */
export function getElementRole(element: ElementInfo): string | undefined {
  return element.role || IMPLICIT_ROLES[element.tagName];
}
