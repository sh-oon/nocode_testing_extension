import type {
  AssertApiStep,
  AssertElementStep,
  AssertionStep,
  ClickStep,
  HoverStep,
  KeypressStep,
  NavigateStep,
  ObservationStep,
  ScrollStep,
  SelectStep,
  SnapshotDomStep,
  Step,
  TypeStep,
  UIActionStep,
  WaitStep,
} from '../types';

// ============================================
// Individual Step Type Guards
// ============================================

export function isNavigateStep(step: Step): step is NavigateStep {
  return step.type === 'navigate';
}

export function isClickStep(step: Step): step is ClickStep {
  return step.type === 'click';
}

export function isTypeStep(step: Step): step is TypeStep {
  return step.type === 'type';
}

export function isKeypressStep(step: Step): step is KeypressStep {
  return step.type === 'keypress';
}

export function isWaitStep(step: Step): step is WaitStep {
  return step.type === 'wait';
}

export function isHoverStep(step: Step): step is HoverStep {
  return step.type === 'hover';
}

export function isScrollStep(step: Step): step is ScrollStep {
  return step.type === 'scroll';
}

export function isSelectStep(step: Step): step is SelectStep {
  return step.type === 'select';
}

export function isAssertApiStep(step: Step): step is AssertApiStep {
  return step.type === 'assertApi';
}

export function isAssertElementStep(step: Step): step is AssertElementStep {
  return step.type === 'assertElement';
}

export function isSnapshotDomStep(step: Step): step is SnapshotDomStep {
  return step.type === 'snapshotDom';
}

// ============================================
// Category Type Guards
// ============================================

const UI_ACTION_TYPES = [
  'navigate',
  'click',
  'type',
  'keypress',
  'wait',
  'hover',
  'scroll',
  'select',
] as const;

const ASSERTION_TYPES = ['assertApi', 'assertElement'] as const;

const OBSERVATION_TYPES = ['snapshotDom'] as const;

export function isUIActionStep(step: Step): step is UIActionStep {
  return (UI_ACTION_TYPES as readonly string[]).includes(step.type);
}

export function isAssertionStep(step: Step): step is AssertionStep {
  return (ASSERTION_TYPES as readonly string[]).includes(step.type);
}

export function isObservationStep(step: Step): step is ObservationStep {
  return (OBSERVATION_TYPES as readonly string[]).includes(step.type);
}

// ============================================
// Selector Type Guards
// ============================================

import type {
  CssSelector,
  RoleSelector,
  Selector,
  SelectorInput,
  TestIdSelector,
  XPathSelector,
} from '../types';

export function isSelectorObject(input: SelectorInput): input is Selector {
  return typeof input === 'object' && 'strategy' in input;
}

export function isTestIdSelector(selector: Selector): selector is TestIdSelector {
  return selector.strategy === 'testId';
}

export function isRoleSelector(selector: Selector): selector is RoleSelector {
  return selector.strategy === 'role';
}

export function isCssSelector(selector: Selector): selector is CssSelector {
  return selector.strategy === 'css';
}

export function isXPathSelector(selector: Selector): selector is XPathSelector {
  return selector.strategy === 'xpath';
}
