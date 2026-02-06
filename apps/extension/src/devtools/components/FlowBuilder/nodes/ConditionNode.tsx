import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ConditionNodeData, ConditionOperator } from '@like-cake/ast-types';

type ConditionNodeProps = NodeProps & {
  data: ConditionNodeData;
};

const operatorLabels: Record<ConditionOperator, string> = {
  eq: '=',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  contains: 'contains',
  startsWith: 'starts with',
  endsWith: 'ends with',
  matches: 'matches',
  exists: 'exists',
  isEmpty: 'is empty',
};

export function ConditionNode({ data, selected }: ConditionNodeProps) {
  const statusColors = {
    pending: 'border-gray-500 bg-gray-800',
    running: 'border-blue-500 bg-blue-900/50 animate-pulse',
    passed: 'border-green-500 bg-green-900/50',
    failed: 'border-red-500 bg-red-900/50',
    skipped: 'border-yellow-500 bg-yellow-900/50',
  };

  const statusIcons = {
    pending: null,
    running: <LoadingSpinner />,
    passed: <CheckIcon />,
    failed: <XIcon />,
    skipped: <SkipIcon />,
  };

  const status = data.status || 'pending';
  const { condition, lastResult } = data;

  // Format condition for display
  const conditionPreview = formatCondition(condition);

  return (
    <div className="relative">
      {/* Diamond shape container */}
      <div
        className={`w-[140px] h-[140px] rotate-45 rounded-lg shadow-lg border-2 transition-all ${
          statusColors[status]
        } ${selected ? 'ring-2 ring-primary-400 ring-offset-2 ring-offset-gray-900' : ''}`}
      >
        {/* Content (counter-rotated to be upright) */}
        <div className="-rotate-45 absolute inset-0 flex flex-col items-center justify-center p-2">
          <div className="flex items-center gap-1 mb-1">
            <ConditionIcon />
            {statusIcons[status] && (
              <span className="ml-1">{statusIcons[status]}</span>
            )}
          </div>
          <div className="text-white text-xs font-medium text-center truncate max-w-[100px]">
            {data.label || 'Condition'}
          </div>
          <div className="text-gray-400 text-[10px] text-center mt-1 max-w-[110px] truncate" title={conditionPreview}>
            {conditionPreview}
          </div>
          {lastResult !== undefined && (
            <div className={`text-[10px] mt-1 font-medium ${lastResult ? 'text-green-400' : 'text-red-400'}`}>
              Result: {lastResult ? 'true' : 'false'}
            </div>
          )}
        </div>
      </div>

      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-gray-600 !top-[-6px] !left-1/2 !-translate-x-1/2"
        id="input"
      />

      {/* True output handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-green-400 !w-3 !h-3 !border-2 !border-green-600 !right-[-6px] !top-1/2 !-translate-y-1/2"
        id="true"
      />
      <div className="absolute right-[-24px] top-1/2 -translate-y-1/2 text-green-400 text-[10px] font-medium">
        T
      </div>

      {/* False output handle (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-red-400 !w-3 !h-3 !border-2 !border-red-600 !bottom-[-6px] !left-1/2 !-translate-x-1/2"
        id="false"
      />
      <div className="absolute bottom-[-20px] left-1/2 -translate-x-1/2 text-red-400 text-[10px] font-medium">
        F
      </div>
    </div>
  );
}

function formatCondition(condition: ConditionNodeData['condition']): string {
  if (!condition) return 'No condition';

  const { left, operator, right } = condition;
  const opLabel = operatorLabels[operator] || operator;

  // Unary operators
  if (operator === 'exists' || operator === 'isEmpty') {
    return `${truncate(left, 15)} ${opLabel}`;
  }

  return `${truncate(left, 10)} ${opLabel} ${truncate(right || '', 10)}`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 2)}..`;
}

function ConditionIcon() {
  return (
    <svg
      className="w-5 h-5 text-amber-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="w-3 h-3 text-blue-400 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-3 h-3 text-green-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="w-3 h-3 text-red-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg
      className="w-3 h-3 text-yellow-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 5l7 7-7 7M5 5l7 7-7 7"
      />
    </svg>
  );
}
