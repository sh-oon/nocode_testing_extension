import { ReactFlowProvider } from '@xyflow/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { validateTestModel, countIssues } from '@like-cake/mbt-catalog';
import { ConfirmModal } from '../ConfirmModal';
import { ModelCanvas, useModelState, type ModelNodeData, type ModelEdgeData } from './ModelCanvas';
import { ModelEmptyState } from './ModelEmptyState';
import { ModelToolbar } from './ModelToolbar';
import { ModelToolbox, type ModelToolboxNodeType } from './ModelToolbox';
import { GenerateScenariosModal } from './GenerateScenariosModal';
import { ImportRecordingModal } from './ImportRecordingModal';
import { ModelValidationPanel } from './ModelValidationPanel';
import { StateEditor, TransitionEditor } from './editors';
import { ElementBindingSidebar } from './inspectors/ElementBindingSidebar';
import { useModelManager } from './useModelManager';

interface ModelBuilderProps {
  isConnected: boolean;
}

interface ModelListItem {
  id: string;
  name: string;
  updatedAt: number;
}

function ModelBuilderInner({ isConnected }: ModelBuilderProps) {
  const modelState = useModelState();
  const {
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
  } = modelState;

  const modelManager = useModelManager({ toTestModel, fromTestModel, clearModel });

  // UI state
  const [isListOpen, setIsListOpen] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'createNew' | 'loadModel' | null;
    pendingModelId?: string;
  }>({ isOpen: false, action: null });

  // Add default Initial/Final nodes for new model
  useEffect(() => {
    if (nodes.length === 0 && !modelManager.modelId) {
      addInitialStateNode({ x: 300, y: 50 });
      addFinalStateNode({ x: 300, y: 400 });
    }
  }, [nodes.length, modelManager.modelId, addInitialStateNode, addFinalStateNode]);

  // Mark modified on node/edge changes
  useEffect(() => {
    modelManager.markModified();
  }, [nodes, edges]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handlers
  const handleToolboxDrop = useCallback(
    (type: ModelToolboxNodeType, position: { x: number; y: number }) => {
      switch (type) {
        case 'state':
          addStateNode(position);
          break;
        case 'initialState':
          addInitialStateNode(position);
          break;
        case 'finalState':
          addFinalStateNode(position);
          break;
      }
    },
    [addStateNode, addInitialStateNode, addFinalStateNode]
  );

  const handleNodeDoubleClick = useCallback((nodeId: string, nodeType: string) => {
    if (nodeType === 'state') {
      setEditingNodeId(nodeId);
    }
  }, []);

  const handleEdgeClick = useCallback((edgeId: string) => {
    setEditingEdgeId(edgeId);
  }, []);

  const handleSave = useCallback(() => {
    modelManager.saveModel();
  }, [modelManager]);

  const handleExport = useCallback(() => {
    const model = modelManager.exportModel();
    if (!model) return;

    const blob = new Blob([JSON.stringify(model, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.name || 'model'}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [modelManager]);

  const handleGenerate = useCallback(() => {
    setShowGenerateModal(true);
  }, []);

  const handleImportRecording = useCallback(() => {
    setShowImportModal(true);
  }, []);

  const handleImportResult = useCallback(
    (result: import('@like-cake/mbt-catalog').ScenarioToModelResult) => {
      fromTestModel(result.model);
      modelManager.setModelName(result.model.name);
      if (result.model.description) modelManager.setModelDescription(result.model.description);
      modelManager.setBaseUrl(result.model.baseUrl);
      // Load element bindings
      for (const binding of result.model.elementBindings) {
        modelManager.addElementBinding(binding);
      }
      setShowImportModal(false);
    },
    [fromTestModel, modelManager]
  );

  const handleOpenList = useCallback(() => {
    setIsListOpen(true);
  }, []);

  const handleCreateNew = useCallback(() => {
    const result = modelManager.createNewModel();
    if (result.needsConfirmation) {
      setConfirmModal({ isOpen: true, action: 'createNew' });
      return;
    }
    setTimeout(() => {
      addInitialStateNode({ x: 300, y: 50 });
      addFinalStateNode({ x: 300, y: 400 });
    }, 0);
  }, [modelManager, addInitialStateNode, addFinalStateNode]);

  const handleSelectModel = useCallback(
    (selectedModelId: string) => {
      if (modelManager.isModified) {
        setConfirmModal({ isOpen: true, action: 'loadModel', pendingModelId: selectedModelId });
        return;
      }
      modelManager.loadModel(selectedModelId);
      setIsListOpen(false);
    },
    [modelManager]
  );

  // Confirm modal handlers
  const handleConfirmSave = useCallback(() => {
    modelManager.saveModel();
    const { action, pendingModelId } = confirmModal;
    setConfirmModal({ isOpen: false, action: null });

    if (action === 'createNew') {
      modelManager.forceCreateNewModel();
      setTimeout(() => {
        addInitialStateNode({ x: 300, y: 50 });
        addFinalStateNode({ x: 300, y: 400 });
      }, 0);
    } else if (action === 'loadModel' && pendingModelId) {
      modelManager.loadModel(pendingModelId);
      setIsListOpen(false);
    }
  }, [modelManager, confirmModal, addInitialStateNode, addFinalStateNode]);

  const handleConfirmDiscard = useCallback(() => {
    const { action, pendingModelId } = confirmModal;
    setConfirmModal({ isOpen: false, action: null });

    if (action === 'createNew') {
      modelManager.forceCreateNewModel();
      setTimeout(() => {
        addInitialStateNode({ x: 300, y: 50 });
        addFinalStateNode({ x: 300, y: 400 });
      }, 0);
    } else if (action === 'loadModel' && pendingModelId) {
      modelManager.loadModel(pendingModelId);
      setIsListOpen(false);
    }
  }, [modelManager, confirmModal, addInitialStateNode, addFinalStateNode]);

  const handleConfirmCancel = useCallback(() => {
    setConfirmModal({ isOpen: false, action: null });
  }, []);

  // Get current model for generate
  const getCurrentModel = useCallback(() => {
    return toTestModel({
      id: modelManager.modelId || 'preview',
      name: modelManager.modelName || 'Untitled',
      description: modelManager.modelDescription,
      baseUrl: modelManager.baseUrl,
      elementBindings: modelManager.elementBindings,
    });
  }, [toTestModel, modelManager]);

  // Validation
  const currentModel = getCurrentModel();
  const validationIssues = useMemo(() => validateTestModel(currentModel), [currentModel]);
  const { errors: validationErrors, warnings: validationWarnings } = useMemo(
    () => countIssues(validationIssues),
    [validationIssues],
  );

  const handleValidate = useCallback(() => {
    setShowValidationPanel(true);
  }, []);

  // Get editing node/edge data
  const editingNode = editingNodeId ? nodes.find((n) => n.id === editingNodeId) : null;
  const editingEdge = editingEdgeId ? edges.find((e) => e.id === editingEdgeId) : null;

  const showEmptyState = !modelManager.modelId && !modelManager.modelName && nodes.length <= 2;

  return (
    <div className="flex flex-col h-full">
      <ModelToolbar
        modelName={modelManager.modelName}
        baseUrl={modelManager.baseUrl}
        isModified={modelManager.isModified}
        isSaving={modelManager.isSaving}
        onModelNameChange={modelManager.setModelName}
        onBaseUrlChange={modelManager.setBaseUrl}
        onOpenList={handleOpenList}
        onCreateNew={handleCreateNew}
        onSave={handleSave}
        onExport={handleExport}
        onGenerate={handleGenerate}
        onImportRecording={handleImportRecording}
        onValidate={handleValidate}
        validationErrors={validationErrors}
        validationWarnings={validationWarnings}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <ElementBindingSidebar
          bindings={modelManager.elementBindings}
          onAdd={modelManager.addElementBinding}
          onUpdate={modelManager.updateElementBinding}
          onRemove={modelManager.removeElementBinding}
        />

        <ModelToolbox />

        {showEmptyState ? (
          <div className="flex-1 flex items-center justify-center bg-gray-900">
            <ModelEmptyState
              onOpenList={handleOpenList}
              onCreateNew={handleCreateNew}
            />
          </div>
        ) : (
          <ModelCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onToolboxDrop={handleToolboxDrop}
            onNodeDoubleClick={handleNodeDoubleClick}
            onEdgeClick={handleEdgeClick}
          />
        )}
      </div>

      {/* Model List Panel */}
      {isListOpen && (
        <ModelListPanel
          models={modelManager.listModels()}
          currentModelId={modelManager.modelId}
          onSelect={handleSelectModel}
          onDelete={modelManager.deleteModel}
          onClose={() => setIsListOpen(false)}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="저장하지 않은 변경사항"
        message="현재 모델에 저장하지 않은 변경사항이 있습니다. 저장하시겠습니까?"
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

      {/* State Editor */}
      {editingNode && editingNode.type === 'state' && (() => {
        const d = editingNode.data as unknown as ModelNodeData;
        return (
          <StateEditor
            name={d.name}
            verifications={d.verifications || []}
            elementBindings={modelManager.elementBindings}
            onChange={(data) => {
              updateNodeData(editingNodeId!, data);
              modelManager.markModified();
              setEditingNodeId(null);
            }}
            onClose={() => setEditingNodeId(null)}
          />
        );
      })()}

      {/* Transition Editor */}
      {editingEdge && (() => {
        const d = (editingEdge.data ?? {}) as unknown as ModelEdgeData;
        return (
          <TransitionEditor
            event={d.event || { eventId: '', elementBindingId: null, params: {} }}
            guard={d.guard}
            elementBindings={modelManager.elementBindings}
            onChange={(data) => {
              updateEdgeData(editingEdgeId!, data);
              modelManager.markModified();
              setEditingEdgeId(null);
            }}
            onClose={() => setEditingEdgeId(null)}
          />
        );
      })()}

      {/* Generate Scenarios Modal */}
      {showGenerateModal && (
        <GenerateScenariosModal
          model={getCurrentModel()}
          isConnected={isConnected}
          onClose={() => setShowGenerateModal(false)}
        />
      )}

      {/* Validation Panel */}
      {showValidationPanel && (
        <ModelValidationPanel
          issues={validationIssues}
          onClose={() => setShowValidationPanel(false)}
        />
      )}

      {/* Import Recording Modal */}
      {showImportModal && (
        <ImportRecordingModal
          isConnected={isConnected}
          onImport={handleImportResult}
          onClose={() => setShowImportModal(false)}
        />
      )}
    </div>
  );
}

export function ModelBuilder(props: ModelBuilderProps) {
  return (
    <ReactFlowProvider>
      <ModelBuilderInner {...props} />
    </ReactFlowProvider>
  );
}

/* ------------------------------------------------------------------ */
/*  ModelListPanel — simple overlay for model list                     */
/* ------------------------------------------------------------------ */

interface ModelListPanelProps {
  models: ModelListItem[];
  currentModelId: string | null;
  onSelect: (modelId: string) => void;
  onDelete: (modelId: string) => void;
  onClose: () => void;
}

function ModelListPanel({ models, currentModelId, onSelect, onDelete, onClose }: ModelListPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40" role="dialog" aria-modal="true">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[400px] max-h-[60vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">모델 목록</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {models.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-8">저장된 모델 없음</div>
          )}

          {models.map((model) => (
            <div
              key={model.id}
              className={`px-3 py-2 rounded-md flex items-center justify-between group ${
                model.id === currentModelId
                  ? 'bg-orange-600/20 border border-orange-600/30'
                  : 'hover:bg-gray-700'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(model.id)}
                className="flex-1 text-left"
              >
                <div className="text-sm font-medium text-white">{model.name}</div>
                <div className="text-[10px] text-gray-500">
                  {new Date(model.updatedAt).toLocaleString()}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onDelete(model.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-all ml-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
