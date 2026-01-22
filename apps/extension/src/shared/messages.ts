import type { Scenario, Step } from '@like-cake/ast-types';
import type { RawEvent } from '@like-cake/event-collector';

/**
 * Message types for communication between extension components
 */
export type MessageType =
  | 'START_RECORDING'
  | 'STOP_RECORDING'
  | 'PAUSE_RECORDING'
  | 'RESUME_RECORDING'
  | 'RECORDING_STARTED'
  | 'RECORDING_STOPPED'
  | 'EVENT_CAPTURED'
  | 'GET_RECORDING_STATE'
  | 'RECORDING_STATE'
  | 'GET_EVENTS'
  | 'EVENTS_DATA'
  | 'CLEAR_EVENTS'
  | 'EXPORT_SCENARIO'
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
 * Union of all message types
 */
export type Message =
  | StartRecordingMessage
  | StopRecordingMessage
  | RecordingStartedMessage
  | RecordingStoppedMessage
  | EventCapturedMessage
  | GetRecordingStateMessage
  | RecordingStateMessage
  | GetEventsMessage
  | EventsDataMessage
  | ClearEventsMessage
  | ExportScenarioMessage
  | PingMessage
  | PongMessage
  | { type: 'PAUSE_RECORDING' }
  | { type: 'RESUME_RECORDING' }
  | { type: 'RESET_SESSION' };

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
