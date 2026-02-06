import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SetVariableNodeData } from '@like-cake/ast-types';

type SetVariableNodeProps = NodeProps & {
  data: SetVariableNodeData;
};

export function SetVariableNode({ data, selected }: SetVariableNodeProps) {
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
  const variableCount = data.variables?.length || 0;

  return (
    <div
      className={`px-4 py-3 rounded-lg shadow-lg border-2 min-w-[160px] transition-all ${
        statusColors[status]
      } ${selected ? 'ring-2 ring-primary-400 ring-offset-2 ring-offset-gray-900' : ''}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-gray-600"
      />

      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          <SetVariableIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">
            {data.label || 'Set Variables'}
          </div>
          <div className="text-gray-400 text-xs mt-1">
            {variableCount} variable{variableCount !== 1 ? 's' : ''}
          </div>
          {/* Preview first variable */}
          {data.variables && data.variables.length > 0 && (
            <div className="text-purple-400 text-[10px] mt-1 truncate max-w-[120px]" title={`${data.variables[0].name} = ${data.variables[0].value}`}>
              {data.variables[0].name} = {truncate(data.variables[0].value, 10)}
              {variableCount > 1 && <span className="text-gray-500"> +{variableCount - 1}</span>}
            </div>
          )}
        </div>
        {statusIcons[status] && (
          <div className="flex-shrink-0">{statusIcons[status]}</div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-gray-400 !w-3 !h-3 !border-2 !border-gray-600"
      />
    </div>
  );
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen - 2)}..`;
}

function SetVariableIcon() {
  return (
    <svg
      className="w-4 h-4 text-purple-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="w-4 h-4 text-blue-400 animate-spin"
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
      className="w-4 h-4 text-green-400"
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
      className="w-4 h-4 text-red-400"
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
      className="w-4 h-4 text-yellow-400"
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
