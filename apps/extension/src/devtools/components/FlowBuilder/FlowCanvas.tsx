import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, type DragEvent } from 'react';
import type {
  ConditionNodeData,
  ControlNodeData,
  ExtractVariableNodeData,
  FlowEdge,
  FlowNode,
  ScenarioNodeData,
  SetVariableNodeData,
} from '@like-cake/ast-types';
import { nanoid } from '../../utils/nanoid';
import {
  StartNode,
  EndNode,
  ScenarioNode,
  ConditionNode,
  SetVariableNode,
  ExtractVariableNode,
} from './nodes';
import type { SidebarScenario } from './ScenarioSidebar';
import type { ToolboxNodeType } from './FlowToolbox';

const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  scenario: ScenarioNode,
  condition: ConditionNode,
  setVariable: SetVariableNode,
  extractVariable: ExtractVariableNode,
};

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onDrop: (scenario: SidebarScenario, position: { x: number; y: number }) => void;
  onToolboxDrop?: (type: ToolboxNodeType, position: { x: number; y: number }) => void;
  onNodeDoubleClick?: (nodeId: string, nodeType: string) => void;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDrop,
  onToolboxDrop,
  onNodeDoubleClick,
}: FlowCanvasProps) {
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 80,
        y: event.clientY - reactFlowBounds.top - 30,
      };

      // Check for toolbox node types first
      const toolboxType = event.dataTransfer.getData('toolbox-node') as ToolboxNodeType | '';
      if (toolboxType && onToolboxDrop) {
        onToolboxDrop(toolboxType, position);
        return;
      }

      // Handle scenario drop
      const type = event.dataTransfer.getData('application/reactflow');
      if (type !== 'scenario') return;

      const scenarioData = event.dataTransfer.getData('scenario');
      if (!scenarioData) return;

      const scenario = JSON.parse(scenarioData) as SidebarScenario;
      onDrop(scenario, position);
    },
    [onDrop, onToolboxDrop]
  );

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeDoubleClick && node.type) {
        onNodeDoubleClick(node.id, node.type);
      }
    },
    [onNodeDoubleClick]
  );

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={handleDrop}
        onNodeDoubleClick={handleNodeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          style: { strokeWidth: 2, stroke: '#6b7280' },
          type: 'smoothstep',
        }}
        className="bg-gray-900"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
        <Controls className="!bg-gray-800 !border-gray-700 !rounded-lg [&>button]:!bg-gray-700 [&>button]:!border-gray-600 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-600" />
        <MiniMap
          className="!bg-gray-800 !border-gray-700 !rounded-lg"
          nodeColor={(node) => {
            switch (node.type) {
              case 'start':
                return '#22c55e';
              case 'end':
                return '#ef4444';
              case 'scenario':
                return '#6366f1';
              case 'condition':
                return '#f59e0b';
              case 'setVariable':
                return '#a855f7';
              case 'extractVariable':
                return '#06b6d4';
              default:
                return '#6b7280';
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}

// Helper hooks for managing flow state
export function useFlowState(initialNodes: FlowNode[] = [], initialEdges: FlowEdge[] = []) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialNodes.map(flowNodeToReactFlowNode)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialEdges.map(flowEdgeToReactFlowEdge)
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // Color edges from condition nodes based on handle
      let strokeColor = '#6b7280';
      if (connection.sourceHandle === 'true') {
        strokeColor = '#22c55e'; // Green for true branch
      } else if (connection.sourceHandle === 'false') {
        strokeColor = '#ef4444'; // Red for false branch
      }

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `edge-${nanoid(8)}`,
            style: { strokeWidth: 2, stroke: strokeColor },
            type: 'smoothstep',
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const addScenarioNode = useCallback(
    (scenario: SidebarScenario, position: { x: number; y: number }) => {
      const data: ScenarioNodeData = {
        scenarioId: scenario.id,
        scenarioName: scenario.name || 'Unnamed',
        stepCount: scenario.stepCount,
        status: 'pending',
      };
      const newNode: Node = {
        id: `node-${nanoid(8)}`,
        type: 'scenario',
        position,
        data: data as unknown as Record<string, unknown>,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const addConditionNode = useCallback(
    (position: { x: number; y: number }) => {
      const data: ConditionNodeData = {
        label: 'Condition',
        condition: {
          left: '{{variableName}}',
          operator: 'eq',
          right: 'value',
        },
        status: 'pending',
      };
      const newNode: Node = {
        id: `node-${nanoid(8)}`,
        type: 'condition',
        position,
        data: data as unknown as Record<string, unknown>,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const addSetVariableNode = useCallback(
    (position: { x: number; y: number }) => {
      const data: SetVariableNodeData = {
        label: 'Set Variables',
        variables: [{ name: 'variableName', value: '', type: 'string' }],
        status: 'pending',
      };
      const newNode: Node = {
        id: `node-${nanoid(8)}`,
        type: 'setVariable',
        position,
        data: data as unknown as Record<string, unknown>,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const addExtractVariableNode = useCallback(
    (position: { x: number; y: number }) => {
      const data: ExtractVariableNodeData = {
        label: 'Extract Variables',
        extractions: [{ variableName: '', source: 'lastApiResponse', jsonPath: '$.data' }],
        status: 'pending',
      };
      const newNode: Node = {
        id: `node-${nanoid(8)}`,
        type: 'extractVariable',
        position,
        data: data as unknown as Record<string, unknown>,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<ConditionNodeData | SetVariableNodeData | ExtractVariableNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: { ...node.data, ...data },
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const addStartNode = useCallback(
    (position: { x: number; y: number } = { x: 250, y: 50 }) => {
      const exists = nodes.some((n) => n.type === 'start');
      if (exists) return;

      const newNode: Node = {
        id: 'start',
        type: 'start',
        position,
        data: { label: 'Start' },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes]
  );

  const addEndNode = useCallback(
    (position: { x: number; y: number } = { x: 250, y: 400 }) => {
      const exists = nodes.some((n) => n.type === 'end');
      if (exists) return;

      const newNode: Node = {
        id: 'end',
        type: 'end',
        position,
        data: { label: 'End' },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes]
  );

  const clearFlow = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  const updateNodeStatus = useCallback(
    (nodeId: string, status: ScenarioNodeData['status']) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            // Update status for scenario, condition, setVariable, extractVariable nodes
            const updatableTypes = ['scenario', 'condition', 'setVariable', 'extractVariable'];
            if (updatableTypes.includes(node.type || '')) {
              return {
                ...node,
                data: { ...node.data, status },
              };
            }
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const resetNodeStatuses = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const resettableTypes = ['scenario', 'condition', 'setVariable', 'extractVariable'];
        if (resettableTypes.includes(node.type || '')) {
          return {
            ...node,
            data: { ...node.data, status: 'pending', lastResult: undefined },
          };
        }
        return node;
      })
    );
  }, [setNodes]);

  const getFlowData = useCallback((): { nodes: FlowNode[]; edges: FlowEdge[] } => {
    return {
      nodes: nodes.map(reactFlowNodeToFlowNode),
      edges: edges.map(reactFlowEdgeToFlowEdge),
    };
  }, [nodes, edges]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addScenarioNode,
    addConditionNode,
    addSetVariableNode,
    addExtractVariableNode,
    addStartNode,
    addEndNode,
    clearFlow,
    updateNodeStatus,
    updateNodeData,
    resetNodeStatuses,
    getFlowData,
    setNodes,
    setEdges,
  };
}

// Converters between FlowNode/FlowEdge and React Flow Node/Edge
function flowNodeToReactFlowNode(flowNode: FlowNode): Node {
  return {
    id: flowNode.id,
    type: flowNode.type,
    position: flowNode.position,
    data: flowNode.data as unknown as Record<string, unknown>,
  };
}

function reactFlowNodeToFlowNode(node: Node): FlowNode {
  const baseNode = {
    id: node.id,
    position: node.position,
  };

  switch (node.type) {
    case 'scenario':
      return {
        ...baseNode,
        type: 'scenario',
        data: node.data as unknown as ScenarioNodeData,
      };
    case 'start':
      return {
        ...baseNode,
        type: 'start',
        data: node.data as unknown as ControlNodeData,
      };
    case 'end':
      return {
        ...baseNode,
        type: 'end',
        data: node.data as unknown as ControlNodeData,
      };
    case 'condition':
      return {
        ...baseNode,
        type: 'condition',
        data: node.data as unknown as ConditionNodeData,
      };
    case 'setVariable':
      return {
        ...baseNode,
        type: 'setVariable',
        data: node.data as unknown as SetVariableNodeData,
      };
    case 'extractVariable':
      return {
        ...baseNode,
        type: 'extractVariable',
        data: node.data as unknown as ExtractVariableNodeData,
      };
    default:
      return {
        ...baseNode,
        type: 'end',
        data: node.data as unknown as ControlNodeData,
      };
  }
}

function flowEdgeToReactFlowEdge(flowEdge: FlowEdge): Edge {
  // Color edges based on condition branch
  let strokeColor = '#6b7280';
  if (flowEdge.sourceHandle === 'true') {
    strokeColor = '#22c55e'; // Green for true branch
  } else if (flowEdge.sourceHandle === 'false') {
    strokeColor = '#ef4444'; // Red for false branch
  }

  return {
    id: flowEdge.id,
    source: flowEdge.source,
    target: flowEdge.target,
    sourceHandle: flowEdge.sourceHandle,
    targetHandle: flowEdge.targetHandle,
    label: flowEdge.label,
    style: { strokeWidth: 2, stroke: strokeColor },
    type: flowEdge.type || 'smoothstep',
    animated: flowEdge.animated,
  };
}

function reactFlowEdgeToFlowEdge(edge: Edge): FlowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle as FlowEdge['sourceHandle'],
    targetHandle: edge.targetHandle || undefined,
    label: typeof edge.label === 'string' ? edge.label : undefined,
    type: edge.type as FlowEdge['type'],
    animated: edge.animated,
  };
}
