import { useState } from 'react';
import type { Step, StepResult } from '@like-cake/ast-types';
import { StepEditor } from './StepEditor';

interface StepListProps {
  steps: Step[];
  currentStepIndex?: number;
  stepResults?: StepResult[];
  editable?: boolean;
  onStepUpdate?: (index: number, step: Step) => void;
}

export function StepList({
  steps,
  currentStepIndex,
  stepResults,
  editable,
  onStepUpdate,
}: StepListProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
    <>
      <div className="divide-y divide-gray-200">
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
              editable={editable}
              onEdit={() => setEditingIndex(index)}
            />
          );
        })}
      </div>

      {editingIndex !== null && (
        <StepEditor
          step={steps[editingIndex]}
          stepIndex={editingIndex}
          onSave={(updatedStep) => {
            onStepUpdate?.(editingIndex, updatedStep);
            setEditingIndex(null);
          }}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </>
  );
}

interface StepItemProps {
  step: Step;
  index: number;
  isCurrent?: boolean;
  result?: StepResult;
  editable?: boolean;
  onEdit?: () => void;
}

function StepItem({ step, index, isCurrent, result, editable, onEdit }: StepItemProps) {
  const { icon, color, label } = getStepDisplay(step);

  // "Running" should only show if current AND no result yet
  const isRunning = isCurrent && !result;

  // Determine background based on state
  // Result takes precedence over "current" state
  let bgClass = 'hover:bg-gray-50';
  let borderClass = '';
  if (result) {
    // Show result state (passed/failed/skipped)
    if (result.status === 'passed') {
      bgClass = 'bg-green-50';
      borderClass = 'border-l-4 border-l-green-500';
    } else if (result.status === 'failed') {
      bgClass = 'bg-red-50';
      borderClass = 'border-l-4 border-l-red-500';
    } else if (result.status === 'skipped') {
      bgClass = 'bg-yellow-50';
      borderClass = 'border-l-4 border-l-yellow-500';
    }
  } else if (isCurrent) {
    // Only show "running" style if no result yet
    bgClass = 'bg-blue-50';
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
            <span className="flex items-center gap-1 text-xs text-blue-600">
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
          <div className="mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
            {result.error.message}
          </div>
        )}
      </div>
      {editable && (
        <button
          type="button"
          onClick={onEdit}
          className="flex-shrink-0 p-1.5 text-gray-500 hover:text-blue-600 transition-colors"
          title="Edit step"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function StepResultBadge({ status, duration }: { status: string; duration?: number }) {
  const colors = {
    passed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    skipped: 'bg-yellow-100 text-yellow-700',
  };

  const icons = {
    passed: '✓',
    failed: '✗',
    skipped: '○',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-500'}`}
    >
      <span>{icons[status as keyof typeof icons] || '?'}</span>
      <span className="capitalize">{status}</span>
      {duration !== undefined && <span className="text-gray-500 ml-1">{duration}ms</span>}
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
        color: 'bg-blue-100',
        label: 'Navigate',
      };
    case 'click':
      return {
        icon: '👆',
        color: 'bg-green-100',
        label: 'Click',
      };
    case 'type':
      return {
        icon: '⌨️',
        color: 'bg-purple-100',
        label: 'Type',
      };
    case 'keypress':
      return {
        icon: '🔤',
        color: 'bg-yellow-100',
        label: `Press ${step.key}`,
      };
    case 'scroll':
      return {
        icon: '📜',
        color: 'bg-cyan-100',
        label: 'Scroll',
      };
    case 'hover':
      return {
        icon: '🎯',
        color: 'bg-orange-100',
        label: 'Hover',
      };
    case 'select':
      return {
        icon: '📋',
        color: 'bg-indigo-100',
        label: 'Select',
      };
    case 'wait':
      return {
        icon: '⏳',
        color: 'bg-gray-100',
        label: 'Wait',
      };
    case 'assertApi':
      return {
        icon: '🔍',
        color: 'bg-pink-100',
        label: 'Assert API',
      };
    case 'assertElement':
      return {
        icon: '✅',
        color: 'bg-teal-100',
        label: 'Assert Element',
      };
    case 'snapshotDom':
      return {
        icon: '📸',
        color: 'bg-red-100',
        label: 'Snapshot',
      };
    default:
      return {
        icon: '❓',
        color: 'bg-gray-100',
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
