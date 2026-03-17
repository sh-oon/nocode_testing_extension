import type { DragEvent } from 'react';

export type ModelToolboxNodeType = 'state' | 'initialState' | 'finalState';

interface ToolboxItem {
  type: ModelToolboxNodeType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const toolboxItems: ToolboxItem[] = [
  {
    type: 'state',
    label: 'State',
    description: 'General state',
    icon: <StateIcon />,
    color: 'blue',
  },
  {
    type: 'initialState',
    label: 'Initial State',
    description: 'One per model',
    icon: <InitialIcon />,
    color: 'green',
  },
  {
    type: 'finalState',
    label: 'Final State',
    description: 'Multiple allowed',
    icon: <FinalIcon />,
    color: 'red',
  },
];

export function ModelToolbox() {
  const handleDragStart = (event: DragEvent<HTMLDivElement>, type: ModelToolboxNodeType) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.setData('model-toolbox-node', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-48 bg-gray-800 border-r border-gray-700 p-3 flex flex-col gap-2">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
        State Nodes
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
          Drag state nodes to the canvas. Connect states by dragging from handles to create transitions.
        </div>
      </div>
    </div>
  );
}

function StateIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={2} />
    </svg>
  );
}

function InitialIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 8l6 4-6 4V8z" />
    </svg>
  );
}

function FinalIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <circle cx="12" cy="12" r="5" strokeWidth={2} />
    </svg>
  );
}
