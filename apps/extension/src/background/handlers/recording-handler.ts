import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { Step } from '@like-cake/ast-types';
import type { FullSnapshot } from '@like-cake/dom-serializer';
import {
  mergeTypeSteps,
  type RawEvent,
  transformEventsToSteps,
} from '@like-cake/event-collector';
import type { Message } from '../../shared/messages';
import {
  clearCurrentSession,
  createSession,
  type LabeledSnapshot,
  saveCurrentSession,
} from '../../shared/storage';
import type { ApiCallCapturedMessage, SnapshotCapturedMessage } from '../../shared/messages';
import {
  activeTabId,
  ensureContentScriptInjected,
  notifyPanels,
  sessionCache,
  setActiveTabId,
  setSessionCache,
  setPendingDomMutations,
} from '../state';

/**
 * Start recording on specified tab
 */
async function startRecording(tabId: number, config?: Record<string, boolean>): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return;

  // Check if this is a restricted URL
  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('about:')
  ) {
    console.error('[Like Cake] Cannot record on restricted URL:', tab.url);
    notifyPanels({
      type: 'RECORDING_STOPPED',
      eventCount: 0,
    });
    return;
  }

  // Ensure content script is injected
  const injected = await ensureContentScriptInjected(tabId);
  if (!injected) {
    console.error('[Like Cake] Failed to ensure content script');
    return;
  }

  // Create new session
  const newSession = createSession(tab.url);
  setSessionCache(newSession);
  await saveCurrentSession(newSession);
  setActiveTabId(tabId);

  // Send start command to content script
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'START_RECORDING',
      config,
    });

    // Notify all DevTools panels
    notifyPanels({
      type: 'RECORDING_STARTED',
      url: tab.url,
      timestamp: newSession.startTime,
    });
  } catch (error) {
    console.error('[Like Cake] Failed to start recording:', error);
    newSession.isRecording = false;
    await saveCurrentSession(newSession);
  }
}

/**
 * Stop recording
 */
async function stopRecording(): Promise<void> {
  console.log('[Like Cake] stopRecording called, activeTabId:', activeTabId);

  // Clear auto-assertion buffers
  setPendingDomMutations([]);

  // Update session state first
  if (sessionCache) {
    sessionCache.isRecording = false;
    sessionCache.isPaused = false;
    await saveCurrentSession(sessionCache);
  }

  // Try to notify content script if we have an active tab
  if (activeTabId !== null) {
    try {
      const response = await chrome.tabs.sendMessage(activeTabId, {
        type: 'STOP_RECORDING',
      });

      // Notify panels
      notifyPanels({
        type: 'RECORDING_STOPPED',
        eventCount: response?.eventCount ?? sessionCache?.events.length ?? 0,
      });
    } catch (error) {
      console.error('[Like Cake] Error notifying content script:', error);
      // Still notify panels even if content script failed
      notifyPanels({
        type: 'RECORDING_STOPPED',
        eventCount: sessionCache?.events.length ?? 0,
      });
    }
  } else {
    // No active tab, just notify panels
    notifyPanels({
      type: 'RECORDING_STOPPED',
      eventCount: sessionCache?.events.length ?? 0,
    });
  }

  setActiveTabId(null);
}

/**
 * Handle event captured from content script
 */
async function handleEventCaptured(event: RawEvent): Promise<void> {
  if (!sessionCache?.isRecording) return;

  sessionCache.events.push(event);

  // Update steps
  sessionCache.steps = mergeTypeSteps(transformEventsToSteps(sessionCache.events));

  // Save to storage periodically (every 10 events)
  if (sessionCache.events.length % 10 === 0) {
    await saveCurrentSession(sessionCache);
  }

  // Notify panels of new event
  notifyPanels({
    type: 'EVENT_CAPTURED',
    event,
  });
}

/**
 * Handle API call captured from content script
 */
async function handleApiCallCaptured(apiCall: CapturedApiCall): Promise<void> {
  if (!sessionCache?.isRecording) return;

  sessionCache.apiCalls.push(apiCall);

  // Save to storage periodically (every 10 API calls)
  if (sessionCache.apiCalls.length % 10 === 0) {
    await saveCurrentSession(sessionCache);
  }

  // Notify panels of new API call
  notifyPanels({
    type: 'API_CALL_CAPTURED',
    apiCall,
  } as ApiCallCapturedMessage);
}

/**
 * Handle snapshot captured from content script
 */
async function handleSnapshotCaptured(snapshot: FullSnapshot, label?: string): Promise<void> {
  if (!sessionCache) return;

  const labeledSnapshot: LabeledSnapshot = {
    snapshot,
    label,
  };

  sessionCache.snapshots.push(labeledSnapshot);

  // Save to storage immediately (snapshots can be large)
  await saveCurrentSession(sessionCache);

  // Notify panels of new snapshot
  notifyPanels({
    type: 'SNAPSHOT_CAPTURED',
    snapshot,
    label,
  } as SnapshotCapturedMessage);

  console.log(`[Like Cake] Snapshot captured${label ? ` (${label})` : ''}`);
}

/**
 * Get current recording state
 */
function getRecordingState(): {
  type: 'RECORDING_STATE';
  isRecording: boolean;
  isPaused: boolean;
  eventCount: number;
  apiCallCount: number;
  snapshotCount: number;
  startTime?: number;
} {
  return {
    type: 'RECORDING_STATE',
    isRecording: sessionCache?.isRecording ?? false,
    isPaused: sessionCache?.isPaused ?? false,
    eventCount: sessionCache?.events.length ?? 0,
    apiCallCount: sessionCache?.apiCalls?.length ?? 0,
    snapshotCount: sessionCache?.snapshots?.length ?? 0,
    startTime: sessionCache?.startTime,
  };
}

/**
 * Get all recorded events and steps
 */
function getEventsData(): { events: RawEvent[]; steps: Step[]; url: string } {
  return {
    events: sessionCache?.events ?? [],
    steps: sessionCache?.steps ?? [],
    url: sessionCache?.url ?? '',
  };
}

/**
 * Get all recorded API calls
 */
function getApiCallsData(): { apiCalls: CapturedApiCall[] } {
  return {
    apiCalls: sessionCache?.apiCalls ?? [],
  };
}

/**
 * Get all recorded snapshots
 */
function getSnapshotsData(): { snapshots: LabeledSnapshot[] } {
  return {
    snapshots: sessionCache?.snapshots ?? [],
  };
}

/**
 * Clear all events, API calls, and snapshots
 */
async function clearEvents(): Promise<void> {
  if (sessionCache) {
    sessionCache.events = [];
    sessionCache.steps = [];
    sessionCache.apiCalls = [];
    sessionCache.snapshots = [];
    await saveCurrentSession(sessionCache);
  }
}

// --- Message handlers ---

export function handleStartRecording(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
  tabId?: number,
): boolean | void {
  const recordTabId = tabId ?? sender.tab?.id ?? activeTabId;
  if (recordTabId) {
    startRecording(recordTabId, (message as { config?: Record<string, boolean> }).config);
    sendResponse({ success: true });
  } else {
    console.error('[Like Cake] No tab ID available');
    sendResponse({ error: 'No active tab' });
  }
}

export function handleStopRecording(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  stopRecording();
  sendResponse({ success: true });
}

export function handlePauseRecording(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  if (sessionCache) {
    sessionCache.isPaused = true;
    saveCurrentSession(sessionCache);
  }
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { type: 'PAUSE_RECORDING' });
  }
  sendResponse({ success: true });
}

export function handleResumeRecording(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  if (sessionCache) {
    sessionCache.isPaused = false;
    saveCurrentSession(sessionCache);
  }
  if (activeTabId) {
    chrome.tabs.sendMessage(activeTabId, { type: 'RESUME_RECORDING' });
  }
  sendResponse({ success: true });
}

export function handleEventCapturedMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  handleEventCaptured((message as { event: RawEvent }).event);
  sendResponse({ success: true });
}

export function handleApiCallCapturedMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  handleApiCallCaptured((message as { apiCall: CapturedApiCall }).apiCall);
  sendResponse({ success: true });
}

export function handleGetRecordingState(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  sendResponse(getRecordingState());
}

export function handleGetEvents(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  sendResponse(getEventsData());
}

export function handleGetApiCalls(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  sendResponse(getApiCallsData());
}

export function handleCaptureSnapshot(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
  tabId?: number,
): boolean | void {
  const captureTabId = tabId ?? sender.tab?.id ?? activeTabId;
  if (captureTabId) {
    chrome.tabs
      .sendMessage(captureTabId, message)
      .then((response) => sendResponse(response))
      .catch((error) => {
        sendResponse({ success: false, error: String(error) });
      });
  } else {
    sendResponse({ success: false, error: 'No active tab' });
  }
  return true; // Keep channel open for async
}

export function handleSnapshotCapturedMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  const msg = message as SnapshotCapturedMessage;
  handleSnapshotCaptured(msg.snapshot, msg.label);
  sendResponse({ success: true });
}

export function handleGetSnapshots(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  sendResponse(getSnapshotsData());
}

export function handleClearEvents(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  clearEvents();
  sendResponse({ success: true });
}

export function handleResetSession(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  console.log('[Like Cake] Force resetting session');
  setSessionCache(null);
  setActiveTabId(null);
  clearCurrentSession().then(() => {
    sendResponse({ success: true });
  });
  return true; // Keep channel open for async
}

export { stopRecording };
