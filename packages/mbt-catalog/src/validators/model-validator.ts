/**
 * TestModel structural + accessibility validator
 *
 * Checks the model for errors (must fix before execution) and
 * warnings (can proceed, but may cause issues).
 */

import { getEventById } from '../catalogs/events';
import { getVerificationById } from '../catalogs/verifications';
import type { TestModel } from '../types/model';
import { type UsageContext, validateBindingAccessibility } from './accessibility';

export interface ValidationIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  context?: {
    stateId?: string;
    transitionId?: string;
    bindingId?: string;
  };
}

/**
 * Validate a TestModel for structural errors and accessibility warnings.
 * Returns a sorted list: errors first, then warnings.
 */
export const validateTestModel = (model: TestModel): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  // ── Structural checks ──

  const initialStates = model.states.filter((s) => s.isInitial);
  const finalStates = model.states.filter((s) => s.isFinal);

  if (initialStates.length === 0) {
    issues.push({
      type: 'error',
      code: 'no-initial-state',
      message: '초기 상태가 없습니다. 모델에 Initial State가 필요합니다.',
    });
  }

  if (initialStates.length > 1) {
    issues.push({
      type: 'error',
      code: 'multiple-initial-states',
      message: `초기 상태가 ${initialStates.length}개입니다. 하나만 허용됩니다.`,
    });
  }

  if (finalStates.length === 0) {
    issues.push({
      type: 'error',
      code: 'no-final-state',
      message: '종료 상태가 없습니다. 모델에 Final State가 필요합니다.',
    });
  }

  // Check transitions
  const stateIds = new Set(model.states.map((s) => s.id));
  const referencedBindingIds = new Set<string>();

  for (const transition of model.transitions) {
    if (!transition.event.eventId) {
      issues.push({
        type: 'error',
        code: 'missing-event',
        message: `전이 "${transition.id}"에 이벤트가 설정되지 않았습니다.`,
        context: { transitionId: transition.id },
      });
    }

    // Check event binding requirement
    if (transition.event.eventId) {
      const eventEntry = getEventById(transition.event.eventId);
      if (eventEntry?.elementRequirement === 'required' && !transition.event.elementBindingId) {
        issues.push({
          type: 'error',
          code: 'missing-required-binding',
          message: `이벤트 "${eventEntry.label}"은 요소 바인딩이 필수입니다.`,
          context: { transitionId: transition.id },
        });
      }

      // Check required params
      if (eventEntry) {
        for (const param of eventEntry.params) {
          if (
            param.required &&
            (transition.event.params[param.name] === undefined ||
              transition.event.params[param.name] === '')
          ) {
            issues.push({
              type: 'error',
              code: 'missing-required-param',
              message: `이벤트 "${eventEntry.label}"의 필수 파라미터 "${param.label}"이 비어있습니다.`,
              context: { transitionId: transition.id },
            });
          }
        }
      }

      if (transition.event.elementBindingId) {
        referencedBindingIds.add(transition.event.elementBindingId);
      }
    }

    if (!stateIds.has(transition.sourceStateId)) {
      issues.push({
        type: 'error',
        code: 'invalid-source-state',
        message: `전이 "${transition.id}"의 소스 상태 "${transition.sourceStateId}"가 존재하지 않습니다.`,
        context: { transitionId: transition.id },
      });
    }

    if (!stateIds.has(transition.targetStateId)) {
      issues.push({
        type: 'error',
        code: 'invalid-target-state',
        message: `전이 "${transition.id}"의 대상 상태 "${transition.targetStateId}"가 존재하지 않습니다.`,
        context: { transitionId: transition.id },
      });
    }
  }

  // Check state verifications
  for (const state of model.states) {
    for (const v of state.verifications) {
      const verEntry = getVerificationById(v.verificationId);
      if (verEntry?.elementRequirement === 'required' && !v.elementBindingId) {
        issues.push({
          type: 'error',
          code: 'missing-required-binding',
          message: `상태 "${state.name}"의 검증 "${verEntry.label}"은 요소 바인딩이 필수입니다.`,
          context: { stateId: state.id },
        });
      }

      if (verEntry) {
        for (const param of verEntry.params) {
          if (
            param.required &&
            (v.params[param.name] === undefined || v.params[param.name] === '')
          ) {
            issues.push({
              type: 'error',
              code: 'missing-required-param',
              message: `상태 "${state.name}"의 검증 "${verEntry.label}" 필수 파라미터 "${param.label}"이 비어있습니다.`,
              context: { stateId: state.id },
            });
          }
        }
      }

      if (v.elementBindingId) {
        referencedBindingIds.add(v.elementBindingId);
      }
    }
  }

  // ── Reachability check ──

  if (initialStates.length === 1) {
    const reachable = new Set<string>();
    const queue = [initialStates[0].id];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (reachable.has(current)) continue;
      reachable.add(current);
      for (const t of model.transitions) {
        if (t.sourceStateId === current && !reachable.has(t.targetStateId)) {
          queue.push(t.targetStateId);
        }
      }
    }

    for (const state of model.states) {
      if (!state.isInitial && !reachable.has(state.id)) {
        issues.push({
          type: 'warning',
          code: 'unreachable-state',
          message: `상태 "${state.name}"는 초기 상태에서 도달할 수 없습니다.`,
          context: { stateId: state.id },
        });
      }
    }
  }

  // ── Orphan bindings ──

  for (const binding of model.elementBindings) {
    if (!referencedBindingIds.has(binding.id)) {
      issues.push({
        type: 'warning',
        code: 'orphan-binding',
        message: `요소 바인딩 "${binding.label}"이 어디서도 사용되지 않습니다.`,
        context: { bindingId: binding.id },
      });
    }
  }

  // ── Accessibility checks ──

  const bindingMap = new Map(model.elementBindings.map((b) => [b.id, b]));

  for (const transition of model.transitions) {
    if (transition.event.elementBindingId) {
      const binding = bindingMap.get(transition.event.elementBindingId);
      if (binding) {
        const context = inferUsageContext(transition.event.eventId);
        const a11yWarnings = validateBindingAccessibility(binding, context);
        for (const w of a11yWarnings) {
          issues.push({
            type: 'warning',
            code: `a11y-${w.rule}`,
            message: w.message,
            context: { transitionId: transition.id, bindingId: binding.id },
          });
        }
      }
    }
  }

  for (const state of model.states) {
    for (const v of state.verifications) {
      if (v.elementBindingId) {
        const binding = bindingMap.get(v.elementBindingId);
        if (binding) {
          const a11yWarnings = validateBindingAccessibility(binding, 'assert');
          for (const w of a11yWarnings) {
            issues.push({
              type: 'warning',
              code: `a11y-${w.rule}`,
              message: w.message,
              context: { stateId: state.id, bindingId: binding.id },
            });
          }
        }
      }
    }
  }

  // Sort: errors first, then warnings
  return issues.sort((a, b) => {
    if (a.type === 'error' && b.type === 'warning') return -1;
    if (a.type === 'warning' && b.type === 'error') return 1;
    return 0;
  });
};

/** Infer usage context from event ID */
const inferUsageContext = (eventId: string): UsageContext => {
  switch (eventId) {
    case 'click':
    case 'doubleClick':
      return 'click';
    case 'type':
    case 'clear':
    case 'select':
    case 'fileUpload':
      return 'type';
    case 'hover':
    case 'mouseout':
      return 'hover';
    default:
      return 'other';
  }
};

/** Count errors and warnings separately */
export const countIssues = (issues: ValidationIssue[]): { errors: number; warnings: number } => ({
  errors: issues.filter((i) => i.type === 'error').length,
  warnings: issues.filter((i) => i.type === 'warning').length,
});
