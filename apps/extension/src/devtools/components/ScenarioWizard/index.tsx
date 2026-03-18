import { StepConfigPanel } from './StepConfigPanel';
import { useScenarioWizard } from './useScenarioWizard';
import { WizardStepList } from './WizardStepList';
import { WizardToolbar } from './WizardToolbar';

interface ScenarioWizardProps {
  isConnected: boolean;
}

export function ScenarioWizard({ isConnected }: ScenarioWizardProps) {
  const wizard = useScenarioWizard();

  const handleAddStep = () => {
    // Start a draft with default action (click)
    wizard.startDraftFromCatalog('click');
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <WizardToolbar
        scenarioName={wizard.scenarioName}
        onNameChange={wizard.setScenarioName}
        onPlay={wizard.playScenario}
        onSave={wizard.saveToBackend}
        onReset={wizard.reset}
        canPlay={wizard.canPlay}
        canSave={wizard.canSave && isConnected}
        isSaving={wizard.isSaving}
        playbackState={wizard.playbackState.state}
        stepCount={wizard.steps.length}
        backendScenarioId={wizard.backendScenarioId}
      />

      {/* Playback banners */}
      {wizard.playbackState.state === 'completed' && (
        <div className="px-4 py-2 bg-green-50 border-b border-green-200 text-sm text-green-700">
          시나리오 실행 성공{isConnected ? ' — 저장 버튼을 눌러 DB에 저장하세요' : ''}
        </div>
      )}
      {wizard.playbackState.state === 'error' && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700 space-y-1">
          <div className="font-medium">
            실행 실패
            {wizard.playbackState.failedStepIndex !== undefined && (
              <span> — Step {wizard.playbackState.failedStepIndex + 1}에서 중단</span>
            )}
          </div>
          {wizard.playbackState.errorMessage && (
            <div className="text-xs font-mono text-red-600 bg-red-100 px-2 py-1 rounded">
              {wizard.playbackState.errorMessage}
            </div>
          )}
        </div>
      )}
      {wizard.backendScenarioId && (
        <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-200 text-xs text-blue-600">
          저장 완료 (ID: {wizard.backendScenarioId})
        </div>
      )}

      {/* Main content: step list + config panel side by side or stacked */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left: Step list (always visible) */}
        <div className="w-64 border-r border-gray-200 flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">재생 목록</h3>
          </div>
          <WizardStepList
            steps={wizard.steps}
            currentPlaybackIndex={wizard.playbackState.currentStepIndex}
            stepResults={wizard.playbackState.stepResults}
            onRemove={wizard.removeStep}
            onAddStep={handleAddStep}
          />
        </div>

        {/* Right: Config panel or empty */}
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
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            스텝을 추가하거나 선택하세요
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <button
          type="button"
          onClick={handleAddStep}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + 단계추가
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={wizard.playScenario}
            disabled={!wizard.canPlay}
            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ▶ 전체 재생
          </button>
          <button
            type="button"
            onClick={wizard.saveToBackend}
            disabled={!(wizard.canSave && isConnected)}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
