import type { Step, StepResult } from '@like-cake/ast-types';

interface StepListProps {
  steps: Step[];
  currentStepIndex?: number;
  stepResults?: StepResult[];
}

export function StepList({ steps, currentStepIndex, stepResults }: StepListProps) {
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
      {steps.map((step, index) => {
        const result = stepResults?.[index];
        const isCurrent = currentStepIndex === index;

        return (
          <StepItem
            key={step.id || index}
            step={step}
            index={index}
            isCurrent={isCurrent}
            result={result}
          />
        );
      })}
    </div>
  );
}

interface StepItemProps {
  step: Step;
  index: number;
  isCurrent?: boolean;
  result?: StepResult;
}

function StepItem({ step, index, isCurrent, result }: StepItemProps) {
  const { icon, color, label } = getStepDisplay(step);

  // "Running" should only show if current AND no result yet
  const isRunning = isCurrent && !result;

  // Determine background based on state
  // Result takes precedence over "current" state
  let bgClass = 'hover:bg-gray-800/50';
  let borderClass = '';
  if (result) {
    // Show result state (passed/failed/skipped)
    if (result.status === 'passed') {
      bgClass = 'bg-green-900/20';
      borderClass = 'border-l-4 border-l-green-500';
    } else if (result.status === 'failed') {
      bgClass = 'bg-red-900/20';
      borderClass = 'border-l-4 border-l-red-500';
    } else if (result.status === 'skipped') {
      bgClass = 'bg-yellow-900/20';
      borderClass = 'border-l-4 border-l-yellow-500';
    }
  } else if (isCurrent) {
    // Only show "running" style if no result yet
    bgClass = 'bg-blue-900/30';
    borderClass = 'border-l-4 border-l-blue-500';
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 transition-colors ${bgClass} ${borderClass}`}>
      <div className="flex-shrink-0 w-6 text-center text-gray-500 text-sm">{index + 1}</div>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg ${color}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{label}</span>
          {isRunning && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              Running
            </span>
          )}
          {result && (
            <StepResultBadge
              status={result.status}
              duration={result.duration}
            />
          )}
        </div>
        <div className="text-xs text-gray-500 truncate mt-0.5">{getStepDetails(step)}</div>
        {result?.error && (
          <div className="mt-1 text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded">
            {result.error.message}
          </div>
        )}
      </div>
    </div>
  );
}

function StepResultBadge({ status, duration }: { status: string; duration?: number }) {
  const colors = {
    passed: 'bg-green-900/50 text-green-300',
    failed: 'bg-red-900/50 text-red-300',
    skipped: 'bg-yellow-900/50 text-yellow-300',
  };

  const icons = {
    passed: '✓',
    failed: '✗',
    skipped: '○',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${colors[status as keyof typeof colors] || 'bg-gray-700 text-gray-400'}`}
    >
      <span>{icons[status as keyof typeof icons] || '?'}</span>
      <span className="capitalize">{status}</span>
      {duration !== undefined && <span className="text-gray-400 ml-1">{duration}ms</span>}
    </span>
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
