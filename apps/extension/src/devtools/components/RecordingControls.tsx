interface RecordingControlsProps {
  isRecording: boolean;
  isPaused: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onClear: () => void;
  onExport: () => void;
  hasEvents: boolean;
}

export function RecordingControls({
  isRecording,
  isPaused,
  onStart,
  onStop,
  onPause,
  onResume,
  onClear,
  onExport,
  hasEvents,
}: RecordingControlsProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50">
      {!isRecording ? (
        <button
          type="button"
          onClick={onStart}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium text-sm transition-colors"
        >
          <RecordIcon />
          Start Recording
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md font-medium text-sm transition-colors"
          >
            <StopIcon />
            Stop
          </button>
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium text-sm transition-colors"
            >
              <PlayIcon />
              Resume
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-medium text-sm transition-colors"
            >
              <PauseIcon />
              Pause
            </button>
          )}
        </>
      )}

      <div className="flex-1" />

      <button
        type="button"
        onClick={onClear}
        disabled={!hasEvents}
        className="flex items-center gap-1 px-3 py-2 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
      >
        <TrashIcon />
        Clear
      </button>

      <button
        type="button"
        onClick={onExport}
        disabled={!hasEvents}
        className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium text-sm transition-colors"
      >
        <DownloadIcon />
        Export
      </button>

      {isRecording && (
        <div className="flex items-center gap-2 ml-2">
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isPaused ? 'bg-yellow-400' : 'bg-red-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isPaused ? 'bg-yellow-500' : 'bg-red-500'
              }`}
            />
          </span>
          <span className="text-sm text-gray-400">{isPaused ? 'Paused' : 'Recording...'}</span>
        </div>
      )}
    </div>
  );
}

function RecordIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="6"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="4"
        width="12"
        height="12"
        rx="1"
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
      <path d="M6.5 4.5l9 5.5-9 5.5V4.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
    </svg>
  );
}

function TrashIcon() {
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
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function DownloadIcon() {
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
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}
