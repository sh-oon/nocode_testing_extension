import type { PlayerState } from '@like-cake/step-player';

interface PlaybackControlsProps {
  state: PlayerState;
  currentStepIndex: number;
  totalSteps: number;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStep: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export function PlaybackControls({
  state,
  currentStepIndex,
  totalSteps,
  onPlay,
  onPause,
  onStop,
  onStep,
  onReset,
  disabled = false,
}: PlaybackControlsProps) {
  const isPlaying = state === 'playing';
  const isPaused = state === 'paused';
  const isIdle = state === 'idle';
  const isCompleted = state === 'completed' || state === 'stopped';
  const canPlay = isIdle || isPaused || isCompleted;
  const canPause = isPlaying;
  const canStop = isPlaying || isPaused;
  const canStep = isIdle || isPaused;

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50">
      {/* Play / Pause Toggle */}
      {canPlay ? (
        <button
          type="button"
          onClick={onPlay}
          disabled={disabled || totalSteps === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium text-sm transition-colors"
        >
          <PlayIcon />
          {isCompleted ? 'Replay' : isPaused ? 'Resume' : 'Play'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onPause}
          disabled={disabled || !canPause}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium text-sm transition-colors"
        >
          <PauseIcon />
          Pause
        </button>
      )}

      {/* Stop Button */}
      <button
        type="button"
        onClick={onStop}
        disabled={disabled || !canStop}
        className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium text-sm transition-colors"
      >
        <StopIcon />
        Stop
      </button>

      {/* Step Button */}
      <button
        type="button"
        onClick={onStep}
        disabled={disabled || !canStep || currentStepIndex >= totalSteps}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium text-sm transition-colors"
      >
        <StepIcon />
        Step
      </button>

      <div className="flex-1" />

      {/* Reset Button */}
      <button
        type="button"
        onClick={onReset}
        disabled={disabled || isIdle}
        className="flex items-center gap-1 px-3 py-2 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
      >
        <ResetIcon />
        Reset
      </button>

      {/* Progress Indicator */}
      <div className="flex items-center gap-2 ml-2">
        {isPlaying && (
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </span>
        )}
        {isPaused && (
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
          </span>
        )}
        <span className="text-sm text-gray-400">
          {currentStepIndex >= 0 ? currentStepIndex + 1 : 0} / {totalSteps}
        </span>
        {isPlaying && <span className="text-sm text-green-400">Playing...</span>}
        {isPaused && <span className="text-sm text-yellow-400">Paused</span>}
        {isCompleted && <span className="text-sm text-gray-400">Completed</span>}
      </div>
    </div>
  );
}

// Progress Bar Component
export function PlaybackProgress({
  currentStepIndex,
  totalSteps,
  stepResults,
}: {
  currentStepIndex: number;
  totalSteps: number;
  stepResults: Array<{ status: 'passed' | 'failed' | 'skipped' }>;
}) {
  const progress = totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;

  return (
    <div className="px-4 py-2 bg-gray-800/30">
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const result = stepResults[index];
          let bgColor = 'bg-gray-600';
          if (result) {
            if (result.status === 'passed') bgColor = 'bg-green-500';
            else if (result.status === 'failed') bgColor = 'bg-red-500';
            else if (result.status === 'skipped') bgColor = 'bg-yellow-500';
          } else if (index === currentStepIndex) {
            bgColor = 'bg-blue-500 animate-pulse';
          }

          return (
            <div
              key={index}
              className={`h-1.5 flex-1 rounded-full ${bgColor} transition-colors`}
              title={`Step ${index + 1}${result ? `: ${result.status}` : ''}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>Step {currentStepIndex >= 0 ? currentStepIndex + 1 : 0}</span>
        <span>{Math.round(progress)}%</span>
      </div>
    </div>
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

function StepIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="M4 4h3v12H4V4zm6 0l7 6-7 6V4z" />
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
