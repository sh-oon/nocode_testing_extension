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

interface NodeExecutionLog {
  nodeId: string;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
  duration?: number;
  stepCount?: number;
  passedSteps?: number;
  failedSteps?: number;
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
  nodeLogs?: NodeExecutionLog[];
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
  const [forceShowCanvas, setForceShowCanvas] = useState(false);

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

  // Mark flow as modified when nodes/edges change (skip during load and initial setup)
  const isInitialSetup = nodes.length <= 2 && !flowManager.flowId && !flowManager.flowName;
  useEffect(() => {
    if (!flowManager.isLoading && !isInitialSetup) {
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
    // Skip confirmation if in initial state (no real work to lose)
    const hasRealContent = flowManager.flowId || flowManager.flowName || nodes.length > 2;
    if (flowManager.isModified && hasRealContent) {
      setConfirmModal({ isOpen: true, action: 'createNew' });
      return;
    }
    flowManager.forceCreateNewFlow();
    setExecutionSummary(null);
    setForceShowCanvas(true);
    setTimeout(() => {
      addStartNode({ x: 250, y: 50 });
      addEndNode({ x: 250, y: 400 });
    }, 0);
  }, [flowManager, nodes.length, addStartNode, addEndNode]);

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
        headless: true,
      });

      if (response.success && response.data) {
        const result = response.data;
        const errors: string[] = [];
        const nodeLogs: NodeExecutionLog[] = [];

        for (const nodeResult of result.nodeResults || []) {
          updateNodeStatus(nodeResult.nodeId, nodeResult.status);

          const log: NodeExecutionLog = {
            nodeId: nodeResult.nodeId,
            status: nodeResult.status,
            duration: nodeResult.duration,
            stepCount: nodeResult.scenarioResult?.totalSteps,
            passedSteps: nodeResult.scenarioResult?.passed,
            failedSteps: nodeResult.scenarioResult?.failed,
          };

          if (nodeResult.status === 'failed' && nodeResult.error?.message) {
            log.error = nodeResult.error.message;
            errors.push(`[${nodeResult.nodeId}] ${nodeResult.error.message}`);
          }

          nodeLogs.push(log);
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
          nodeLogs,
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

  // ── Export helpers ──

  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const exportFlowJsonReport = useCallback(() => {
    if (!executionSummary) return;
    const report = {
      flowName: flowManager.flowName || 'Unnamed Flow',
      summary: {
        status: executionSummary.status,
        totalNodes: executionSummary.totalNodes,
        passedNodes: executionSummary.passedNodes,
        failedNodes: executionSummary.failedNodes,
        totalSteps: executionSummary.totalSteps,
        passedSteps: executionSummary.passedSteps,
        failedSteps: executionSummary.failedSteps,
        duration: executionSummary.duration,
      },
      nodeLogs: executionSummary.nodeLogs ?? [],
      errors: executionSummary.errors ?? [],
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(report, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(json, `flow-report-${timestamp}.json`, 'application/json');
  }, [executionSummary, flowManager.flowName, downloadFile]);

  const exportFlowHtmlReport = useCallback(() => {
    if (!executionSummary) return;
    const name = escapeHtml(flowManager.flowName || 'Unnamed Flow');
    const date = new Date().toLocaleString('ko-KR');
    const s = executionSummary;
    const isSuccess = s.status === 'passed';

    const nodeRows = (s.nodeLogs ?? [])
      .map((log, i) => {
        const statusLabel = log.status === 'passed' ? '성공' : log.status === 'failed' ? '실패' : '건너뜀';
        const statusColor = log.status === 'passed' ? '#16a34a' : log.status === 'failed' ? '#dc2626' : '#9ca3af';
        const statusBg = log.status === 'passed' ? '#f0fdf4' : log.status === 'failed' ? '#fef2f2' : '#f9fafb';
        const duration = log.duration != null ? formatDuration(log.duration) : '-';
        const steps = log.stepCount != null ? `${log.passedSteps ?? 0}/${log.stepCount}` : '-';
        const errorRow = log.error
          ? `<tr><td colspan="5" style="padding:6px 12px;background:#fef2f2;color:#b91c1c;font-size:12px;font-family:monospace;border-bottom:1px solid #fee2e2;">오류: ${escapeHtml(log.error)}</td></tr>`
          : '';
        return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:10px 12px;color:#6b7280;font-size:13px;">${i + 1}</td>
          <td style="padding:10px 12px;font-weight:500;font-size:13px;">${escapeHtml(log.nodeId)}</td>
          <td style="padding:10px 12px;"><span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:${statusColor};background:${statusBg};">${statusLabel}</span></td>
          <td style="padding:10px 12px;color:#6b7280;font-size:13px;text-align:center;">${steps}</td>
          <td style="padding:10px 12px;color:#6b7280;font-size:13px;text-align:right;">${duration}</td>
        </tr>${errorRow}`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Flow 실행 리포트 - ${name}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;color:#111827;padding:40px 20px;}
.container{max-width:720px;margin:0 auto;}
.header{margin-bottom:16px;}
.header h1{font-size:22px;font-weight:700;color:#111827;}
.meta{font-size:13px;color:#9ca3af;margin-top:4px;}
.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
.card{background:#fff;border:1px solid #f3f4f6;border-radius:12px;padding:16px;text-align:center;}
.card .value{font-size:24px;font-weight:700;color:#111827;}
.card .label{font-size:11px;color:#9ca3af;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em;}
.badge{display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;margin-bottom:24px;}
table{width:100%;background:#fff;border:1px solid #f3f4f6;border-radius:12px;border-collapse:collapse;overflow:hidden;}
thead th{padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #f3f4f6;}
thead th:last-child{text-align:right;}
thead th:nth-child(4){text-align:center;}
.footer{margin-top:32px;text-align:center;font-size:11px;color:#d1d5db;}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${name}</h1>
    <div class="meta">${date}</div>
  </div>
  <span class="badge" style="color:${isSuccess ? '#16a34a' : '#dc2626'};background:${isSuccess ? '#f0fdf4' : '#fef2f2'};">${isSuccess ? '성공' : '실패'}</span>
  <div class="summary">
    <div class="card"><div class="value">${s.totalNodes}</div><div class="label">전체 노드</div></div>
    <div class="card"><div class="value" style="color:#16a34a;">${s.passedNodes}</div><div class="label">성공</div></div>
    <div class="card"><div class="value" style="color:#dc2626;">${s.failedNodes}</div><div class="label">실패</div></div>
    <div class="card"><div class="value">${formatDuration(s.duration)}</div><div class="label">소요 시간</div></div>
  </div>
  <div class="summary" style="grid-template-columns:repeat(3,1fr);margin-bottom:24px;">
    <div class="card"><div class="value">${s.totalSteps}</div><div class="label">전체 스텝</div></div>
    <div class="card"><div class="value" style="color:#16a34a;">${s.passedSteps}</div><div class="label">성공 스텝</div></div>
    <div class="card"><div class="value" style="color:#dc2626;">${s.failedSteps}</div><div class="label">실패 스텝</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>노드 ID</th><th>상태</th><th style="text-align:center;">스텝 (성공/전체)</th><th style="text-align:right;">소요 시간</th></tr></thead>
    <tbody>${nodeRows}</tbody>
  </table>
  <div class="footer">Like Cake - Flow 실행 리포트</div>
</div>
</body>
</html>`;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(html, `flow-report-${timestamp}.html`, 'text/html');
  }, [executionSummary, flowManager.flowName, downloadFile]);

  // Show empty state when no flow is loaded and canvas only has start/end
  const showEmptyState = !forceShowCanvas && !flowManager.flowId && !flowManager.flowName && nodes.length <= 2;

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
              ? 'bg-green-50 border-b border-green-200 text-green-700'
              : 'bg-red-50 border-b border-red-200 text-red-700'
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportFlowJsonReport}
              className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              JSON 내보내기
            </button>
            <button
              type="button"
              onClick={exportFlowHtmlReport}
              className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              HTML 리포트
            </button>
            <button
              type="button"
              onClick={() => setExecutionSummary(null)}
              className="text-xs hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Execution Console Log */}
      {executionSummary?.nodeLogs && executionSummary.nodeLogs.length > 0 && (
        <div className="border-b border-gray-200 max-h-48 overflow-y-auto bg-gray-50">
          <div className="px-3 py-1 bg-gray-100 border-b border-gray-200 flex items-center justify-between sticky top-0">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Execution Log</span>
            <button
              type="button"
              onClick={() => setExecutionSummary((prev) => prev ? { ...prev, nodeLogs: undefined } : prev)}
              className="text-[10px] text-gray-400 hover:text-gray-600"
            >
              닫기
            </button>
          </div>
          <div className="px-3 py-1 font-mono text-[11px] space-y-0.5">
            {executionSummary.nodeLogs.map((log, i) => {
              const statusIcon = log.status === 'passed' ? '✓' : log.status === 'failed' ? '✗' : '○';
              const statusColor = log.status === 'passed' ? 'text-green-400' : log.status === 'failed' ? 'text-red-400' : 'text-gray-500';
              return (
                <div key={i}>
                  <div className={`flex items-center gap-2 py-0.5 ${statusColor}`}>
                    <span>{statusIcon}</span>
                    <span className="text-gray-400">[{log.nodeId}]</span>
                    <span>{log.status.toUpperCase()}</span>
                    {log.stepCount !== undefined && (
                      <span className="text-gray-600">
                        steps: {log.passedSteps ?? 0}/{log.stepCount}
                      </span>
                    )}
                    {log.duration !== undefined && (
                      <span className="text-gray-600">{(log.duration / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  {log.error && (
                    <div className="pl-5 text-red-400/80 break-all">
                      Error: {log.error}
                    </div>
                  )}
                  {log.status === 'skipped' && (
                    <div className="pl-5 text-gray-600">
                      이전 노드 실패로 건너뜀
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
          <div className="flex-1 flex items-center justify-center bg-gray-50">
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
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
