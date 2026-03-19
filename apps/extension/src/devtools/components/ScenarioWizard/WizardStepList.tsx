import { useCallback, useRef, useState } from 'react';
import type { Step, StepResult } from '@like-cake/ast-types';

interface WizardStepListProps {
  steps: Step[];
  currentPlaybackIndex: number;
  stepResults: StepResult[];
  isRecording: boolean;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
  onAddStep: () => void;
  onInsertAt: (index: number) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onEditStep: (index: number) => void;
}

const STEP_ICONS: Record<string, string> = {
  navigate: '🔗', click: '👆', type: '⌨️', keypress: '⌨️', hover: '👋',
  scroll: '📜', select: '📋', wait: '⏳', mouseOut: '👋', dragAndDrop: '✊',
  fileUpload: '📎', historyBack: '◀', historyForward: '▶',
  assertElement: '✅', assertApi: '🌐', assertPage: '📄', assertStyle: '🎨',
};

const STEP_LABELS: Record<string, string> = {
  navigate: '페이지 이동', click: '클릭', type: '텍스트 입력', keypress: '키 입력',
  hover: '마우스 올림', scroll: '스크롤', select: '드롭다운 선택', wait: '대기',
  mouseOut: '마우스 뗌', dragAndDrop: '드래그 앤 드롭', fileUpload: '파일 업로드',
  historyBack: '뒤로가기', historyForward: '앞으로가기',
  assertElement: '요소 검증', assertApi: 'API 검증', assertPage: '페이지 검증', assertStyle: '스타일 검증',
};

const ASSERT_TYPES = new Set(['assertElement', 'assertApi', 'assertPage', 'assertStyle']);

function getStepSummary(step: Step): string {
  switch (step.type) {
    case 'navigate': return step.url;
    case 'click': return typeof step.selector === 'string' ? step.selector : '';
    case 'type': return `"${step.value}"`;
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
  isRecording,
  onRemove,
  onDuplicate,
  onAddStep,
  onInsertAt,
  onMove,
  onEditStep,
}: WizardStepListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);

  const handleDragStart = useCallback((idx: number) => {
    dragItemRef.current = idx;
    setDragIndex(idx);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIndex(idx);
  }, []);

  const handleDrop = useCallback((idx: number) => {
    if (dragItemRef.current !== null && dragItemRef.current !== idx) {
      onMove(dragItemRef.current, idx);
    }
    dragItemRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  }, [onMove]);

  const handleDragEnd = useCallback(() => {
    dragItemRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto" data-test-id="wizard-step-list">
      {steps.length === 0 && !isRecording ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-4">
          <div className="text-3xl mb-3">📝</div>
          <p className="text-sm text-gray-400 mb-4">스텝을 추가하거나 녹화하세요</p>
          <button
            type="button"
            onClick={onAddStep}
            className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            + 스텝 추가
          </button>
        </div>
      ) : (
        <div className="py-2">
          {isRecording && (
            <div className="mx-3 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-red-600 font-medium">녹화 중... 페이지에서 작업하세요</span>
            </div>
          )}

          {steps.map((step, idx) => {
            const result = stepResults[idx];
            const isCurrent = idx === currentPlaybackIndex;
            const isAssert = ASSERT_TYPES.has(step.type);
            const isDragging = dragIndex === idx;
            const isDragOver = dragOverIndex === idx;

            const borderColor = result
              ? result.status === 'passed' ? 'border-green-200 bg-green-50/50'
                : result.status === 'failed' ? 'border-red-200 bg-red-50/50'
                : 'border-gray-100'
              : isCurrent
                ? 'border-blue-300 bg-blue-50/50'
                : isAssert
                  ? 'border-indigo-100 bg-indigo-50/30'
                  : 'border-gray-100 hover:bg-gray-50';

            return (
              <div key={idx}>
                {/* Insert button between steps */}
                {!isRecording && (
                  <div className="flex items-center justify-center py-0.5 group/insert">
                    <button
                      type="button"
                      onClick={() => onInsertAt(idx)}
                      className="opacity-0 group-hover/insert:opacity-100 px-2 py-0.5 text-[9px] text-indigo-500 hover:bg-indigo-50 rounded transition-all"
                    >
                      + 검증 삽입
                    </button>
                  </div>
                )}

                <div
                  draggable={!isRecording}
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                  className={`mx-3 px-3 py-2 rounded-lg border ${borderColor} transition-all group cursor-pointer
                    ${isDragging ? 'opacity-40 scale-95' : ''}
                    ${isDragOver ? 'border-blue-400 border-dashed' : ''}`}
                  onClick={() => !isRecording && onEditStep(idx)}
                  onKeyDown={(e) => e.key === 'Enter' && !isRecording && onEditStep(idx)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Drag handle */}
                    {!isRecording && (
                      <span className="text-gray-300 cursor-grab active:cursor-grabbing select-none" title="드래그로 순서 변경">⠿</span>
                    )}

                    <span className="text-[10px] text-gray-400 font-mono w-4 shrink-0 text-right">{idx + 1}</span>
                    <span className="text-sm shrink-0">{STEP_ICONS[step.type] ?? '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${isAssert ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {STEP_LABELS[step.type] ?? step.type}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono truncate">
                        {getStepSummary(step)}
                      </div>
                    </div>
                    {result ? (
                      <StatusBadge status={result.status} />
                    ) : isCurrent ? (
                      <span className="text-[10px] text-blue-500 animate-pulse">실행 중</span>
                    ) : !isRecording ? (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDuplicate(idx); }}
                          className="text-gray-400 hover:text-blue-500 transition-colors"
                          aria-label="복제"
                        >
                          <CopyIcon />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
                          className="text-gray-400 hover:text-red-400 transition-colors"
                          aria-label="삭제"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {result?.status === 'failed' && result.error && (
                    <div className="mt-1.5 ml-7 px-2 py-1 bg-red-50 border border-red-200 rounded text-[10px] text-red-600 font-mono break-all">
                      {result.error.message}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {!isRecording && (
            <div className="mx-3 mt-2">
              <button
                type="button"
                onClick={onAddStep}
                className="w-full px-3 py-2 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                + 스텝 추가
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = status === 'passed'
    ? 'bg-green-100 text-green-700'
    : status === 'failed'
      ? 'bg-red-100 text-red-700'
      : 'bg-gray-100 text-gray-500';
  return <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${styles}`}>{status}</span>;
}

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
