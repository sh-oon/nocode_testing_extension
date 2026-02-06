import { useCallback, useEffect, useState } from 'react';
import type { Scenario, Step, StepResult } from '@like-cake/ast-types';
import type { ComparisonResult } from '@like-cake/diff-engine';
import type { RawEvent } from '@like-cake/event-collector';
import type { PlayerState } from '@like-cake/step-player';
import { checkBackendConnection, getApiClient } from '../../shared/api';
import { getSettings } from '../../shared/storage';
import { DiffViewer } from './DiffViewer';
import { EventList } from './EventList';
import { FlowBuilder } from './FlowBuilder';
import { PlaybackControls, PlaybackProgress } from './PlaybackControls';
import { RecordingControls } from './RecordingControls';
import { ScenarioSelector } from './ScenarioSelector';
import { ServerExecution } from './ServerExecution';
import { SettingsPanel } from './SettingsPanel';
import { StepList } from './StepList';

type AppMode = 'record' | 'playback' | 'flow';
type ViewTab = 'events' | 'steps' | 'diff';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  eventCount: number;
  startTime?: number;
}

interface PlaybackState {
  playerState: PlayerState;
  currentStepIndex: number;
  stepResults: StepResult[];
}

interface UploadStatus {
  isUploading: boolean;
  lastUploadTime?: number;
  error?: string;
  sessionId?: string;
}

export function App() {
  // Mode state
  const [mode, setMode] = useState<AppMode>('record');

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    eventCount: 0,
  });
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);

  // Playback state
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    playerState: 'idle',
    currentStepIndex: -1,
    stepResults: [],
  });
  const [loadedScenario, setLoadedScenario] = useState<Scenario | null>(null);
  const [backendScenarioId, setBackendScenarioId] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, _setIsComparing] = useState(false);
  const [isSavingToBackend, setIsSavingToBackend] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<ViewTab>('steps');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    isUploading: false,
  });

  // Check connection on mount
  useEffect(() => {
    checkBackendConnection().then((result) => {
      setIsConnected(result.connected);
    });
  }, []);

  // Fetch initial state
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATE' }, (response) => {
      if (response) {
        setRecordingState(response);
      }
    });

    chrome.runtime.sendMessage({ type: 'GET_EVENTS' }, (response) => {
      if (response) {
        setEvents(response.events || []);
        setSteps(response.steps || []);
      }
    });
  }, []);

  // Listen for messages from service worker
  useEffect(() => {
    const handleMessage = (message: {
      type: string;
      event?: RawEvent;
      stepIndex?: number;
      step?: Step;
      result?: StepResult;
      state?: PlayerState;
      error?: string;
    }) => {
      switch (message.type) {
        // Recording messages
        case 'RECORDING_STARTED':
          setRecordingState((prev) => ({ ...prev, isRecording: true, isPaused: false }));
          setEvents([]);
          setSteps([]);
          setUploadStatus({ isUploading: false });
          break;
        case 'RECORDING_STOPPED':
          setRecordingState((prev) => ({ ...prev, isRecording: false }));
          break;
        case 'EVENT_CAPTURED':
          if (message.event) {
            setEvents((prev) => [...prev, message.event!]);
            chrome.runtime.sendMessage({ type: 'GET_EVENTS' }, (response) => {
              if (response?.steps) {
                setSteps(response.steps);
              }
            });
          }
          setRecordingState((prev) => ({
            ...prev,
            eventCount: prev.eventCount + 1,
          }));
          break;

        // Playback messages
        case 'PLAYBACK_STATE':
          if (message.state) {
            setPlaybackState((prev) => ({
              ...prev,
              playerState: message.state!,
            }));
          }
          break;
        case 'PLAYBACK_STEP_START':
          if (message.stepIndex !== undefined) {
            setPlaybackState((prev) => ({
              ...prev,
              currentStepIndex: message.stepIndex!,
            }));
          }
          break;
        case 'PLAYBACK_STEP_COMPLETE':
          if (message.result) {
            setPlaybackState((prev) => ({
              ...prev,
              stepResults: [...prev.stepResults, message.result as StepResult],
            }));
          }
          break;
        case 'PLAYBACK_COMPLETED':
          setPlaybackState((prev) => ({
            ...prev,
            playerState: 'completed',
          }));
          break;
        case 'PLAYBACK_ERROR':
          setPlaybackState((prev) => ({
            ...prev,
            playerState: 'error',
          }));
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  // Upload handler (defined before handleStop to avoid use-before-declare)
  const handleUpload = useCallback(async () => {
    if (events.length === 0) return;

    setUploadStatus({ isUploading: true });

    try {
      const client = await getApiClient();
      const firstNavEvent = events.find((e) => e.type === 'navigation');
      const url = firstNavEvent?.toUrl || 'https://unknown.url';

      const sessionRes = await client.createSession({
        url,
        name: `Recording ${new Date().toLocaleString()}`,
        viewport: { width: 1440, height: 900 },
      });

      if (!sessionRes.success || !sessionRes.data) {
        throw new Error(sessionRes.error || 'Failed to create session');
      }

      const sessionId = sessionRes.data.id;

      const eventsRes = await client.sendEvents(sessionId, events);
      if (!eventsRes.success) {
        throw new Error(eventsRes.error || 'Failed to send events');
      }

      await client.stopSession(sessionId);

      const scenarioRes = await client.createScenarioFromSession(sessionId);
      if (!scenarioRes.success) {
        console.warn('Failed to create scenario:', scenarioRes.error);
      }

      setUploadStatus({
        isUploading: false,
        lastUploadTime: Date.now(),
        sessionId,
      });
    } catch (error) {
      setUploadStatus({
        isUploading: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  }, [events]);

  // Recording handlers
  const handleStart = useCallback(async () => {
    let tabId: number | undefined;

    if (typeof chrome.devtools?.inspectedWindow?.tabId === 'number') {
      tabId = chrome.devtools.inspectedWindow.tabId;
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = tab?.id;
    }

    if (tabId) {
      chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        tabId,
      });
    }
  }, []);

  const handleStop = useCallback(async () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });

    const settings = await getSettings();
    if (settings.autoUpload && isConnected && events.length > 0) {
      handleUpload();
    }
  }, [isConnected, events.length, handleUpload]);

  const handlePause = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING' });
    setRecordingState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const handleResume = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'RESUME_RECORDING' });
    setRecordingState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const handleClear = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'CLEAR_EVENTS' });
    setEvents([]);
    setSteps([]);
    setRecordingState((prev) => ({ ...prev, eventCount: 0 }));
    setUploadStatus({ isUploading: false });
  }, []);

  const handleExport = useCallback(() => {
    const scenario = {
      id: `scenario-${Date.now()}`,
      meta: {
        recordedAt: new Date().toISOString(),
        url: window.location.href,
        viewport: { width: 1440, height: 900 },
        astSchemaVersion: '1.0.0',
      },
      steps,
    };

    const blob = new Blob([JSON.stringify(scenario, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scenario-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [steps]);

  // Playback handlers
  const handleLoadScenario = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      try {
        const scenario = JSON.parse(text) as Scenario;
        setLoadedScenario(scenario);
        setBackendScenarioId(null); // Reset backend ID when loading new scenario
        setPlaybackState({
          playerState: 'idle',
          currentStepIndex: -1,
          stepResults: [],
        });
        setComparisonResult(null);
      } catch {
        console.error('Failed to parse scenario file');
      }
    };
    input.click();
  }, []);

  // Load scenario from server
  const handleLoadFromServer = useCallback((scenario: Scenario, backendId: string) => {
    setLoadedScenario(scenario);
    setBackendScenarioId(backendId);
    setPlaybackState({
      playerState: 'idle',
      currentStepIndex: -1,
      stepResults: [],
    });
    setComparisonResult(null);
  }, []);

  // Save scenario to backend for server execution
  const handleSaveToBackend = useCallback(async () => {
    if (!loadedScenario) return null;

    setIsSavingToBackend(true);
    try {
      const client = await getApiClient();
      const response = await client.createScenario({
        name: loadedScenario.name || `Scenario ${new Date().toLocaleString()}`,
        url: loadedScenario.meta?.url || 'https://unknown.url',
        steps: loadedScenario.steps,
        viewport: loadedScenario.meta?.viewport,
      });

      if (response.success && response.data) {
        setBackendScenarioId(response.data.id);
        return response.data.id;
      }
      console.error('Failed to save scenario:', response.error);
      return null;
    } catch (error) {
      console.error('Failed to save scenario:', error);
      return null;
    } finally {
      setIsSavingToBackend(false);
    }
  }, [loadedScenario]);

  const handlePlay = useCallback(async () => {
    if (!loadedScenario) return;

    let tabId: number | undefined;
    if (typeof chrome.devtools?.inspectedWindow?.tabId === 'number') {
      tabId = chrome.devtools.inspectedWindow.tabId;
    } else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = tab?.id;
    }

    if (tabId) {
      setPlaybackState((prev) => ({
        ...prev,
        playerState: 'playing',
        stepResults: [],
      }));
      chrome.runtime.sendMessage({
        type: 'START_PLAYBACK',
        tabId,
        scenario: loadedScenario,
      });
    }
  }, [loadedScenario]);

  const handlePlaybackPause = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'PAUSE_PLAYBACK' });
    setPlaybackState((prev) => ({ ...prev, playerState: 'paused' }));
  }, []);

  const handlePlaybackStop = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'STOP_PLAYBACK' });
    setPlaybackState((prev) => ({ ...prev, playerState: 'stopped' }));
  }, []);

  const handleStep = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'STEP_PLAYBACK' });
  }, []);

  const handlePlaybackReset = useCallback(() => {
    setPlaybackState({
      playerState: 'idle',
      currentStepIndex: -1,
      stepResults: [],
    });
    setComparisonResult(null);
  }, []);

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  // Use recorded steps as scenario for playback
  const handleUseRecordedSteps = useCallback(() => {
    if (steps.length === 0) return;

    const scenario: Scenario = {
      id: `scenario-${Date.now()}`,
      meta: {
        recordedAt: new Date().toISOString(),
        url: '',
        viewport: { width: 1440, height: 900 },
        astSchemaVersion: '1.0.0',
      },
      steps,
    };
    setLoadedScenario(scenario);
    setMode('playback');
  }, [steps]);

  // Step editing handler
  const handleStepUpdate = useCallback(
    async (index: number, updatedStep: Step) => {
      if (!loadedScenario) return;

      const updatedSteps = [...loadedScenario.steps];
      updatedSteps[index] = updatedStep;

      setLoadedScenario((prev) => (prev ? { ...prev, steps: updatedSteps } : prev));

      // Persist to backend if scenario is saved
      if (backendScenarioId) {
        try {
          const client = await getApiClient();
          await client.updateScenario(backendScenarioId, {
            steps: updatedSteps as Array<{ type: string; [key: string]: unknown }>,
          });
        } catch (error) {
          console.error('Failed to persist step update:', error);
        }
      }
    },
    [loadedScenario, backendScenarioId]
  );

  const isStepEditingEnabled =
    mode === 'playback' && loadedScenario !== null && playbackState.playerState === 'idle';

  const totalSteps = loadedScenario?.steps.length ?? 0;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-primary-400">Like Cake</h1>
            <ConnectionIndicator connected={isConnected} />
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-700 rounded-lg p-0.5 ml-2">
              <button
                type="button"
                onClick={() => setMode('record')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === 'record'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Record
              </button>
              <button
                type="button"
                onClick={() => setMode('playback')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === 'playback'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Playback
              </button>
              <button
                type="button"
                onClick={() => setMode('flow')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  mode === 'flow'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Flow
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {mode === 'record'
                ? `${events.length} events / ${steps.length} steps`
                : mode === 'playback'
                  ? `${totalSteps} steps`
                  : 'Flow Builder'}
            </span>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Settings"
            >
              <SettingsIcon />
            </button>
          </div>
        </div>
      </header>

      {/* Flow Builder Mode */}
      {mode === 'flow' ? (
        <FlowBuilder isConnected={isConnected} />
      ) : (
        <>
          {/* Mode-specific Controls */}
          {mode === 'record' ? (
            <RecordingControls
              isRecording={recordingState.isRecording}
              isPaused={recordingState.isPaused}
              onStart={handleStart}
              onStop={handleStop}
              onPause={handlePause}
              onResume={handleResume}
              onClear={handleClear}
              onExport={handleExport}
              hasEvents={events.length > 0}
            />
          ) : (
            <>
          {/* Scenario Loader */}
          {!loadedScenario ? (
            <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700 space-y-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleLoadScenario}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium text-sm transition-colors"
                >
                  <UploadIcon />
                  Load from File
                </button>
                {steps.length > 0 && (
                  <button
                    type="button"
                    onClick={handleUseRecordedSteps}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium text-sm transition-colors"
                  >
                    <RecordIcon />
                    Use Recorded Steps
                  </button>
                )}
              </div>

              {/* Server Scenarios */}
              {isConnected && (
                <ScenarioSelector
                  isConnected={isConnected}
                  onSelect={handleLoadFromServer}
                />
              )}
            </div>
          ) : (
            <>
              <div className="px-4 py-2 bg-gray-800/30 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Scenario:</span>
                  <code className="text-sm text-green-400">{loadedScenario.id}</code>
                </div>
                <button
                  type="button"
                  onClick={handleLoadScenario}
                  className="text-xs text-gray-400 hover:text-gray-200"
                >
                  Change
                </button>
              </div>
              <PlaybackControls
                state={playbackState.playerState}
                currentStepIndex={playbackState.currentStepIndex}
                totalSteps={totalSteps}
                onPlay={handlePlay}
                onPause={handlePlaybackPause}
                onStop={handlePlaybackStop}
                onStep={handleStep}
                onReset={handlePlaybackReset}
              />
              <PlaybackProgress
                currentStepIndex={playbackState.currentStepIndex}
                totalSteps={totalSteps}
                stepResults={playbackState.stepResults}
              />

              {/* Server Execution (when connected to backend) */}
              {isConnected && (
                <div className="border-t border-gray-700">
                  <div className="px-4 py-2 bg-gray-800/50 flex items-center justify-between">
                    <span className="text-xs text-gray-500">Or run on server (Puppeteer)</span>
                    {!backendScenarioId && (
                      <button
                        type="button"
                        onClick={handleSaveToBackend}
                        disabled={isSavingToBackend}
                        className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50"
                      >
                        {isSavingToBackend ? 'Saving...' : 'Save to Backend first'}
                      </button>
                    )}
                  </div>
                  {backendScenarioId ? (
                    <ServerExecution
                      scenarioId={backendScenarioId}
                      totalSteps={totalSteps}
                      onComplete={(results) => {
                        setPlaybackState((prev) => ({
                          ...prev,
                          stepResults: results,
                          playerState: 'completed',
                        }));
                      }}
                    />
                  ) : (
                    <div className="px-4 py-3 text-center text-sm text-gray-500">
                      Save scenario to backend to enable server execution
                    </div>
                  )}
                </div>
              )}
            </>
          )}
            </>
          )}

          {/* Upload Status Banner (Record mode only) */}
          {mode === 'record' && (
            <>
              {uploadStatus.isUploading && (
                <div className="px-4 py-2 bg-blue-900/50 border-b border-blue-800 text-sm text-blue-200 flex items-center gap-2">
                  <LoadingSpinner />
                  Uploading to Backend...
                </div>
              )}
              {uploadStatus.lastUploadTime && !uploadStatus.error && (
                <div className="px-4 py-2 bg-green-900/50 border-b border-green-800 text-sm text-green-200 flex items-center justify-between">
                  <span>Uploaded successfully to Backend</span>
                  <button
                    type="button"
                    onClick={() => setUploadStatus({ isUploading: false })}
                    className="text-green-400 hover:text-green-200"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {uploadStatus.error && (
                <div className="px-4 py-2 bg-red-900/50 border-b border-red-800 text-sm text-red-200 flex items-center justify-between">
                  <span>Upload failed: {uploadStatus.error}</span>
                  <button
                    type="button"
                    onClick={() => setUploadStatus({ isUploading: false })}
                    className="text-red-400 hover:text-red-200"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {!recordingState.isRecording && events.length > 0 && !uploadStatus.lastUploadTime && (
                <div className="px-4 py-2 bg-gray-800/50 border-b border-gray-700 flex items-center justify-between">
                  <span className="text-sm text-gray-400">
                    {isConnected ? 'Ready to upload' : 'Backend not connected'}
                  </span>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!isConnected || uploadStatus.isUploading}
                    className="px-3 py-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 disabled:opacity-50 text-white text-sm rounded-md transition-colors"
                  >
                    Upload to Backend
                  </button>
                </div>
              )}
            </>
          )}

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab('steps')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'steps'
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Steps ({mode === 'record' ? steps.length : totalSteps})
            </button>
            {mode === 'record' && (
              <button
                type="button"
                onClick={() => setActiveTab('events')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'events'
                    ? 'text-primary-400 border-b-2 border-primary-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Raw Events ({events.length})
              </button>
            )}
            {mode === 'playback' && (
              <button
                type="button"
                onClick={() => setActiveTab('diff')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'diff'
                    ? 'text-primary-400 border-b-2 border-primary-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Diff Results
                {comparisonResult && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                      comparisonResult.passed
                        ? 'bg-green-900/50 text-green-300'
                        : 'bg-red-900/50 text-red-300'
                    }`}
                  >
                    {comparisonResult.passed ? 'PASS' : 'FAIL'}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'steps' && (
              <StepList
                steps={mode === 'record' ? steps : loadedScenario?.steps || []}
                currentStepIndex={mode === 'playback' ? playbackState.currentStepIndex : undefined}
                stepResults={mode === 'playback' ? playbackState.stepResults : undefined}
                editable={isStepEditingEnabled}
                onStepUpdate={handleStepUpdate}
              />
            )}
            {activeTab === 'events' && <EventList events={events} />}
            {activeTab === 'diff' && (
              <DiffViewer
                result={comparisonResult}
                isLoading={isComparing}
              />
            )}
          </div>
        </>
      )}

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConnectionChange={handleConnectionChange}
      />
    </div>
  );
}

function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
        connected ? 'bg-green-900/50 text-green-300' : 'bg-gray-700 text-gray-400'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-500'}`} />
      {connected ? 'Connected' : 'Offline'}
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
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

function UploadIcon() {
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
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
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
