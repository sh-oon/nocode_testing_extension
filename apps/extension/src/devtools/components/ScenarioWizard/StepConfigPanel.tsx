import type { PendingStepDraft, SelectorCandidate } from './useScenarioWizard';
import { CatalogParamForm } from '../shared/CatalogParamForm';

interface StepConfigPanelProps {
  draft: PendingStepDraft;
  isInspecting: boolean;
  onSelectSelector: (selector: string) => void;
  onUpdateParams: (params: Record<string, unknown>) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StepConfigPanel({
  draft,
  isInspecting,
  onSelectSelector,
  onUpdateParams,
  onConfirm,
  onCancel,
}: StepConfigPanelProps) {
  const needsElement = draft.catalogEntry.elementRequirement !== 'none';
  const canConfirm = !isInspecting && (!needsElement || draft.selectedSelector);

  // State A: Awaiting element pick
  if (isInspecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6" data-test-id="wizard-inspect-mode">
        <div className="w-16 h-16 rounded-full bg-orange-600/20 flex items-center justify-center mb-4">
          <div className="w-4 h-4 rounded-full bg-orange-500 animate-ping" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">요소를 선택하세요</h3>
        <p className="text-sm text-gray-400 text-center mb-6 max-w-xs">
          페이지에서 대상 요소를 클릭하세요. ESC로 취소할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
        >
          취소
        </button>
      </div>
    );
  }

  // State B: Configuring step
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4" data-test-id="wizard-step-config">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{draft.catalogEntry.label}</h3>
        <span className="text-xs text-gray-500">{draft.catalogEntry.description}</span>
      </div>

      {/* Element preview */}
      {needsElement && draft.elementInfo && (
        <div className="space-y-3">
          {/* Element HTML preview */}
          {Boolean(draft.elementInfo?.elementHtml) && (
            <div className="px-3 py-2 bg-gray-900 rounded-md">
              <div className="text-[10px] text-gray-500 mb-1">선택된 요소</div>
              <code className="text-xs text-orange-300 font-mono break-all">
                {String(draft.elementInfo.elementHtml).slice(0, 150)}
              </code>
            </div>
          )}

          {/* Selector candidates */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              셀렉터 선택
            </label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {draft.selectorCandidates.map((candidate, i) => (
                <SelectorOption
                  key={i}
                  candidate={candidate}
                  isSelected={draft.selectedSelector === candidate.selector}
                  onSelect={() => onSelectSelector(candidate.selector)}
                />
              ))}
            </div>
          </div>

          {/* Accessibility info */}
          {Boolean(draft.elementInfo?.role || draft.elementInfo?.ariaLabel) && (
            <div className="px-3 py-2 bg-gray-900 rounded-md text-xs text-gray-400">
              <div className="text-[10px] text-gray-500 mb-1">접근성 정보</div>
              {Boolean(draft.elementInfo?.role) && <div>Role: <span className="text-gray-300">{String(draft.elementInfo?.role)}</span></div>}
              {Boolean(draft.elementInfo?.ariaLabel) && <div>Label: <span className="text-gray-300">{String(draft.elementInfo?.ariaLabel)}</span></div>}
              {Boolean(draft.elementInfo?.testId) && <div>Test ID: <span className="text-green-400">{String(draft.elementInfo?.testId)}</span></div>}
            </div>
          )}

          {/* No testId warning */}
          {draft.elementInfo && !draft.elementInfo.testId && (
            <div className="px-3 py-1.5 bg-yellow-900/20 border border-yellow-800/50 rounded-md text-xs text-yellow-300">
              data-testid가 없습니다. 셀렉터 안정성이 낮을 수 있습니다.
            </div>
          )}
        </div>
      )}

      {/* No element needed message */}
      {!needsElement && (
        <div className="text-xs text-gray-500">이 액션은 요소 선택이 필요하지 않습니다.</div>
      )}

      {/* Params */}
      {draft.catalogEntry.params.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2">파라미터</label>
          <CatalogParamForm
            params={draft.catalogEntry.params}
            values={draft.params}
            onChange={onUpdateParams}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-3 py-2 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            canConfirm
              ? 'bg-orange-600 hover:bg-orange-700 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          스텝 추가
        </button>
      </div>
    </div>
  );
}

function SelectorOption({
  candidate,
  isSelected,
  onSelect,
}: {
  candidate: SelectorCandidate;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const strategyColors: Record<string, string> = {
    testId: 'text-green-400',
    ariaLabel: 'text-blue-400',
    role: 'text-purple-400',
    id: 'text-yellow-400',
    name: 'text-cyan-400',
    class: 'text-gray-400',
    css: 'text-gray-500',
    xpath: 'text-gray-600',
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full px-2.5 py-1.5 text-left rounded-md transition-colors ${
        isSelected
          ? 'bg-orange-600/20 border border-orange-600/40'
          : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium ${strategyColors[candidate.strategy] ?? 'text-gray-400'}`}>
          {candidate.strategy}
        </span>
        <div className="flex items-center gap-1">
          {candidate.isUnique && <span className="text-[9px] text-green-500">unique</span>}
          <span className="text-[9px] text-gray-500">{candidate.score}</span>
        </div>
      </div>
      <div className="text-xs font-mono text-gray-300 truncate mt-0.5">{candidate.selector}</div>
    </button>
  );
}
