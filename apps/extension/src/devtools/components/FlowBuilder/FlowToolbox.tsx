import type { DragEvent } from 'react';

export type ToolboxNodeType = 'condition' | 'setVariable' | 'extractVariable';

interface ToolboxItem {
  type: ToolboxNodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const toolboxItems: ToolboxItem[] = [
  {
    type: 'condition',
    label: 'Condition',
    description: 'IF/ELSE branching',
    icon: <ConditionIcon />,
    color: 'amber',
  },
  {
    type: 'setVariable',
    label: 'Set Variable',
    description: 'Assign values',
    icon: <SetVariableIcon />,
    color: 'purple',
  },
  {
    type: 'extractVariable',
    label: 'Extract Variable',
    description: 'Capture values',
    icon: <ExtractVariableIcon />,
    color: 'cyan',
  },
];

interface FlowToolboxProps {
  onNodeDragStart?: (type: ToolboxNodeType) => void;
}

export function FlowToolbox({ onNodeDragStart }: FlowToolboxProps) {
  const handleDragStart = (event: DragEvent<HTMLDivElement>, type: ToolboxNodeType) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.setData('toolbox-node', type);
    event.dataTransfer.effectAllowed = 'move';
    onNodeDragStart?.(type);
  };

  return (
    <div className="w-48 bg-gray-800 border-r border-gray-700 p-3 flex flex-col gap-2">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
        Control Nodes
      </div>

      {toolboxItems.map((item) => (
        <div
          key={item.type}
          draggable
          onDragStart={(e) => handleDragStart(e, item.type)}
          className={`
            p-3 rounded-lg cursor-grab active:cursor-grabbing
            bg-gray-700 hover:bg-gray-600 transition-colors
            border border-gray-600 hover:border-${item.color}-500/50
            group
          `}
        >
          <div className="flex items-center gap-2">
            <div className={`text-${item.color}-400`}>{item.icon}</div>
            <div>
              <div className="text-sm font-medium text-white">{item.label}</div>
              <div className="text-[10px] text-gray-400">{item.description}</div>
            </div>
          </div>
        </div>
      ))}

      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="text-[10px] text-gray-500 leading-relaxed">
          Drag nodes to the canvas to add them to your flow. Connect nodes by dragging from handles.
        </div>
      </div>
    </div>
  );
}

function ConditionIcon() {
  return (
    <svg
      className="w-5 h-5"
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

function SetVariableIcon() {
  return (
    <svg
      className="w-5 h-5"
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

function ExtractVariableIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
      />
    </svg>
  );
}
