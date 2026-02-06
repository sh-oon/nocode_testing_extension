import { useCallback, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FlowToolbarProps {
  flowName: string;
  isModified: boolean;
  isSaving: boolean;
  isLoading: boolean;
  flowId: string | null;
  onOpenList: () => void;
  onCreateNew: () => void;
  onSave: () => void;
  onRun: () => void;
  onFlowNameChange: (name: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FlowToolbar({
  flowName,
  isModified,
  isSaving,
  isLoading,
  flowId,
  onOpenList,
  onCreateNew,
  onSave,
  onRun,
  onFlowNameChange,
}: FlowToolbarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleNameClick = useCallback(() => {
    setIsEditingName(true);
    // Focus after state update
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }, []);

  const handleNameBlur = useCallback(() => {
    setIsEditingName(false);
  }, []);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setIsEditingName(false);
        nameInputRef.current?.blur();
      }
      if (e.key === 'Escape') {
        setIsEditingName(false);
        nameInputRef.current?.blur();
      }
    },
    [],
  );

  const runDisabled = !flowId || isLoading || isSaving;
  const saveDisabled = isSaving || isLoading;

  return (
    <nav
      className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center gap-2"
      aria-label="Flow toolbar"
      data-test-id="flow-toolbar"
    >
      {/* Open list button */}
      <button
        type="button"
        onClick={onOpenList}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
        aria-label="플로우 목록 열기"
        data-test-id="flow-toolbar-open-list"
      >
        <FolderOpenIcon />
        <span className="hidden sm:inline">열기</span>
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-700" aria-hidden="true" />

      {/* Flow name with modification indicator */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {isEditingName ? (
          <label className="sr-only" htmlFor="flow-name-input">
            플로우 이름
          </label>
        ) : null}
        <input
          ref={nameInputRef}
          id="flow-name-input"
          type="text"
          value={flowName}
          onChange={(e) => onFlowNameChange(e.target.value)}
          onFocus={handleNameClick}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          placeholder="플로우 이름 입력..."
          aria-label="플로우 이름"
          className={`
            flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-md transition-colors
            bg-transparent text-gray-100 placeholder-gray-500
            ${isEditingName
              ? 'bg-gray-700 border border-gray-600 focus:outline-none focus:border-blue-500'
              : 'border border-transparent hover:bg-gray-700/50 cursor-text'
            }
          `}
          data-test-id="flow-toolbar-name-input"
        />

        {/* Modified dot indicator */}
        {isModified && !isSaving && (
          <span
            className="shrink-0 w-2 h-2 rounded-full bg-yellow-500"
            title="저장되지 않은 변경사항"
            aria-label="수정됨"
            data-test-id="flow-toolbar-modified-indicator"
          />
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-700" aria-hidden="true" />

      {/* Create new button */}
      <button
        type="button"
        onClick={onCreateNew}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
        aria-label="새 플로우 만들기"
        data-test-id="flow-toolbar-create-new"
      >
        <PlusIcon />
        <span className="hidden sm:inline">새로 만들기</span>
      </button>

      {/* Separator */}
      <div className="w-px h-5 bg-gray-700" aria-hidden="true" />

      {/* Run button */}
      <button
        type="button"
        onClick={onRun}
        disabled={runDisabled}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors
          ${runDisabled
            ? 'bg-gray-700 text-gray-500 opacity-50 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 text-white'
          }
        `}
        aria-label="플로우 실행"
        data-test-id="flow-toolbar-run"
      >
        <PlayIcon />
        <span className="hidden sm:inline">실행</span>
      </button>

      {/* Save button */}
      <button
        type="button"
        onClick={onSave}
        disabled={saveDisabled}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors
          ${saveDisabled
            ? 'bg-gray-700 text-gray-500 opacity-50 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
        aria-label="플로우 저장"
        data-test-id="flow-toolbar-save"
      >
        {isSaving ? <LoadingSpinner /> : <SaveIcon />}
        <span className="hidden sm:inline">
          {isSaving ? '저장 중...' : '저장'}
        </span>
      </button>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function FolderOpenIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
