interface WizardToolbarProps {
  scenarioName: string;
  onNameChange: (name: string) => void;
  onPlay: () => void;
  onSave: () => void;
  onReset: () => void;
  canPlay: boolean;
  canSave: boolean;
  isSaving: boolean;
  playbackState: string;
  stepCount: number;
  backendScenarioId: string | null;
}

export function WizardToolbar({
  scenarioName,
  onNameChange,
  onPlay,
  onSave,
  onReset,
  canPlay,
  canSave,
  isSaving,
  playbackState,
  stepCount,
  backendScenarioId,
}: WizardToolbarProps) {
  return (
    <nav
      className="px-3 py-2 bg-white border-b border-gray-200 flex items-center gap-2"
      aria-label="Wizard toolbar"
      data-test-id="wizard-toolbar"
    >
      {/* Scenario name */}
      <input
        type="text"
        value={scenarioName}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="시나리오 이름..."
        aria-label="시나리오 이름"
        className="flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-md bg-transparent text-gray-800 placeholder-gray-500 border border-transparent hover:bg-gray-50 focus:bg-white focus:border-gray-300 focus:outline-none cursor-text"
        data-test-id="wizard-toolbar-name"
      />

      {/* Step count */}
      <span className="text-xs text-gray-500 shrink-0">{stepCount} steps</span>

      <div
        className="w-px h-5 bg-gray-200"
        aria-hidden="true"
      />

      {/* Play */}
      <button
        type="button"
        onClick={onPlay}
        disabled={!canPlay}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
          canPlay
            ? 'bg-green-500 hover:bg-green-600 text-white'
            : 'bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'
        }`}
        data-test-id="wizard-toolbar-play"
      >
        {playbackState === 'playing' ? <LoadingSpinner /> : <PlayIcon />}
        <span className="hidden sm:inline">
          {playbackState === 'playing' ? '실행 중...' : '재생'}
        </span>
      </button>

      {/* Save */}
      <button
        type="button"
        onClick={onSave}
        disabled={!canSave || isSaving}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
          canSave && !isSaving
            ? 'bg-blue-500 hover:bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-400 opacity-50 cursor-not-allowed'
        }`}
        data-test-id="wizard-toolbar-save"
      >
        <SaveIcon />
        <span className="hidden sm:inline">
          {isSaving ? '저장 중...' : backendScenarioId ? '저장됨' : '저장'}
        </span>
      </button>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
        aria-label="초기화"
        data-test-id="wizard-toolbar-reset"
      >
        <ResetIcon />
      </button>
    </nav>
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

function ResetIcon() {
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
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
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
