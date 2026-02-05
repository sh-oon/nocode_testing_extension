import { useCallback, useEffect, useRef, useState } from 'react';
import type { StepResult } from '@like-cake/ast-types';
import { getSettings } from '../../shared/api';

interface ExecutionState {
  status: 'idle' | 'running' | 'completed' | 'error';
  executionId?: string;
  currentStepIndex: number;
  stepResults: StepResult[];
  error?: string;
  duration?: number;
}

interface ServerExecutionProps {
  scenarioId: string;
  totalSteps: number;
  onComplete?: (results: StepResult[]) => void;
}

/**
 * Server-side execution component using Backend API + Puppeteer
 */
export function ServerExecution({ scenarioId, totalSteps, onComplete }: ServerExecutionProps) {
  const [state, setState] = useState<ExecutionState>({
    status: 'idle',
    currentStepIndex: -1,
    stepResults: [],
  });
  const [isHeadless, setIsHeadless] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleExecute = useCallback(async () => {
    setState({
      status: 'running',
      currentStepIndex: 0,
      stepResults: [],
    });

    try {
      const settings = await getSettings();
      const baseUrl = settings.backendUrl || 'http://localhost:4000';

      // Connect to WebSocket for progress updates
      const wsUrl = baseUrl.replace('http', 'ws') + '/ws/execution';
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Wait for WebSocket connection
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        ws.onopen = () => {
          console.log('[ServerExecution] WebSocket connected');
          clearTimeout(timeoutId);
          resolve();
        };

        ws.onerror = (error) => {
          console.error('[ServerExecution] WebSocket error:', error);
          clearTimeout(timeoutId);
          reject(new Error('WebSocket connection failed'));
        };

        // Check if already connected (race condition guard)
        if (ws.readyState === WebSocket.OPEN) {
          clearTimeout(timeoutId);
          resolve();
        } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          clearTimeout(timeoutId);
          reject(new Error('WebSocket connection failed'));
        }
      });

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[ServerExecution] WS message:', message);

          switch (message.type) {
            case 'started':
              setState((prev) => ({
                ...prev,
                executionId: message.executionId,
              }));
              // Subscribe to this execution
              ws.send(
                JSON.stringify({
                  type: 'subscribe',
                  executionId: message.executionId,
                })
              );
              break;

            case 'step_complete':
              setState((prev) => ({
                ...prev,
                currentStepIndex: message.stepIndex + 1,
                stepResults: [...prev.stepResults, message.result],
              }));
              break;

            case 'completed':
              setState((prev) => ({
                ...prev,
                status: 'completed',
                duration: message.result?.summary?.duration,
              }));
              if (onComplete && message.result?.stepResults) {
                onComplete(message.result.stepResults);
              }
              ws.close();
              break;

            case 'error':
              setState((prev) => ({
                ...prev,
                status: 'error',
                error: message.error,
              }));
              ws.close();
              break;
          }
        } catch (e) {
          console.error('[ServerExecution] Failed to parse WS message:', e);
        }
      };

      // Execute scenario via API
      const response = await fetch(`${baseUrl}/api/scenarios/${scenarioId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headless: isHeadless }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Execution failed');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Execution failed');
      }

      // Update final state with results
      setState((prev) => ({
        ...prev,
        status: 'completed',
        stepResults: result.data.stepResults,
        duration: result.data.summary?.duration,
      }));

      if (onComplete) {
        onComplete(result.data.stepResults);
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [scenarioId, isHeadless, onComplete]);

  const handleReset = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setState({
      status: 'idle',
      currentStepIndex: -1,
      stepResults: [],
    });
  }, []);

  const progress = totalSteps > 0 ? (state.stepResults.length / totalSteps) * 100 : 0;
  const passed = state.stepResults.filter((r) => r.status === 'passed').length;
  const failed = state.stepResults.filter((r) => r.status === 'failed').length;

  return (
    <div className="bg-gray-800/30 border-b border-gray-700">
      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={handleExecute}
          disabled={state.status === 'running'}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-md font-medium text-sm transition-colors"
        >
          <ServerIcon />
          {state.status === 'running' ? 'Running...' : 'Run on Server'}
        </button>

        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={isHeadless}
            onChange={(e) => setIsHeadless(e.target.checked)}
            disabled={state.status === 'running'}
            className="rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
          />
          Headless
        </label>

        {state.status !== 'idle' && (
          <button
            type="button"
            onClick={handleReset}
            disabled={state.status === 'running'}
            className="px-3 py-1 text-sm text-gray-400 hover:text-white disabled:opacity-50"
          >
            Reset
          </button>
        )}

        <div className="flex-1" />

        {/* Status */}
        {state.status === 'running' && (
          <div className="flex items-center gap-2">
            <LoadingSpinner />
            <span className="text-sm text-purple-400">
              Executing on server... ({state.stepResults.length}/{totalSteps})
            </span>
          </div>
        )}

        {state.status === 'completed' && (
          <div className="flex items-center gap-2">
            <span
              className={`text-sm ${failed > 0 ? 'text-red-400' : 'text-green-400'}`}
            >
              {failed > 0 ? '✗' : '✓'} {passed} passed, {failed} failed
              {state.duration && ` (${(state.duration / 1000).toFixed(1)}s)`}
            </span>
          </div>
        )}

        {state.status === 'error' && (
          <span className="text-sm text-red-400">Error: {state.error}</span>
        )}
      </div>

      {/* Progress bar */}
      {state.status !== 'idle' && (
        <div className="px-4 pb-3">
          <div className="flex gap-0.5">
            {Array.from({ length: totalSteps }).map((_, index) => {
              const result = state.stepResults[index];
              let bgColor = 'bg-gray-600';
              if (result) {
                if (result.status === 'passed') bgColor = 'bg-green-500';
                else if (result.status === 'failed') bgColor = 'bg-red-500';
                else if (result.status === 'skipped') bgColor = 'bg-yellow-500';
              } else if (index === state.currentStepIndex && state.status === 'running') {
                bgColor = 'bg-purple-500 animate-pulse';
              }

              return (
                <div
                  key={index}
                  className={`h-1 flex-1 rounded-full ${bgColor} transition-colors`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>{Math.round(progress)}% complete</span>
            <span>
              {state.stepResults.length} / {totalSteps} steps
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ServerIcon() {
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
        d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin text-purple-400"
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
