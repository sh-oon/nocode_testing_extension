import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ControlNodeData } from '@like-cake/ast-types';

type StartNodeProps = NodeProps & {
  data: ControlNodeData;
};

export function StartNode({ data }: StartNodeProps) {
  return (
    <div className="px-4 py-2 bg-green-600 rounded-full shadow-lg border-2 border-green-400 min-w-[80px] text-center">
      <div className="text-white text-sm font-semibold">{data.label || 'Start'}</div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-green-400 !w-3 !h-3 !border-2 !border-green-600"
      />
    </div>
  );
}
