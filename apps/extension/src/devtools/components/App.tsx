import { useCallback, useEffect, useState } from 'react';
import type { Step } from '@like-cake/ast-types';
import type { RawEvent } from '@like-cake/event-collector';
import { checkBackendConnection, getApiClient } from '../../shared/api';
import { getSettings } from '../../shared/storage';
import { EventList } from './EventList';
import { RecordingControls } from './RecordingControls';
import { SettingsPanel } from './SettingsPanel';
import { StepList } from './StepList';

type ViewTab = 'events' | 'steps';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  eventCount: number;
  startTime?: number;
}

interface UploadStatus {
  isUploading: boolean;
  lastUploadTime?: number;
  error?: string;
  sessionId?: string;
}

export function App() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    eventCount: 0,
  });
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
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
        setState(response);
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
    const handleMessage = (message: { type: string; event?: RawEvent }) => {
      switch (message.type) {
        case 'RECORDING_STARTED':
          setState((prev) => ({ ...prev, isRecording: true, isPaused: false }));
          setEvents([]);
          setSteps([]);
          setUploadStatus({ isUploading: false });
          break;
        case 'RECORDING_STOPPED':
          setState((prev) => ({ ...prev, isRecording: false }));
          break;
        case 'EVENT_CAPTURED':
          if (message.event) {
            setEvents((prev) => [...prev, message.event!]);
            // Refresh steps
            chrome.runtime.sendMessage({ type: 'GET_EVENTS' }, (response) => {
              if (response?.steps) {
                setSteps(response.steps);
              }
            });
          }
          setState((prev) => ({
            ...prev,
            eventCount: prev.eventCount + 1,
          }));
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  const handleStart = useCallback(async () => {
    // Get tab ID - works in both DevTools and Side Panel context
    let tabId: number | undefined;

    // Try DevTools context first
    if (typeof chrome.devtools?.inspectedWindow?.tabId === 'number') {
      tabId = chrome.devtools.inspectedWindow.tabId;
      console.log('[Like Cake] Using DevTools tabId:', tabId);
    } else {
      // Side Panel context - get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = tab?.id;
      console.log('[Like Cake] Using Side Panel tabId:', tabId, 'from tab:', tab?.url);
    }

    if (tabId) {
      console.log('[Like Cake] Sending START_RECORDING with tabId:', tabId);
      chrome.runtime.sendMessage({
        type: 'START_RECORDING',
        tabId,
      });
    } else {
      console.error('[Like Cake] No tab ID available!');
    }
  }, []);

  const handleStop = useCallback(async () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });

    // Check if auto-upload is enabled
    const settings = await getSettings();
    if (settings.autoUpload && isConnected && events.length > 0) {
      handleUpload();
    }
  }, [isConnected, events.length]);

  const handlePause = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'PAUSE_RECORDING' });
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const handleResume = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'RESUME_RECORDING' });
    setState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  const handleClear = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'CLEAR_EVENTS' });
    setEvents([]);
    setSteps([]);
    setState((prev) => ({ ...prev, eventCount: 0 }));
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

  const handleUpload = useCallback(async () => {
    if (events.length === 0) return;

    setUploadStatus({ isUploading: true });

    try {
      const client = await getApiClient();

      // Get the URL from the first navigation event or use a default
      const firstNavEvent = events.find((e) => e.type === 'navigation');
      const url = firstNavEvent?.toUrl || 'https://unknown.url';

      // 1. Create session
      const sessionRes = await client.createSession({
        url,
        name: `Recording ${new Date().toLocaleString()}`,
        viewport: { width: 1440, height: 900 },
      });

      if (!sessionRes.success || !sessionRes.data) {
        throw new Error(sessionRes.error || 'Failed to create session');
      }

      const sessionId = sessionRes.data.id;

      // 2. Send events
      const eventsRes = await client.sendEvents(sessionId, events);
      if (!eventsRes.success) {
        throw new Error(eventsRes.error || 'Failed to send events');
      }

      // 3. Stop session
      await client.stopSession(sessionId);

      // 4. Create scenario
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

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-primary-400">Like Cake</h1>
            <ConnectionIndicator connected={isConnected} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {events.length} events / {steps.length} steps
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

      {/* Controls */}
      <RecordingControls
        isRecording={state.isRecording}
        isPaused={state.isPaused}
        onStart={handleStart}
        onStop={handleStop}
        onPause={handlePause}
        onResume={handleResume}
        onClear={handleClear}
        onExport={handleExport}
        hasEvents={events.length > 0}
      />

      {/* Upload Status Banner */}
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

      {/* Manual Upload Button (when not recording and has events) */}
      {!state.isRecording && events.length > 0 && !uploadStatus.lastUploadTime && (
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
          Steps ({steps.length})
        </button>
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'steps' ? <StepList steps={steps} /> : <EventList events={events} />}
      </div>

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
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
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
