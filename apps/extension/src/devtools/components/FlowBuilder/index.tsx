import { ReactFlowProvider } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';
import { getApiClient } from '../../../shared/api';
import { ScenarioDetailPanel } from '../ScenarioDetailPanel';
import { FlowCanvas, useFlowState } from './FlowCanvas';
import { FlowToolbar } from './FlowToolbar';
import { ScenarioSidebar, type SidebarScenario } from './ScenarioSidebar';

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
    addStartNode,
    addEndNode,
    clearFlow,
    updateNodeStatus,
    resetNodeStatuses,
    getFlowData,
  } = useFlowState();

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

  // Handle save
  const handleSave = useCallback(async () => {
    if (!isConnected || !flowName.trim()) {
      alert('Please enter a flow name');
      return;
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
        }
      }
    } catch (error) {
      console.error('Failed to save flow:', error);
    } finally {
      setIsSaving(false);
    }
  }, [isConnected, flowName, flowId, getFlowData]);

  // Handle execute
  const handleExecute = useCallback(async () => {
    if (!isConnected) return;

    // Save first if not saved or modified
    if (!flowId || isModified) {
      await handleSave();
    }

    const currentFlowId = flowId;
    if (!currentFlowId) {
      alert('Please save the flow first');
      return;
    }

    setIsExecuting(true);
    setExecutionSummary(null);
    resetNodeStatuses();

    try {
      const client = await getApiClient();
      const response = await client.executeUserFlow(currentFlowId);

      if (response.success && response.data) {
        const result = response.data;

        // Update node statuses based on results
        for (const nodeResult of result.nodeResults || []) {
          updateNodeStatus(nodeResult.nodeId, nodeResult.status);
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
        });
      }
    } catch (error) {
      console.error('Failed to execute flow:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [isConnected, flowId, isModified, handleSave, resetNodeStatuses, updateNodeStatus]);

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

      <div className="flex flex-1 overflow-hidden">
        <ScenarioSidebar
          scenarios={scenarios}
          isLoading={isLoadingScenarios}
          onRefresh={loadScenarios}
          onScenarioEdit={handleScenarioEdit}
        />

        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={handleDrop}
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
