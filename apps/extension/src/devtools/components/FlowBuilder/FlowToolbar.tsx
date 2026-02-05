interface FlowToolbarProps {
  flowName: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onExecute: () => void;
  onClear: () => void;
  isSaving: boolean;
  isExecuting: boolean;
  hasNodes: boolean;
  isModified: boolean;
}

export function FlowToolbar({
  flowName,
  onNameChange,
  onSave,
  onExecute,
  onClear,
  isSaving,
  isExecuting,
  hasNodes,
  isModified,
}: FlowToolbarProps) {
  return (
    <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
      <input
        type="text"
        value={flowName}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Flow name..."
        className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          disabled={!hasNodes}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
        >
          Clear
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !hasNodes}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:opacity-50 text-white text-sm rounded-md transition-colors"
        >
          {isSaving ? <LoadingSpinner /> : <SaveIcon />}
          {isSaving ? 'Saving...' : 'Save'}
          {isModified && !isSaving && <span className="text-primary-300">*</span>}
        </button>

        <button
          type="button"
          onClick={onExecute}
          disabled={isExecuting || !hasNodes}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white text-sm rounded-md transition-colors"
        >
          {isExecuting ? <LoadingSpinner /> : <PlayIcon />}
          {isExecuting ? 'Running...' : 'Run Flow'}
        </button>
      </div>
    </div>
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
