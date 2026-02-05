import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ControlNodeData } from '@like-cake/ast-types';

type EndNodeProps = NodeProps & {
  data: ControlNodeData;
};

export function EndNode({ data }: EndNodeProps) {
  return (
    <div className="px-4 py-2 bg-red-600 rounded-full shadow-lg border-2 border-red-400 min-w-[80px] text-center">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-red-400 !w-3 !h-3 !border-2 !border-red-600"
      />
      <div className="text-white text-sm font-semibold">{data.label || 'End'}</div>
    </div>
  );
}
