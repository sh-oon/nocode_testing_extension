import type { Step } from '@like-cake/ast-types';

interface StepListProps {
  steps: Step[];
}

export function StepList({ steps }: StepListProps) {
  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
        <div className="text-4xl mb-4">🎬</div>
        <p className="text-center">
          No steps recorded yet.
          <br />
          Click "Start Recording" and interact with the page.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-800">
      {steps.map((step, index) => (
        <StepItem
          key={step.id || index}
          step={step}
          index={index}
        />
      ))}
    </div>
  );
}

interface StepItemProps {
  step: Step;
  index: number;
}

function StepItem({ step, index }: StepItemProps) {
  const { icon, color, label } = getStepDisplay(step);

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors">
      <div className="flex-shrink-0 w-6 text-center text-gray-500 text-sm">{index + 1}</div>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg ${color}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-gray-500 truncate mt-0.5">{getStepDetails(step)}</div>
      </div>
    </div>
  );
}

function getStepDisplay(step: Step): {
  icon: string;
  color: string;
  label: string;
} {
  switch (step.type) {
    case 'navigate':
      return {
        icon: '🔗',
        color: 'bg-blue-900/50',
        label: 'Navigate',
      };
    case 'click':
      return {
        icon: '👆',
        color: 'bg-green-900/50',
        label: 'Click',
      };
    case 'type':
      return {
        icon: '⌨️',
        color: 'bg-purple-900/50',
        label: 'Type',
      };
    case 'keypress':
      return {
        icon: '🔤',
        color: 'bg-yellow-900/50',
        label: `Press ${step.key}`,
      };
    case 'scroll':
      return {
        icon: '📜',
        color: 'bg-cyan-900/50',
        label: 'Scroll',
      };
    case 'hover':
      return {
        icon: '🎯',
        color: 'bg-orange-900/50',
        label: 'Hover',
      };
    case 'select':
      return {
        icon: '📋',
        color: 'bg-indigo-900/50',
        label: 'Select',
      };
    case 'wait':
      return {
        icon: '⏳',
        color: 'bg-gray-700',
        label: 'Wait',
      };
    case 'assertApi':
      return {
        icon: '🔍',
        color: 'bg-pink-900/50',
        label: 'Assert API',
      };
    case 'assertElement':
      return {
        icon: '✅',
        color: 'bg-teal-900/50',
        label: 'Assert Element',
      };
    case 'snapshotDom':
      return {
        icon: '📸',
        color: 'bg-red-900/50',
        label: 'Snapshot',
      };
    default:
      return {
        icon: '❓',
        color: 'bg-gray-700',
        label: 'Unknown',
      };
  }
}

function getStepDetails(step: Step): string {
  switch (step.type) {
    case 'navigate':
      return step.url;
    case 'click':
    case 'hover':
      return formatSelector(step.selector);
    case 'type':
      return step.sensitive
        ? `${formatSelector(step.selector)} → ********`
        : `${formatSelector(step.selector)} → "${step.value}"`;
    case 'keypress':
      return step.selector ? formatSelector(step.selector) : 'Document';
    case 'scroll':
      return step.position ? `y: ${step.position.y ?? 0}` : 'Element scroll';
    case 'select':
      return `${formatSelector(step.selector)} → ${
        Array.isArray(step.values) ? step.values.join(', ') : step.values
      }`;
    case 'wait':
      return step.strategy === 'time' ? `${step.duration}ms` : step.strategy;
    case 'assertApi':
      return step.match.url;
    case 'assertElement':
      return `${formatSelector(step.selector)} - ${step.assertion.type}`;
    case 'snapshotDom':
      return step.label;
    default:
      return '';
  }
}

function formatSelector(selector: string | { strategy: string; value: string }): string {
  if (typeof selector === 'string') {
    return selector;
  }
  if (selector.strategy === 'testId') {
    return `[data-testid="${selector.value}"]`;
  }
  return selector.value;
}
