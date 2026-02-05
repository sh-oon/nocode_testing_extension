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
import type { ControlNodeData, FlowEdge, FlowNode, ScenarioNodeData } from '@like-cake/ast-types';
import { nanoid } from '../../utils/nanoid';
import { StartNode, EndNode, ScenarioNode } from './nodes';
import type { SidebarScenario } from './ScenarioSidebar';

const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  scenario: ScenarioNode,
};

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onDrop: (scenario: SidebarScenario, position: { x: number; y: number }) => void;
}

export function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDrop,
}: FlowCanvasProps) {
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      if (type !== 'scenario') return;

      const scenarioData = event.dataTransfer.getData('scenario');
      if (!scenarioData) return;

      const scenario = JSON.parse(scenarioData) as SidebarScenario;

      // Get the position relative to the canvas
      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 80, // Center the node
        y: event.clientY - reactFlowBounds.top - 30,
      };

      onDrop(scenario, position);
    },
    [onDrop]
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
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `edge-${nanoid(8)}`,
            style: { strokeWidth: 2, stroke: '#6b7280' },
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
          if (node.id === nodeId && node.type === 'scenario') {
            return {
              ...node,
              data: { ...node.data, status },
            };
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
        if (node.type === 'scenario') {
          return {
            ...node,
            data: { ...node.data, status: 'pending' },
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
    addStartNode,
    addEndNode,
    clearFlow,
    updateNodeStatus,
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

  if (node.type === 'scenario') {
    return {
      ...baseNode,
      type: 'scenario',
      data: node.data as unknown as ScenarioNodeData,
    };
  }
  if (node.type === 'start') {
    return {
      ...baseNode,
      type: 'start',
      data: node.data as unknown as ControlNodeData,
    };
  }
  return {
    ...baseNode,
    type: 'end',
    data: node.data as unknown as ControlNodeData,
  };
}

function flowEdgeToReactFlowEdge(flowEdge: FlowEdge): Edge {
  return {
    id: flowEdge.id,
    source: flowEdge.source,
    target: flowEdge.target,
    label: flowEdge.label,
    style: { strokeWidth: 2, stroke: '#6b7280' },
    type: 'smoothstep',
  };
}

function reactFlowEdgeToFlowEdge(edge: Edge): FlowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: typeof edge.label === 'string' ? edge.label : undefined,
  };
}
