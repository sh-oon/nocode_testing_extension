import { useCallback, useRef, useState } from 'react';

interface ModelToolbarProps {
  modelName: string;
  baseUrl: string;
  isModified: boolean;
  isSaving: boolean;
  onModelNameChange: (name: string) => void;
  onBaseUrlChange: (url: string) => void;
  onOpenList: () => void;
  onCreateNew: () => void;
  onSave: () => void;
  onExport: () => void;
  onGenerate: () => void;
  onImportRecording: () => void;
}

export function ModelToolbar({
  modelName,
  baseUrl,
  isModified,
  isSaving,
  onModelNameChange,
  onBaseUrlChange,
  onOpenList,
  onCreateNew,
  onSave,
  onExport,
  onGenerate,
  onImportRecording,
}: ModelToolbarProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleNameClick = useCallback(() => {
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }, []);

  const handleNameBlur = useCallback(() => {
    setIsEditingName(false);
  }, []);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        setIsEditingName(false);
        nameInputRef.current?.blur();
      }
    },
    [],
  );

  return (
    <nav
      className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center gap-2"
      aria-label="Model toolbar"
      data-test-id="model-toolbar"
    >
      {/* Open list */}
      <button
        type="button"
        onClick={onOpenList}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
        aria-label="모델 목록 열기"
        data-test-id="model-toolbar-open-list"
      >
        <FolderOpenIcon />
        <span className="hidden sm:inline">열기</span>
      </button>

      <div className="w-px h-5 bg-gray-700" aria-hidden="true" />

      {/* Model name */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <input
          ref={nameInputRef}
          type="text"
          value={modelName}
          onChange={(e) => onModelNameChange(e.target.value)}
          onFocus={handleNameClick}
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          placeholder="모델 이름 입력..."
          aria-label="모델 이름"
          className={`
            flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-md transition-colors
            bg-transparent text-gray-100 placeholder-gray-500
            ${isEditingName
              ? 'bg-gray-700 border border-gray-600 focus:outline-none focus:border-orange-500'
              : 'border border-transparent hover:bg-gray-700/50 cursor-text'
            }
          `}
          data-test-id="model-toolbar-name-input"
        />

        {isModified && !isSaving && (
          <span
            className="shrink-0 w-2 h-2 rounded-full bg-yellow-500"
            title="저장되지 않은 변경사항"
            aria-label="수정됨"
          />
        )}
      </div>

      {/* Base URL */}
      <input
        type="text"
        value={baseUrl}
        onChange={(e) => onBaseUrlChange(e.target.value)}
        placeholder="Base URL"
        aria-label="Base URL"
        className="w-48 px-2.5 py-1.5 text-sm rounded-md bg-gray-700 border border-gray-600 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-orange-500"
        data-test-id="model-toolbar-base-url"
      />

      <div className="w-px h-5 bg-gray-700" aria-hidden="true" />

      {/* Create new */}
      <button
        type="button"
        onClick={onCreateNew}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
        aria-label="새 모델 만들기"
        data-test-id="model-toolbar-create-new"
      >
        <PlusIcon />
      </button>

      {/* Import Recording */}
      <button
        type="button"
        onClick={onImportRecording}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
        aria-label="녹화 가져오기"
        data-test-id="model-toolbar-import-recording"
      >
        <ImportIcon />
        <span className="hidden sm:inline">가져오기</span>
      </button>

      <div className="w-px h-5 bg-gray-700" aria-hidden="true" />

      {/* Generate */}
      <button
        type="button"
        onClick={onGenerate}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors bg-orange-600 hover:bg-orange-700 text-white"
        aria-label="시나리오 생성"
        data-test-id="model-toolbar-generate"
      >
        <BoltIcon />
        <span className="hidden sm:inline">Generate</span>
      </button>

      {/* Export */}
      <button
        type="button"
        onClick={onExport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
        aria-label="JSON 내보내기"
        data-test-id="model-toolbar-export"
      >
        <ExportIcon />
      </button>

      {/* Save */}
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors
          ${isSaving
            ? 'bg-gray-700 text-gray-500 opacity-50 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
          }
        `}
        aria-label="모델 저장"
        data-test-id="model-toolbar-save"
      >
        {isSaving ? <LoadingSpinner /> : <SaveIcon />}
        <span className="hidden sm:inline">
          {isSaving ? '저장 중...' : '저장'}
        </span>
      </button>
    </nav>
  );
}

/* Icons */

function FolderOpenIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
