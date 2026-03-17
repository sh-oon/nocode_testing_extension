/**
 * Accessibility validation for ElementBindings
 *
 * Evaluates element accessibility based on usage context
 * (click target, input target, hover target, assertion target).
 * Returns warnings ranked by impact severity.
 */

import type { ElementBinding } from '../types/element-binding';

export interface AccessibilityWarning {
  bindingId: string;
  bindingLabel: string;
  rule: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  message: string;
}

export type UsageContext = 'click' | 'type' | 'hover' | 'assert' | 'other';

/** Interactive roles that are expected on clickable elements */
const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'option', 'radio', 'switch', 'tab', 'checkbox', 'combobox',
  'listbox', 'searchbox', 'slider', 'spinbutton', 'textbox',
]);

/** Contexts where the element must be interactive */
const INTERACTIVE_CONTEXTS = new Set<UsageContext>(['click', 'type', 'hover']);

/**
 * Validate accessibility of an element binding given its usage context.
 * Returns empty array if no accessibility info is available (cannot validate).
 */
export const validateBindingAccessibility = (
  binding: ElementBinding,
  usageContext: UsageContext,
): AccessibilityWarning[] => {
  const { accessibility } = binding;
  if (!accessibility) return [];

  const warnings: AccessibilityWarning[] = [];
  const base = { bindingId: binding.id, bindingLabel: binding.label };

  // Check existing violations from accessibility audit
  for (const violation of accessibility.violations) {
    warnings.push({
      ...base,
      rule: violation.rule,
      impact: violation.impact,
      message: violation.message,
    });
  }

  const isInteractive = INTERACTIVE_CONTEXTS.has(usageContext);

  // Missing role on interactive element
  if (isInteractive && !accessibility.role) {
    warnings.push({
      ...base,
      rule: 'missing-role',
      impact: 'serious',
      message: `"${binding.label}" 요소에 ARIA role이 없습니다. 인터랙티브 요소는 role 속성이 필요합니다.`,
    });
  }

  // Non-interactive role used as interactive element
  if (isInteractive && accessibility.role && !INTERACTIVE_ROLES.has(accessibility.role)) {
    warnings.push({
      ...base,
      rule: 'non-interactive-role',
      impact: 'serious',
      message: `"${binding.label}" 요소의 role="${accessibility.role}"은 인터랙티브 역할이 아닙니다.`,
    });
  }

  // Missing accessible name on interactive element
  if (isInteractive && !accessibility.name) {
    warnings.push({
      ...base,
      rule: 'missing-name',
      impact: 'serious',
      message: `"${binding.label}" 요소에 접근 가능한 이름(aria-label, 텍스트)이 없습니다.`,
    });
  }

  // Not focusable
  if ((usageContext === 'click' || usageContext === 'type') && !accessibility.focusable) {
    warnings.push({
      ...base,
      rule: 'not-focusable',
      impact: 'moderate',
      message: `"${binding.label}" 요소가 포커스를 받을 수 없습니다. 키보드 사용자가 접근할 수 없습니다.`,
    });
  }

  // Not keyboard accessible
  if (isInteractive && !accessibility.keyboardAccessible) {
    warnings.push({
      ...base,
      rule: 'not-keyboard-accessible',
      impact: 'moderate',
      message: `"${binding.label}" 요소가 키보드로 조작할 수 없습니다.`,
    });
  }

  // Low contrast
  if (accessibility.contrastRatio !== undefined && accessibility.contrastRatio < 4.5) {
    warnings.push({
      ...base,
      rule: 'low-contrast',
      impact: 'minor',
      message: `"${binding.label}" 요소의 명암비(${accessibility.contrastRatio.toFixed(1)})가 WCAG AA 기준(4.5:1) 미달입니다.`,
    });
  }

  // Missing data-testid (selector stability warning)
  if (typeof binding.selector === 'string' && !binding.selector.includes('data-testid')) {
    warnings.push({
      ...base,
      rule: 'missing-testid',
      impact: 'minor',
      message: `"${binding.label}" 요소에 data-testid가 없습니다. 선택자 안정성이 낮을 수 있습니다.`,
    });
  } else if (typeof binding.selector === 'object' && binding.selector.strategy !== 'testId') {
    warnings.push({
      ...base,
      rule: 'missing-testid',
      impact: 'minor',
      message: `"${binding.label}" 요소가 data-testid 대신 ${binding.selector.strategy} 전략을 사용합니다.`,
    });
  }

  return warnings;
};

/** Get the highest impact level from a list of warnings */
export const getMaxImpact = (
  warnings: AccessibilityWarning[],
): 'critical' | 'serious' | 'moderate' | 'minor' | null => {
  if (warnings.length === 0) return null;
  const order: Array<AccessibilityWarning['impact']> = ['critical', 'serious', 'moderate', 'minor'];
  for (const level of order) {
    if (warnings.some((w) => w.impact === level)) return level;
  }
  return null;
};
