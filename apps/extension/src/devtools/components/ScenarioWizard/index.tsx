import { useState } from 'react';
import { EventCatalogPicker } from '../shared/EventCatalogPicker';
import { StepConfigPanel } from './StepConfigPanel';
import { useScenarioWizard } from './useScenarioWizard';
import { WizardStepList } from './WizardStepList';
import { WizardToolbar } from './WizardToolbar';

interface ScenarioWizardProps {
  isConnected: boolean;
}

export function ScenarioWizard({ isConnected }: ScenarioWizardProps) {
  const wizard = useScenarioWizard();
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);

  const handleAddStep = () => {
    setShowCatalogPicker(true);
  };

  const handleSelectAction = (eventId: string) => {
    setShowCatalogPicker(false);
    wizard.startDraftFromCatalog(eventId);
  };

  return (
    <div className="flex flex-col h-full">
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

      {/* Playback success/error banner */}
      {wizard.playbackState.state === 'completed' && (
        <div className="px-4 py-2 bg-green-900/50 border-b border-green-800 text-sm text-green-200 flex items-center justify-between">
          <span>시나리오 실행 성공{!isConnected ? '' : ' — 저장 버튼을 눌러 DB에 저장하세요'}</span>
        </div>
      )}
      {wizard.playbackState.state === 'error' && (
        <div className="px-4 py-2 bg-red-900/50 border-b border-red-800 text-sm text-red-200">
          실행 실패 — 스텝을 수정한 후 다시 재생하세요
        </div>
      )}
      {wizard.backendScenarioId && (
        <div className="px-4 py-1.5 bg-blue-900/30 border-b border-blue-800/50 text-xs text-blue-300">
          저장 완료 (ID: {wizard.backendScenarioId})
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex">
        {wizard.draft ? (
          <StepConfigPanel
            draft={wizard.draft}
            isInspecting={wizard.isInspecting}
            onSelectSelector={wizard.selectSelector}
            onUpdateParams={wizard.updateParams}
            onConfirm={wizard.confirmStep}
            onCancel={wizard.cancelDraft}
          />
        ) : (
          <WizardStepList
            steps={wizard.steps}
            currentPlaybackIndex={wizard.playbackState.currentStepIndex}
            stepResults={wizard.playbackState.stepResults}
            onRemove={wizard.removeStep}
            onAddStep={handleAddStep}
          />
        )}
      </div>

      {/* Catalog picker modal */}
      {showCatalogPicker && (
        <EventCatalogPicker
          onSelect={handleSelectAction}
          onClose={() => setShowCatalogPicker(false)}
        />
      )}
    </div>
  );
}
