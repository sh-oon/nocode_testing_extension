import { Handle, Position, type NodeProps } from '@xyflow/react';

interface StateNodeData {
  name: string;
  verificationCount: number;
}

type StateNodeProps = NodeProps & {
  data: StateNodeData;
};

export function StateNode({ data }: StateNodeProps) {
  return (
    <div className="px-4 py-3 bg-gray-700 rounded-lg shadow-lg border-2 border-blue-500 min-w-[140px]">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-600"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left-target"
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-600"
      />
      <div className="text-white text-sm font-semibold text-center">
        {data.name || 'State'}
      </div>
      {data.verificationCount > 0 && (
        <div className="mt-1 text-center">
          <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-blue-600/30 text-blue-300 rounded-full">
            {data.verificationCount} verification{data.verificationCount > 1 ? 's' : ''}
          </span>
        </div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-600"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right-source"
        className="!bg-blue-400 !w-3 !h-3 !border-2 !border-blue-600"
      />
    </div>
  );
}
