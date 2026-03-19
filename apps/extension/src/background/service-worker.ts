import type { Message } from '../shared/messages';
import {
  handleDomMutationsStableMessage,
  handleIdleDetectedMessage,
} from './handlers/auto-assertion-handler';
import {
  handleDeleteBaseline,
  handleGetBaselines,
  handleSaveBaseline,
} from './handlers/baseline-handler';
import {
  handleElementInspected,
  handleStartElementInspect,
  handleStopElementInspect,
} from './handlers/inspect-handler';
import {
  handleGetPlaybackState,
  handlePausePlayback,
  handlePlaybackErrorMessage,
  handlePlaybackStepCompleteMessage,
  handlePlaybackStepStartMessage,
  handleResumePlayback,
  handleStartPlayback,
  handleStepPlayback,
  handleStopPlayback,
} from './handlers/playback-handler';
import {
  handleApiCallCapturedMessage,
  handleCaptureSnapshot,
  handleClearEvents,
  handleEventCapturedMessage,
  handleGetApiCalls,
  handleGetEvents,
  handleGetRecordingState,
  handleGetSnapshots,
  handlePauseRecording,
  handleResetSession,
  handleResumeRecording,
  handleSnapshotCapturedMessage,
  handleStartRecording,
  handleStopRecording,
  stopRecording,
} from './handlers/recording-handler';
import { activeTabId, initializeCache, sessionCache } from './state';

/**
 * Service Worker - Background script for the extension
 * Manages recording sessions and coordinates between content script and panel
 */

// Initialize on service worker start
initializeCache();

/**
 * Handle messages from content script or panel.
 * Each case delegates to a domain-specific handler module.
 */
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  try {
  // Extract tabId from message (for Side Panel / DevTools)
  const messageTabId = 'tabId' in message ? message.tabId : undefined;

  switch (message.type) {
    // --- Recording ---
    case 'START_RECORDING':
      return handleStartRecording(message, sender, sendResponse, messageTabId);
    case 'STOP_RECORDING':
      return handleStopRecording(message, sender, sendResponse);
    case 'PAUSE_RECORDING':
      return handlePauseRecording(message, sender, sendResponse);
    case 'RESUME_RECORDING':
      return handleResumeRecording(message, sender, sendResponse);
    case 'EVENT_CAPTURED':
      return handleEventCapturedMessage(message, sender, sendResponse);
    case 'API_CALL_CAPTURED':
      return handleApiCallCapturedMessage(message, sender, sendResponse);
    case 'GET_RECORDING_STATE':
      return handleGetRecordingState(message, sender, sendResponse);
    case 'GET_EVENTS':
      return handleGetEvents(message, sender, sendResponse);
    case 'GET_API_CALLS':
      return handleGetApiCalls(message, sender, sendResponse);
    case 'CAPTURE_SNAPSHOT':
      return handleCaptureSnapshot(message, sender, sendResponse, messageTabId);
    case 'SNAPSHOT_CAPTURED':
      return handleSnapshotCapturedMessage(message, sender, sendResponse);
    case 'GET_SNAPSHOTS':
      return handleGetSnapshots(message, sender, sendResponse);
    case 'CLEAR_EVENTS':
      return handleClearEvents(message, sender, sendResponse);
    case 'RESET_SESSION':
      return handleResetSession(message, sender, sendResponse);

    // --- Auto-assertion ---
    case 'IDLE_DETECTED':
      return handleIdleDetectedMessage(message, sender, sendResponse);
    case 'DOM_MUTATIONS_STABLE':
      return handleDomMutationsStableMessage(message, sender, sendResponse);

    // --- Element inspect ---
    case 'START_ELEMENT_INSPECT':
      return handleStartElementInspect(message, sender, sendResponse, messageTabId);
    case 'STOP_ELEMENT_INSPECT':
      return handleStopElementInspect(message, sender, sendResponse, messageTabId);
    case 'ELEMENT_INSPECTED':
      return handleElementInspected(message, sender, sendResponse);

    // --- Playback ---
    case 'START_PLAYBACK':
      return handleStartPlayback(message, sender, sendResponse, messageTabId);
    case 'PAUSE_PLAYBACK':
      return handlePausePlayback(message, sender, sendResponse);
    case 'RESUME_PLAYBACK':
      return handleResumePlayback(message, sender, sendResponse);
    case 'STOP_PLAYBACK':
      return handleStopPlayback(message, sender, sendResponse);
    case 'STEP_PLAYBACK':
      return handleStepPlayback(message, sender, sendResponse);
    case 'GET_PLAYBACK_STATE':
      return handleGetPlaybackState(message, sender, sendResponse);
    case 'PLAYBACK_STEP_START':
      return handlePlaybackStepStartMessage(message, sender, sendResponse);
    case 'PLAYBACK_STEP_COMPLETE':
      return handlePlaybackStepCompleteMessage(message, sender, sendResponse);
    case 'PLAYBACK_ERROR':
      return handlePlaybackErrorMessage(message, sender, sendResponse);

    // --- Baselines ---
    case 'GET_BASELINES':
      return handleGetBaselines(message, sender, sendResponse);
    case 'SAVE_BASELINE':
      return handleSaveBaseline(message, sender, sendResponse);
    case 'DELETE_BASELINE':
      return handleDeleteBaseline(message, sender, sendResponse);

    // --- Utility ---
    case 'PING': {
      sendResponse({ type: 'PONG' });
      break;
    }

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep channel open for async
  } catch (error) {
    console.error('[Like Cake] Message handler error:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Internal error' });
    return false;
  }
});

// Handle tab close - stop recording if active tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    stopRecording();
  }
});

// Handle tab navigation - continue recording on same tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && changeInfo.url && sessionCache?.isRecording) {
    // URL changed, recording continues
    console.log('[Like Cake] Navigation detected:', changeInfo.url);
  }
});

// Handle action button click - open Side Panel
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

console.log('[Like Cake] Service worker started');
