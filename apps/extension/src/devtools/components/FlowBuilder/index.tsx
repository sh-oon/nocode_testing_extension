import { ReactFlowProvider } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';
import type {
  ConditionNodeData,
  ExtractVariableNodeData,
  SetVariableNodeData,
} from '@like-cake/ast-types';
import { getApiClient } from '../../../shared/api';
import { ConfirmModal } from '../ConfirmModal';
import { FlowListPanel } from '../FlowListPanel';
import { ScenarioDetailPanel } from '../ScenarioDetailPanel';
import { FlowCanvas, useFlowState } from './FlowCanvas';
import { FlowEmptyState } from './FlowEmptyState';
import { FlowToolbar } from './FlowToolbar';
import { FlowToolbox, type ToolboxNodeType } from './FlowToolbox';
import { ScenarioSidebar, type SidebarScenario } from './ScenarioSidebar';
import { ConditionEditor, VariableEditor, ExtractionEditor } from './editors';
import { useFlowManager } from './useFlowManager';

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

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null);

  // UI panel state
  const [isFlowListOpen, setIsFlowListOpen] = useState(false);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'createNew' | 'loadFlow' | null;
    pendingFlowId?: string;
  }>({ isOpen: false, action: null });

  // React Flow state
  const flowState = useFlowState();
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
    setNodes,
    setEdges,
  } = flowState;

  // Flow manager (replaces manual flowId/flowName/isSaving state)
  const flowManager = useFlowManager({
    getFlowData,
    setNodes,
    setEdges,
    clearFlow,
  });

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

  // Add default Start/End nodes when canvas is empty and no flow is loaded
  useEffect(() => {
    if (nodes.length === 0 && !flowManager.flowId && !flowManager.isLoading) {
      addStartNode({ x: 250, y: 50 });
      addEndNode({ x: 250, y: 400 });
    }
  }, [nodes.length, flowManager.flowId, flowManager.isLoading, addStartNode, addEndNode]);

  // Mark flow as modified when nodes/edges change (skip during load)
  useEffect(() => {
    if (!flowManager.isLoading) {
      flowManager.markModified();
    }
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Handlers ----

  const handleDrop = useCallback(
    (scenario: SidebarScenario, position: { x: number; y: number }) => {
      addScenarioNode(scenario, position);
    },
    [addScenarioNode]
  );

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

  const handleNodeDoubleClick = useCallback((nodeId: string, nodeType: string) => {
    if (['condition', 'setVariable', 'extractVariable'].includes(nodeType)) {
      setEditingNodeId(nodeId);
      setEditingNodeType(nodeType);
    } else if (nodeType === 'scenario') {
      const node = nodes.find((n) => n.id === nodeId);
      const scenarioId = (node?.data as Record<string, unknown>)?.scenarioId as string;
      if (scenarioId) {
        setSelectedScenarioId(scenarioId);
        setIsDetailPanelOpen(true);
      }
    }
  }, [nodes]);

  const handleCloseEditor = useCallback(() => {
    setEditingNodeId(null);
    setEditingNodeType(null);
  }, []);

  const getEditingNodeData = useCallback(() => {
    if (!editingNodeId) return null;
    const node = nodes.find((n) => n.id === editingNodeId);
    return node?.data || null;
  }, [editingNodeId, nodes]);

  const handleScenarioEdit = useCallback((scenarioId: string) => {
    setSelectedScenarioId(scenarioId);
    setIsDetailPanelOpen(true);
  }, []);

  const handleScenarioUpdate = useCallback(() => {
    loadScenarios();
  }, [loadScenarios]);

  const handleScenarioDelete = useCallback(
    (deletedId: string) => {
      setScenarios((prev) => prev.filter((s) => s.id !== deletedId));
    },
    []
  );

  // Flow list panel handlers
  const handleOpenList = useCallback(() => {
    setIsFlowListOpen(true);
  }, []);

  const handleSelectFlow = useCallback(
    async (selectedFlowId: string) => {
      if (flowManager.isModified) {
        setConfirmModal({ isOpen: true, action: 'loadFlow', pendingFlowId: selectedFlowId });
        return;
      }
      await flowManager.loadFlow(selectedFlowId);
    },
    [flowManager]
  );

  const handleCreateNew = useCallback(() => {
    const result = flowManager.createNewFlow();
    if (result.needsConfirmation) {
      setConfirmModal({ isOpen: true, action: 'createNew' });
      return;
    }
    setExecutionSummary(null);
    setTimeout(() => {
      addStartNode({ x: 250, y: 50 });
      addEndNode({ x: 250, y: 400 });
    }, 0);
  }, [flowManager, addStartNode, addEndNode]);

  // Confirm modal handlers
  const handleConfirmSave = useCallback(async () => {
    await flowManager.saveFlow();
    const { action, pendingFlowId } = confirmModal;
    setConfirmModal({ isOpen: false, action: null });

    if (action === 'createNew') {
      flowManager.forceCreateNewFlow();
      setExecutionSummary(null);
      setTimeout(() => {
        addStartNode({ x: 250, y: 50 });
        addEndNode({ x: 250, y: 400 });
      }, 0);
    } else if (action === 'loadFlow' && pendingFlowId) {
      await flowManager.loadFlow(pendingFlowId);
    }
  }, [flowManager, confirmModal, addStartNode, addEndNode]);

  const handleConfirmDiscard = useCallback(async () => {
    const { action, pendingFlowId } = confirmModal;
    setConfirmModal({ isOpen: false, action: null });

    if (action === 'createNew') {
      flowManager.forceCreateNewFlow();
      setExecutionSummary(null);
      setTimeout(() => {
        addStartNode({ x: 250, y: 50 });
        addEndNode({ x: 250, y: 400 });
      }, 0);
    } else if (action === 'loadFlow' && pendingFlowId) {
      await flowManager.loadFlow(pendingFlowId);
    }
  }, [flowManager, confirmModal, addStartNode, addEndNode]);

  const handleConfirmCancel = useCallback(() => {
    setConfirmModal({ isOpen: false, action: null });
  }, []);

  // Save handler
  const handleSave = useCallback(async (): Promise<string | null> => {
    if (!isConnected || !flowManager.flowName.trim()) {
      return null;
    }
    return flowManager.saveFlow();
  }, [isConnected, flowManager]);

  // Execute handler
  const handleExecute = useCallback(async () => {
    if (!isConnected) return;

    if (!flowManager.flowName.trim()) {
      return;
    }

    let currentFlowId = flowManager.flowId;
    if (!currentFlowId || flowManager.isModified) {
      const savedId = await flowManager.saveFlow();
      if (savedId) {
        currentFlowId = savedId;
      }
    }

    if (!currentFlowId) return;

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
  }, [isConnected, flowManager, resetNodeStatuses, updateNodeStatus]);

  // Show empty state when no flow is loaded and canvas only has start/end
  const showEmptyState = !flowManager.flowId && !flowManager.flowName && nodes.length <= 2;

  return (
    <div className="flex flex-col h-full">
      <FlowToolbar
        flowName={flowManager.flowName}
        isModified={flowManager.isModified}
        isSaving={flowManager.isSaving}
        isLoading={isExecuting}
        flowId={flowManager.flowId}
        onOpenList={handleOpenList}
        onCreateNew={handleCreateNew}
        onSave={handleSave}
        onRun={handleExecute}
        onFlowNameChange={flowManager.setFlowName}
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

      <div className="flex flex-1 overflow-hidden relative">
        <ScenarioSidebar
          scenarios={scenarios}
          isLoading={isLoadingScenarios}
          onRefresh={loadScenarios}
          onScenarioEdit={handleScenarioEdit}
        />

        <FlowToolbox />

        {showEmptyState ? (
          <div className="flex-1 flex items-center justify-center bg-gray-900">
            <FlowEmptyState
              onOpenList={handleOpenList}
              onCreateNew={handleCreateNew}
            />
          </div>
        ) : (
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
        )}
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

      {/* Flow List Panel */}
      <FlowListPanel
        isOpen={isFlowListOpen}
        onClose={() => setIsFlowListOpen(false)}
        onSelectFlow={handleSelectFlow}
        onCreateNew={handleCreateNew}
        currentFlowId={flowManager.flowId}
      />

      {/* Unsaved Changes Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="저장하지 않은 변경사항"
        message="현재 플로우에 저장하지 않은 변경사항이 있습니다. 저장하시겠습니까?"
        confirmLabel="저장"
        cancelLabel="취소"
        variant="warning"
        onConfirm={handleConfirmSave}
        onCancel={handleConfirmCancel}
        extraAction={{
          label: '저장 안 함',
          onClick: handleConfirmDiscard,
        }}
      />

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
              flowManager.markModified();
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
              flowManager.markModified();
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
              flowManager.markModified();
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
