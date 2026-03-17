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
  BoundVerification,
  ModelState,
  ModelTransition,
  TestModel,
  ElementBinding,
} from '@like-cake/mbt-catalog';
import { nanoid } from '../../utils/nanoid';
import { StateNode, InitialStateNode, FinalStateNode } from './nodes';
import type { ModelToolboxNodeType } from './ModelToolbox';

const nodeTypes: NodeTypes = {
  state: StateNode,
  initialState: InitialStateNode,
  finalState: FinalStateNode,
};

interface ModelCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onToolboxDrop?: (type: ModelToolboxNodeType, position: { x: number; y: number }) => void;
  onNodeDoubleClick?: (nodeId: string, nodeType: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

export function ModelCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onToolboxDrop,
  onNodeDoubleClick,
  onEdgeClick,
}: ModelCanvasProps) {
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

      const toolboxType = event.dataTransfer.getData('model-toolbox-node') as ModelToolboxNodeType | '';
      if (toolboxType && onToolboxDrop) {
        onToolboxDrop(toolboxType, position);
      }
    },
    [onToolboxDrop]
  );

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeDoubleClick && node.type) {
        onNodeDoubleClick(node.id, node.type);
      }
    },
    [onNodeDoubleClick]
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      onEdgeClick?.(edge.id);
    },
    [onEdgeClick]
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
        onEdgeClick={handleEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        defaultEdgeOptions={{
          style: { strokeWidth: 2, stroke: '#f97316' },
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
              case 'initialState':
                return '#22c55e';
              case 'finalState':
                return '#ef4444';
              case 'state':
                return '#3b82f6';
              default:
                return '#6b7280';
            }
          }}
        />
      </ReactFlow>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  useModelState — nodes/edges CRUD + TestModel ↔ React Flow         */
/* ------------------------------------------------------------------ */

export interface ModelNodeData {
  stateId: string;
  name: string;
  verifications: BoundVerification[];
  verificationCount: number;
  isInitial?: boolean;
  isFinal?: boolean;
}

export interface ModelEdgeData {
  transitionId: string;
  event: ModelTransition['event'];
  guard?: ModelTransition['guard'];
}

export function useModelState() {
  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `edge-${nanoid(8)}`,
            style: { strokeWidth: 2, stroke: '#f97316' },
            type: 'smoothstep',
            label: 'event',
            data: {
              transitionId: nanoid(8),
              event: { eventId: '', elementBindingId: null, params: {} },
            },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const addStateNode = useCallback(
    (position: { x: number; y: number }) => {
      const stateId = nanoid(8);
      const newNode: Node = {
        id: `state-${stateId}`,
        type: 'state',
        position,
        data: {
          stateId,
          name: 'New State',
          verifications: [],
          verificationCount: 0,
        } satisfies ModelNodeData as unknown as Record<string, unknown>,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const addInitialStateNode = useCallback(
    (position: { x: number; y: number }) => {
      const exists = nodes.some((n) => n.type === 'initialState');
      if (exists) return;

      const stateId = nanoid(8);
      const newNode: Node = {
        id: `initial-${stateId}`,
        type: 'initialState',
        position,
        data: {
          stateId,
          name: 'Initial',
          verifications: [],
          verificationCount: 0,
          isInitial: true,
        } satisfies ModelNodeData as unknown as Record<string, unknown>,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes]
  );

  const addFinalStateNode = useCallback(
    (position: { x: number; y: number }) => {
      const stateId = nanoid(8);
      const newNode: Node = {
        id: `final-${stateId}`,
        type: 'finalState',
        position,
        data: {
          stateId,
          name: 'Final',
          verifications: [],
          verificationCount: 0,
          isFinal: true,
        } satisfies ModelNodeData as unknown as Record<string, unknown>,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes]
  );

  const updateNodeData = useCallback(
    (nodeId: string, data: Partial<ModelNodeData>) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const merged = { ...node.data, ...data };
            if ('verifications' in data) {
              (merged as Record<string, unknown>).verificationCount =
                (data.verifications ?? []).length;
            }
            return { ...node, data: merged };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const updateEdgeData = useCallback(
    (edgeId: string, data: Partial<ModelEdgeData>) => {
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === edgeId) {
            const merged = { ...(edge.data ?? {}), ...data };
            const eventLabel =
              (data.event?.eventId || (edge.data as ModelEdgeData | undefined)?.event?.eventId) || 'event';
            return { ...edge, data: merged, label: eventLabel };
          }
          return edge;
        })
      );
    },
    [setEdges]
  );

  const clearModel = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  /** Convert React Flow state → TestModel */
  const toTestModel = useCallback(
    (meta: { id: string; name: string; description?: string; baseUrl: string; elementBindings: ElementBinding[] }): TestModel => {
      const states: ModelState[] = nodes.map((node) => {
        const d = node.data as unknown as ModelNodeData;
        return {
          id: d.stateId,
          name: d.name,
          verifications: d.verifications || [],
          isInitial: d.isInitial,
          isFinal: d.isFinal,
        };
      });

      const transitions: ModelTransition[] = edges.map((edge) => {
        const d = (edge.data ?? {}) as unknown as ModelEdgeData;
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        return {
          id: d.transitionId || edge.id,
          sourceStateId: (sourceNode?.data as unknown as ModelNodeData)?.stateId || edge.source,
          targetStateId: (targetNode?.data as unknown as ModelNodeData)?.stateId || edge.target,
          event: d.event || { eventId: '', elementBindingId: null, params: {} },
          guard: d.guard,
        };
      });

      const now = Date.now();
      return {
        id: meta.id,
        name: meta.name,
        description: meta.description,
        states,
        transitions,
        elementBindings: meta.elementBindings,
        baseUrl: meta.baseUrl,
        meta: { createdAt: now, updatedAt: now, version: 1 },
      };
    },
    [nodes, edges]
  );

  /** Load TestModel → React Flow state */
  const fromTestModel = useCallback(
    (model: TestModel) => {
      const ySpacing = 150;
      const xCenter = 300;

      const rfNodes: Node[] = model.states.map((state, i) => {
        let nodeType = 'state';
        if (state.isInitial) nodeType = 'initialState';
        else if (state.isFinal) nodeType = 'finalState';

        return {
          id: `${nodeType}-${state.id}`,
          type: nodeType,
          position: { x: xCenter, y: i * ySpacing },
          data: {
            stateId: state.id,
            name: state.name,
            verifications: state.verifications,
            verificationCount: state.verifications.length,
            isInitial: state.isInitial,
            isFinal: state.isFinal,
          } satisfies ModelNodeData as unknown as Record<string, unknown>,
        };
      });

      // Build a stateId → nodeId lookup
      const stateIdToNodeId = new Map<string, string>();
      for (const node of rfNodes) {
        const d = node.data as unknown as ModelNodeData;
        stateIdToNodeId.set(d.stateId, node.id);
      }

      const rfEdges: Edge[] = model.transitions.map((t) => ({
        id: `edge-${t.id}`,
        source: stateIdToNodeId.get(t.sourceStateId) || t.sourceStateId,
        target: stateIdToNodeId.get(t.targetStateId) || t.targetStateId,
        style: { strokeWidth: 2, stroke: '#f97316' },
        type: 'smoothstep',
        label: t.event.eventId || 'event',
        data: {
          transitionId: t.id,
          event: t.event,
          guard: t.guard,
        } satisfies ModelEdgeData,
      }));

      setNodes(rfNodes);
      setEdges(rfEdges);
    },
    [setNodes, setEdges]
  );

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addStateNode,
    addInitialStateNode,
    addFinalStateNode,
    updateNodeData,
    updateEdgeData,
    clearModel,
    toTestModel,
    fromTestModel,
    setNodes,
    setEdges,
  };
}
