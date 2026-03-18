import type { Step, StepResult } from '@like-cake/ast-types';

interface WizardStepListProps {
  steps: Step[];
  currentPlaybackIndex: number;
  stepResults: StepResult[];
  onRemove: (index: number) => void;
  onAddStep: () => void;
}

const STEP_ICONS: Record<string, string> = {
  navigate: '🔗',
  click: '👆',
  type: '⌨️',
  keypress: '⌨️',
  hover: '👋',
  scroll: '📜',
  select: '📋',
  wait: '⏳',
  mouseOut: '👋',
  dragAndDrop: '✊',
  fileUpload: '📎',
  historyBack: '◀',
  historyForward: '▶',
  assertElement: '✅',
  assertApi: '🌐',
  assertPage: '📄',
  assertStyle: '🎨',
};

const STEP_LABELS: Record<string, string> = {
  navigate: '페이지 이동',
  click: '클릭',
  type: '텍스트 입력',
  keypress: '키 입력',
  hover: '마우스 올림',
  scroll: '스크롤',
  select: '드롭다운 선택',
  wait: '대기',
  mouseOut: '마우스 뗌',
  dragAndDrop: '드래그 앤 드롭',
  fileUpload: '파일 업로드',
  historyBack: '뒤로가기',
  historyForward: '앞으로가기',
  assertElement: '요소 검증',
  assertApi: 'API 검증',
  assertPage: '페이지 검증',
  assertStyle: '스타일 검증',
};

function getStepSummary(step: Step): string {
  switch (step.type) {
    case 'navigate': return step.url;
    case 'click': return typeof step.selector === 'string' ? step.selector : step.selector.value || '';
    case 'type': return `"${step.value}" → ${typeof step.selector === 'string' ? step.selector : ''}`;
    case 'keypress': return step.key;
    case 'wait': return `${step.duration ?? 0}ms`;
    case 'select': return String(step.values);
    default:
      return 'selector' in step && step.selector
        ? typeof step.selector === 'string' ? step.selector : ''
        : '';
  }
}

export function WizardStepList({
  steps,
  currentPlaybackIndex,
  stepResults,
  onRemove,
  onAddStep,
}: WizardStepListProps) {
  return (
    <div className="flex-1 overflow-y-auto" data-test-id="wizard-step-list">
      {steps.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <div className="text-3xl mb-3">📝</div>
          <p className="text-sm text-gray-400 mb-4">
            스텝을 추가하세요
          </p>
          <button
            type="button"
            onClick={onAddStep}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            data-test-id="wizard-add-first-step"
          >
            + 스텝 추가
          </button>
        </div>
      ) : (
        <div className="p-3 space-y-1.5">
          {steps.map((step, idx) => {
            const result = stepResults[idx];
            const isCurrent = idx === currentPlaybackIndex;
            const statusColor = result
              ? result.status === 'passed' ? 'border-green-300 bg-green-50'
                : result.status === 'failed' ? 'border-red-300 bg-red-50'
                : 'border-gray-200'
              : isCurrent
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200';

            return (
              <div key={idx}>
                <div
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md border ${statusColor} group transition-colors`}
                >
                  {/* Step number */}
                  <span className="text-[10px] text-gray-500 font-mono w-5 shrink-0">{idx + 1}</span>

                  {/* Icon */}
                  <span className="text-sm shrink-0">{STEP_ICONS[step.type] ?? '❓'}</span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800">{STEP_LABELS[step.type] ?? step.type}</div>
                    <div className="text-[10px] text-gray-400 font-mono truncate">
                      {getStepSummary(step)}
                    </div>
                  </div>

                  {/* Status / delete */}
                  {result ? (
                    <StatusBadge status={result.status} />
                  ) : isCurrent ? (
                    <span className="text-[10px] text-blue-500 animate-pulse">실행 중</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onRemove(idx)}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all"
                      aria-label="스텝 삭제"
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
                {/* Error detail for failed steps */}
                {result?.status === 'failed' && result.error && (
                  <div className="ml-8 mr-3 mb-1 px-2 py-1 bg-red-50 border border-red-200 rounded text-[10px] text-red-600 font-mono break-all">
                    {result.error.message}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add step button */}
          <button
            type="button"
            onClick={onAddStep}
            className="w-full px-3 py-2 mt-2 text-sm text-gray-400 border border-dashed border-gray-300 rounded-md hover:border-blue-400 hover:text-blue-600 transition-colors"
            data-test-id="wizard-add-step"
          >
            + 스텝 추가
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = status === 'passed'
    ? 'bg-green-600/30 text-green-300'
    : status === 'failed'
      ? 'bg-red-600/30 text-red-300'
      : 'bg-gray-600/30 text-gray-400';

  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${styles}`}>
      {status}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
