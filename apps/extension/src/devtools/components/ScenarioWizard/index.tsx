import { useEffect, useState } from 'react';
import { ExecutionHistoryPanel } from './ExecutionHistoryPanel';
import { StepConfigPanel } from './StepConfigPanel';
import { useScenarioWizard } from './useScenarioWizard';
import { WizardStepList } from './WizardStepList';

interface ScenarioWizardProps {
  isConnected: boolean;
}

export function ScenarioWizard({ isConnected }: ScenarioWizardProps) {
  const wizard = useScenarioWizard();
  const [showHistory, setShowHistory] = useState(false);

  const handleAddStep = () => {
    wizard.startDraftFromCatalog('click', 'event');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd+Enter → play scenario
      if (isModifier && e.key === 'Enter') {
        e.preventDefault();
        if (wizard.canPlay) wizard.playScenario();
        return;
      }

      // Ctrl/Cmd+S → save to backend
      if (isModifier && e.key === 's') {
        e.preventDefault();
        if (wizard.canSave && isConnected) wizard.saveToBackend();
        return;
      }

      // Escape → cancel current draft
      if (e.key === 'Escape') {
        if (wizard.draft) {
          e.preventDefault();
          wizard.cancelDraft();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    wizard.canPlay,
    wizard.canSave,
    wizard.draft,
    wizard.playScenario,
    wizard.saveToBackend,
    wizard.cancelDraft,
    isConnected,
  ]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top bar */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <input
          type="text"
          value={wizard.scenarioName}
          onChange={(e) => wizard.setScenarioName(e.target.value)}
          placeholder="시나리오 이름을 입력하세요."
          className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-transparent border-none outline-none"
        />
        {wizard.backendScenarioId && (
          <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            저장됨
          </span>
        )}
      </div>

      {/* Recording control */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        {wizard.isRecording ? (
          <button
            type="button"
            onClick={wizard.stopRecording}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            녹화 중지
          </button>
        ) : (
          <button
            type="button"
            onClick={wizard.startRecording}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-red-400" />
            녹화하기
          </button>
        )}
        <span className="text-xs text-gray-400">{wizard.steps.length} steps</span>
      </div>

      {/* Status banners */}
      {wizard.playbackState.state === 'completed' && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-100 text-sm text-green-700">
          <span className="font-medium">실행 성공</span>
          {isConnected && !wizard.backendScenarioId && (
            <span className="text-green-600"> — 저장 버튼을 눌러주세요</span>
          )}
        </div>
      )}
      {wizard.playbackState.state === 'error' && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-sm text-red-700 space-y-1">
          <div className="font-medium">
            실행 실패
            {wizard.playbackState.failedStepIndex !== undefined && (
              <span className="font-normal">
                {' '}
                — Step {wizard.playbackState.failedStepIndex + 1}에서 중단
              </span>
            )}
          </div>
          {wizard.playbackState.errorMessage && (
            <div className="text-xs font-mono text-red-500 bg-red-100/50 px-2 py-1 rounded">
              {wizard.playbackState.errorMessage}
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Step list */}
        <div className="w-72 border-r border-gray-100 flex flex-col shrink-0">
          <WizardStepList
            steps={wizard.steps}
            currentPlaybackIndex={wizard.playbackState.currentStepIndex}
            stepResults={wizard.playbackState.stepResults}
            isRecording={wizard.isRecording}
            onRemove={wizard.removeStep}
            onDuplicate={wizard.duplicateStep}
            onAddStep={handleAddStep}
            onInsertAt={wizard.insertStepAt}
            onMove={wizard.moveStep}
            onEditStep={wizard.editStep}
          />
        </div>

        {/* Right: Config panel */}
        {wizard.draft ? (
          <StepConfigPanel
            draft={wizard.draft}
            isInspecting={wizard.isInspecting}
            onSelectAction={wizard.switchAction}
            onSelectSelector={wizard.selectSelector}
            onUpdateParams={wizard.updateParams}
            onConfirm={wizard.confirmStep}
            onCancel={wizard.cancelDraft}
            onStartInspect={wizard.startInspect}
            onManualSelector={wizard.manualSelector}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <p className="text-sm">스텝을 추가하거나</p>
              <p className="text-sm">목록 사이에 검증을 삽입하세요</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddStep}
          disabled={wizard.isRecording}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:text-gray-300 disabled:cursor-not-allowed"
        >
          + 단계추가
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={wizard.reset}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            초기화
          </button>
          {wizard.backendScenarioId && isConnected && (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              히스토리
            </button>
          )}
          <button
            type="button"
            onClick={wizard.playScenario}
            disabled={!wizard.canPlay}
            className="px-4 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            ▶ 전체 재생
          </button>
          <button
            type="button"
            onClick={wizard.saveToBackend}
            disabled={!(wizard.canSave && isConnected)}
            className="px-4 py-1.5 text-xs font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            저장
          </button>
          {wizard.canExport && (
            <>
              <button
                type="button"
                onClick={wizard.exportJsonReport}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                JSON 내보내기
              </button>
              <button
                type="button"
                onClick={wizard.exportHtmlReport}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                HTML 리포트
              </button>
            </>
          )}
        </div>
      </div>

      {/* Execution History Panel */}
      {showHistory && wizard.backendScenarioId && (
        <ExecutionHistoryPanel
          scenarioId={wizard.backendScenarioId}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
