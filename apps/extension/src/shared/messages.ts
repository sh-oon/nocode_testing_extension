import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { Scenario, Step } from '@like-cake/ast-types';
import type { FullSnapshot } from '@like-cake/dom-serializer';
import type { RawEvent } from '@like-cake/event-collector';
import type { ScenarioBaseline } from './storage';

/**
 * Message types for communication between extension components
 */
export type MessageType =
  // Recording messages
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'PAUSE_RECORDING'
  | 'RESUME_RECORDING'
  | 'RECORDING_STARTED'
  | 'RECORDING_STOPPED'
  | 'EVENT_CAPTURED'
  | 'API_CALL_CAPTURED'
  | 'CAPTURE_SNAPSHOT'
  | 'SNAPSHOT_CAPTURED'
  | 'GET_RECORDING_STATE'
  | 'RECORDING_STATE'
  | 'GET_EVENTS'
  | 'EVENTS_DATA'
  | 'GET_API_CALLS'
  | 'API_CALLS_DATA'
  | 'GET_SNAPSHOTS'
  | 'SNAPSHOTS_DATA'
  | 'CLEAR_EVENTS'
  | 'EXPORT_SCENARIO'
  // Playback messages
  | 'START_PLAYBACK'
  | 'PAUSE_PLAYBACK'
  | 'RESUME_PLAYBACK'
  | 'STOP_PLAYBACK'
  | 'STEP_PLAYBACK'
  | 'PLAYBACK_STARTED'
  | 'PLAYBACK_PAUSED'
  | 'PLAYBACK_RESUMED'
  | 'PLAYBACK_STOPPED'
  | 'PLAYBACK_COMPLETED'
  | 'PLAYBACK_STEP_START'
  | 'PLAYBACK_STEP_COMPLETE'
  | 'PLAYBACK_ERROR'
  | 'GET_PLAYBACK_STATE'
  | 'PLAYBACK_STATE'
  // Baseline messages
  | 'GET_BASELINES'
  | 'SAVE_BASELINE'
  | 'DELETE_BASELINE'
  | 'BASELINES_DATA'
  // Utility messages
  | 'PING'
  | 'PONG';

/**
 * Base message interface
 */
export interface BaseMessage {
  type: MessageType;
  tabId?: number;
}

/**
 * Start recording message
 */
export interface StartRecordingMessage extends BaseMessage {
  type: 'START_RECORDING';
  config?: {
    captureClicks?: boolean;
    captureInputs?: boolean;
    captureKeyboard?: boolean;
    captureScroll?: boolean;
    captureNavigation?: boolean;
  };
}

/**
 * Stop recording message
 */
export interface StopRecordingMessage extends BaseMessage {
  type: 'STOP_RECORDING';
}

/**
 * Recording started confirmation
 */
export interface RecordingStartedMessage extends BaseMessage {
  type: 'RECORDING_STARTED';
  url: string;
  timestamp: number;
}

/**
 * Recording stopped confirmation
 */
export interface RecordingStoppedMessage extends BaseMessage {
  type: 'RECORDING_STOPPED';
  eventCount: number;
}

/**
 * Event captured message
 */
export interface EventCapturedMessage extends BaseMessage {
  type: 'EVENT_CAPTURED';
  event: RawEvent;
}

/**
 * Get recording state request
 */
export interface GetRecordingStateMessage extends BaseMessage {
  type: 'GET_RECORDING_STATE';
}

/**
 * Recording state response
 */
export interface RecordingStateMessage extends BaseMessage {
  type: 'RECORDING_STATE';
  isRecording: boolean;
  isPaused: boolean;
  eventCount: number;
  startTime?: number;
}

/**
 * Get events request
 */
export interface GetEventsMessage extends BaseMessage {
  type: 'GET_EVENTS';
}

/**
 * Events data response
 */
export interface EventsDataMessage extends BaseMessage {
  type: 'EVENTS_DATA';
  events: RawEvent[];
  steps: Step[];
}

/**
 * Clear events message
 */
export interface ClearEventsMessage extends BaseMessage {
  type: 'CLEAR_EVENTS';
}

/**
 * Export scenario message
 */
export interface ExportScenarioMessage extends BaseMessage {
  type: 'EXPORT_SCENARIO';
  scenario: Scenario;
}

/**
 * Ping message for connection check
 */
export interface PingMessage extends BaseMessage {
  type: 'PING';
}

/**
 * Pong response
 */
export interface PongMessage extends BaseMessage {
  type: 'PONG';
}

/**
 * API call captured message
 */
export interface ApiCallCapturedMessage extends BaseMessage {
  type: 'API_CALL_CAPTURED';
  apiCall: CapturedApiCall;
}

/**
 * Get API calls request
 */
export interface GetApiCallsMessage extends BaseMessage {
  type: 'GET_API_CALLS';
}

/**
 * API calls data response
 */
export interface ApiCallsDataMessage extends BaseMessage {
  type: 'API_CALLS_DATA';
  apiCalls: CapturedApiCall[];
}

/**
 * Capture snapshot request (sent to content script)
 */
export interface CaptureSnapshotMessage extends BaseMessage {
  type: 'CAPTURE_SNAPSHOT';
  /** Whether to include screenshot (default: true) */
  includeScreenshot?: boolean;
  /** Label for this snapshot */
  label?: string;
}

/**
 * Snapshot captured message (sent from content script)
 */
export interface SnapshotCapturedMessage extends BaseMessage {
  type: 'SNAPSHOT_CAPTURED';
  snapshot: FullSnapshot;
  label?: string;
}

/**
 * Get snapshots request
 */
export interface GetSnapshotsMessage extends BaseMessage {
  type: 'GET_SNAPSHOTS';
}

/**
 * Snapshots data response
 */
export interface SnapshotsDataMessage extends BaseMessage {
  type: 'SNAPSHOTS_DATA';
  snapshots: Array<{ snapshot: FullSnapshot; label?: string }>;
}

/**
 * Playback related messages
 */
export interface StartPlaybackMessage extends BaseMessage {
  type: 'START_PLAYBACK';
  scenario: Scenario;
}

export interface PlaybackStateMessage extends BaseMessage {
  type: 'PLAYBACK_STATE';
  state: 'idle' | 'playing' | 'paused' | 'stopped' | 'completed' | 'error';
  currentStepIndex: number;
  totalSteps: number;
}

export interface PlaybackStepStartMessage extends BaseMessage {
  type: 'PLAYBACK_STEP_START';
  stepIndex: number;
  step: Step;
}

export interface PlaybackStepCompleteMessage extends BaseMessage {
  type: 'PLAYBACK_STEP_COMPLETE';
  stepIndex: number;
  result: {
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: { message: string };
  };
}

export interface PlaybackErrorMessage extends BaseMessage {
  type: 'PLAYBACK_ERROR';
  error: string;
  stepIndex?: number;
}

/**
 * Baseline related messages
 */
export interface GetBaselinesMessage extends BaseMessage {
  type: 'GET_BASELINES';
  scenarioId?: string;
}

export interface SaveBaselineMessage extends BaseMessage {
  type: 'SAVE_BASELINE';
  baseline: ScenarioBaseline;
}

export interface DeleteBaselineMessage extends BaseMessage {
  type: 'DELETE_BASELINE';
  id: string;
}

export interface BaselinesDataMessage extends BaseMessage {
  type: 'BASELINES_DATA';
  baselines: Array<{
    id: string;
    scenarioId: string;
    name: string;
    capturedAt: number;
  }>;
}

/**
 * Union of all message types
 */
export type Message =
  | StartRecordingMessage
  | StopRecordingMessage
  | RecordingStartedMessage
  | RecordingStoppedMessage
  | EventCapturedMessage
  | ApiCallCapturedMessage
  | CaptureSnapshotMessage
  | SnapshotCapturedMessage
  | GetRecordingStateMessage
  | RecordingStateMessage
  | GetEventsMessage
  | EventsDataMessage
  | GetApiCallsMessage
  | ApiCallsDataMessage
  | GetSnapshotsMessage
  | SnapshotsDataMessage
  | ClearEventsMessage
  | ExportScenarioMessage
  | PingMessage
  | PongMessage
  | StartPlaybackMessage
  | PlaybackStateMessage
  | PlaybackStepStartMessage
  | PlaybackStepCompleteMessage
  | PlaybackErrorMessage
  | GetBaselinesMessage
  | SaveBaselineMessage
  | DeleteBaselineMessage
  | BaselinesDataMessage
  | { type: 'PAUSE_RECORDING' }
  | { type: 'RESUME_RECORDING' }
  | { type: 'RESET_SESSION' }
  | { type: 'PAUSE_PLAYBACK' }
  | { type: 'RESUME_PLAYBACK' }
  | { type: 'STOP_PLAYBACK' }
  | { type: 'STEP_PLAYBACK' }
  | { type: 'GET_PLAYBACK_STATE' }
  | { type: 'PLAYBACK_STARTED' }
  | { type: 'PLAYBACK_PAUSED' }
  | { type: 'PLAYBACK_RESUMED' }
  | { type: 'PLAYBACK_STOPPED' }
  | { type: 'PLAYBACK_COMPLETED' };

/**
 * Send message to background service worker
 */
export async function sendToBackground<T = unknown>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

/**
 * Send message to content script in specific tab
 */
export async function sendToContentScript<T = unknown>(
  tabId: number,
  message: Message
): Promise<T> {
  return chrome.tabs.sendMessage(tabId, message);
}

/**
 * Send message to all tabs with content script
 */
export async function broadcastToContentScripts(message: Message): Promise<void> {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch {
        // Tab might not have content script
      }
    }
  }
}
