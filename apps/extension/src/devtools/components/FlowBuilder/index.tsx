import { ReactFlowProvider } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';
import type {
  ConditionNodeData,
  ExtractVariableNodeData,
  SetVariableNodeData,
} from '@like-cake/ast-types';
import { getApiClient } from '../../../shared/api';
import { ScenarioDetailPanel } from '../ScenarioDetailPanel';
import { FlowCanvas, useFlowState } from './FlowCanvas';
import { FlowToolbar } from './FlowToolbar';
import { FlowToolbox, type ToolboxNodeType } from './FlowToolbox';
import { ScenarioSidebar, type SidebarScenario } from './ScenarioSidebar';
import { ConditionEditor, VariableEditor, ExtractionEditor } from './editors';

interface FlowBuilderProps {
  isConnected: boolean;
}

interface ExecutionSummary {
  status: 'passed' | 'failed' | 'skipped';
  totalNodes: number;
  passedNodes: number;
  failedNodes: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  duration: number;
  errors?: string[];
}

function FlowBuilderInner({ isConnected }: FlowBuilderProps) {
  // Scenarios from backend
  const [scenarios, setScenarios] = useState<SidebarScenario[]>([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);

  // Flow state
  const [flowId, setFlowId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState('');
  const [isModified, setIsModified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null);

  // Scenario detail panel state
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

  // React Flow state
  const {
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
  } = useFlowState();

  // Node editing state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeType, setEditingNodeType] = useState<string | null>(null);

  // Load scenarios from backend
  const loadScenarios = useCallback(async () => {
    if (!isConnected) return;

    setIsLoadingScenarios(true);
    try {
      const client = await getApiClient();
      const response = await client.listScenarios();
      if (response.success && response.data) {
        const items = response.data.items || [];
        setScenarios(
          items.map((s: { id: string; name?: string; steps?: unknown[] }) => ({
            id: s.id,
            name: s.name || 'Unnamed',
            stepCount: s.steps?.length || 0,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error);
    } finally {
      setIsLoadingScenarios(false);
    }
  }, [isConnected]);

  // Load scenarios on mount
  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  // Add default Start/End nodes when canvas is empty
  useEffect(() => {
    if (nodes.length === 0) {
      addStartNode({ x: 250, y: 50 });
      addEndNode({ x: 250, y: 400 });
    }
  }, [nodes.length, addStartNode, addEndNode]);

  // Mark as modified when nodes/edges change
  useEffect(() => {
    setIsModified(true);
  }, [nodes, edges]);

  // Handle scenario drop
  const handleDrop = useCallback(
    (scenario: SidebarScenario, position: { x: number; y: number }) => {
      addScenarioNode(scenario, position);
    },
    [addScenarioNode]
  );

  // Handle toolbox node drop
  const handleToolboxDrop = useCallback(
    (type: ToolboxNodeType, position: { x: number; y: number }) => {
      switch (type) {
        case 'condition':
          addConditionNode(position);
          break;
        case 'setVariable':
          addSetVariableNode(position);
          break;
        case 'extractVariable':
          addExtractVariableNode(position);
          break;
      }
    },
    [addConditionNode, addSetVariableNode, addExtractVariableNode]
  );

  // Handle node double click for editing
  const handleNodeDoubleClick = useCallback((nodeId: string, nodeType: string) => {
    if (['condition', 'setVariable', 'extractVariable'].includes(nodeType)) {
      setEditingNodeId(nodeId);
      setEditingNodeType(nodeType);
    } else if (nodeType === 'scenario') {
      // Open ScenarioDetailPanel for scenario nodes
      const node = nodes.find((n) => n.id === nodeId);
      const scenarioId = (node?.data as Record<string, unknown>)?.scenarioId as string;
      if (scenarioId) {
        setSelectedScenarioId(scenarioId);
        setIsDetailPanelOpen(true);
      }
    }
  }, [nodes]);

  // Close node editor
  const handleCloseEditor = useCallback(() => {
    setEditingNodeId(null);
    setEditingNodeType(null);
  }, []);

  // Get editing node data
  const getEditingNodeData = useCallback(() => {
    if (!editingNodeId) return null;
    const node = nodes.find((n) => n.id === editingNodeId);
    return node?.data || null;
  }, [editingNodeId, nodes]);

  // Handle scenario edit
  const handleScenarioEdit = useCallback((scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setIsDetailPanelOpen(true);
  }, []);

  // Handle scenario update (after editing)
  const handleScenarioUpdate = useCallback(() => {
    // Reload scenarios to reflect changes
    loadScenarios();
  }, [loadScenarios]);

  // Handle scenario delete
  const handleScenarioDelete = useCallback(
    (deletedId: string) => {
      setScenarios((prev) => prev.filter((s) => s.id !== deletedId));
    },
    []
  );

  // Handle save - returns the saved flow ID (or null on failure)
  const handleSave = useCallback(async (): Promise<string | null> => {
    if (!isConnected || !flowName.trim()) {
      alert('Please enter a flow name');
      return null;
    }

    setIsSaving(true);
    try {
      const client = await getApiClient();
      const flowData = getFlowData();

      if (flowId) {
        // Update existing flow
        const response = await client.updateUserFlow(flowId, {
          name: flowName,
          nodes: flowData.nodes,
          edges: flowData.edges,
        });
        if (response.success) {
          setIsModified(false);
          return flowId;
        }
      } else {
        // Create new flow
        const response = await client.createUserFlow({
          name: flowName,
          nodes: flowData.nodes,
          edges: flowData.edges,
        });
        if (response.success && response.data) {
          setFlowId(response.data.id);
          setIsModified(false);
          return response.data.id;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to save flow:', error);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [isConnected, flowName, flowId, getFlowData]);

  // Handle execute
  const handleExecute = useCallback(async () => {
    if (!isConnected) return;

    // Ensure flow name is provided before attempting save
    if (!flowName.trim()) {
      alert('Please enter a flow name before executing.');
      return;
    }

    // Save first if not saved or modified, and use the returned ID
    let currentFlowId = flowId;
    if (!currentFlowId || isModified) {
      const savedId = await handleSave();
      if (savedId) {
        currentFlowId = savedId;
      }
    }

    if (!currentFlowId) {
      alert('Failed to save the flow. Check the backend connection and try again.');
      return;
    }

    setIsExecuting(true);
    setExecutionSummary(null);
    resetNodeStatuses();

    try {
      const client = await getApiClient();
      const response = await client.executeUserFlow(currentFlowId, {
        headless: false,
      });

      if (response.success && response.data) {
        const result = response.data;

        // Update node statuses based on results
        const errors: string[] = [];
        for (const nodeResult of result.nodeResults || []) {
          updateNodeStatus(nodeResult.nodeId, nodeResult.status);
          if (nodeResult.status === 'failed' && nodeResult.error?.message) {
            errors.push(nodeResult.error.message);
          }
        }

        setExecutionSummary({
          status: result.status,
          totalNodes: result.summary?.totalNodes || 0,
          passedNodes: result.summary?.passedNodes || 0,
          failedNodes: result.summary?.failedNodes || 0,
          totalSteps: result.summary?.totalSteps || 0,
          passedSteps: result.summary?.passedSteps || 0,
          failedSteps: result.summary?.failedSteps || 0,
          duration: result.summary?.duration || 0,
          errors: errors.length > 0 ? errors : undefined,
        });
      } else if (!response.success) {
        setExecutionSummary({
          status: 'failed',
          totalNodes: 0,
          passedNodes: 0,
          failedNodes: 0,
          totalSteps: 0,
          passedSteps: 0,
          failedSteps: 0,
          duration: 0,
          errors: [response.error || 'Unknown execution error'],
        });
      }
    } catch (error) {
      console.error('Failed to execute flow:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [isConnected, flowName, flowId, isModified, handleSave, resetNodeStatuses, updateNodeStatus]);

  // Handle clear
  const handleClear = useCallback(() => {
    if (!confirm('Clear all nodes? This cannot be undone.')) return;
    clearFlow();
    setFlowId(null);
    setFlowName('');
    setIsModified(false);
    setExecutionSummary(null);
    // Re-add default nodes after clearing
    setTimeout(() => {
      addStartNode({ x: 250, y: 50 });
      addEndNode({ x: 250, y: 400 });
    }, 0);
  }, [clearFlow, addStartNode, addEndNode]);

  const hasScenarioNodes = nodes.some((n) => n.type === 'scenario');

  return (
    <div className="flex flex-col h-full">
      <FlowToolbar
        flowName={flowName}
        onNameChange={setFlowName}
        onSave={handleSave}
        onExecute={handleExecute}
        onClear={handleClear}
        isSaving={isSaving}
        isExecuting={isExecuting}
        hasNodes={hasScenarioNodes}
        isModified={isModified}
      />

      {/* Execution Summary */}
      {executionSummary && (
        <div
          className={`px-4 py-2 flex items-center justify-between text-sm ${
            executionSummary.status === 'passed'
              ? 'bg-green-900/50 border-b border-green-800 text-green-200'
              : 'bg-red-900/50 border-b border-red-800 text-red-200'
          }`}
        >
          <div className="flex items-center gap-4">
            <span className="font-medium">
              {executionSummary.status === 'passed' ? '✓ Flow Passed' : '✗ Flow Failed'}
            </span>
            <span className="text-xs opacity-75">
              Nodes: {executionSummary.passedNodes}/{executionSummary.totalNodes} |{' '}
              Steps: {executionSummary.passedSteps}/{executionSummary.totalSteps} |{' '}
              Duration: {(executionSummary.duration / 1000).toFixed(1)}s
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExecutionSummary(null)}
            className="text-xs hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Details */}
      {executionSummary?.errors && executionSummary.errors.length > 0 && (
        <div className="px-4 py-2 bg-red-950/50 border-b border-red-900 text-xs font-mono text-red-300 max-h-32 overflow-y-auto">
          {executionSummary.errors.map((err, i) => (
            <div key={i} className="py-0.5">
              {err}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <ScenarioSidebar
          scenarios={scenarios}
          isLoading={isLoadingScenarios}
          onRefresh={loadScenarios}
          onScenarioEdit={handleScenarioEdit}
        />

        <FlowToolbox />

        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={handleDrop}
          onToolboxDrop={handleToolboxDrop}
          onNodeDoubleClick={handleNodeDoubleClick}
        />
      </div>

      {!isConnected && (
        <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-400 mb-2">Backend not connected</div>
            <div className="text-sm text-gray-500">
              Connect to the backend to use the Flow Builder
            </div>
          </div>
        </div>
      )}

      {/* Scenario Detail Panel */}
      {selectedScenarioId && (
        <ScenarioDetailPanel
          scenarioId={selectedScenarioId}
          isOpen={isDetailPanelOpen}
          onClose={() => {
            setIsDetailPanelOpen(false);
            setSelectedScenarioId(null);
          }}
          onUpdate={handleScenarioUpdate}
          onDelete={handleScenarioDelete}
        />
      )}

      {/* Node Editors */}
      {editingNodeId && editingNodeType === 'condition' && (() => {
        const nodeData = getEditingNodeData() as unknown as ConditionNodeData | null;
        return (
          <ConditionEditor
            condition={nodeData?.condition}
            label={nodeData?.label}
            onChange={(data) => {
              updateNodeData(editingNodeId, data);
              setIsModified(true);
            }}
            onClose={handleCloseEditor}
          />
        );
      })()}

      {editingNodeId && editingNodeType === 'setVariable' && (() => {
        const nodeData = getEditingNodeData() as unknown as SetVariableNodeData | null;
        return (
          <VariableEditor
            variables={nodeData?.variables}
            label={nodeData?.label}
            onChange={(data) => {
              updateNodeData(editingNodeId, data);
              setIsModified(true);
            }}
            onClose={handleCloseEditor}
          />
        );
      })()}

      {editingNodeId && editingNodeType === 'extractVariable' && (() => {
        const nodeData = getEditingNodeData() as unknown as ExtractVariableNodeData | null;
        return (
          <ExtractionEditor
            extractions={nodeData?.extractions}
            label={nodeData?.label}
            onChange={(data) => {
              updateNodeData(editingNodeId, data);
              setIsModified(true);
            }}
            onClose={handleCloseEditor}
          />
        );
      })()}
    </div>
  );
}

export function FlowBuilder(props: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
