import type { Step } from '@like-cake/ast-types';
import { mergeTypeSteps, type RawEvent, transformEventsToSteps } from '@like-cake/event-collector';
import type { Message, RecordingStateMessage } from '../shared/messages';
import {
  clearCurrentSession,
  createSession,
  getCurrentSession,
  type RecordingSession,
  saveCurrentSession,
} from '../shared/storage';

/**
 * Service Worker - Background script for the extension
 * Manages recording sessions and coordinates between content script and panel
 */

// Track active recording tab
let activeTabId: number | null = null;
let sessionCache: RecordingSession | null = null;

/**
 * Initialize session cache from storage
 */
async function initializeCache(): Promise<void> {
  sessionCache = await getCurrentSession();

  // If there was a recording in progress, it was interrupted (service worker restart)
  // Reset the recording state to avoid stale UI
  if (sessionCache?.isRecording) {
    console.log('[Like Cake] Found stale recording session, resetting...');
    sessionCache.isRecording = false;
    sessionCache.isPaused = false;
    await saveCurrentSession(sessionCache);
  }

  activeTabId = null;
}

// Initialize on service worker start
initializeCache();

/**
 * Ensure content script is injected into the tab
 * Returns true if ready, false if page needs refresh
 */
async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
  try {
    // Try to ping the content script
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    console.log('[Like Cake] Content script is ready');
    return true;
  } catch {
    // Content script not loaded - reload the page to inject it
    console.log('[Like Cake] Content script not found, reloading page...');

    // Reload the tab - manifest content_scripts will inject automatically
    await chrome.tabs.reload(tabId);

    // Wait for page to load
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Try ping again
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'PING' });
      console.log('[Like Cake] Content script ready after reload');
      return true;
    } catch {
      console.error('[Like Cake] Content script still not available');
      return false;
    }
  }
}

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
  sessionCache = createSession(tab.url);
  await saveCurrentSession(sessionCache);
  activeTabId = tabId;

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
      timestamp: sessionCache.startTime,
    });
  } catch (error) {
    console.error('[Like Cake] Failed to start recording:', error);
    sessionCache.isRecording = false;
    await saveCurrentSession(sessionCache);
  }
}

/**
 * Stop recording
 */
async function stopRecording(): Promise<void> {
  console.log('[Like Cake] stopRecording called, activeTabId:', activeTabId);

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

  activeTabId = null;
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
 * Get current recording state
 */
function getRecordingState(): RecordingStateMessage {
  return {
    type: 'RECORDING_STATE',
    isRecording: sessionCache?.isRecording ?? false,
    isPaused: sessionCache?.isPaused ?? false,
    eventCount: sessionCache?.events.length ?? 0,
    startTime: sessionCache?.startTime,
  };
}

/**
 * Get all recorded events and steps
 */
function getEventsData(): { events: RawEvent[]; steps: Step[] } {
  return {
    events: sessionCache?.events ?? [],
    steps: sessionCache?.steps ?? [],
  };
}

/**
 * Clear all events
 */
async function clearEvents(): Promise<void> {
  if (sessionCache) {
    sessionCache.events = [];
    sessionCache.steps = [];
    await saveCurrentSession(sessionCache);
  }
}

/**
 * Notify all DevTools panels
 */
function notifyPanels(message: Message): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // No panels listening
  });
}

/**
 * Handle messages from content script or panel
 */
chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  // Extract tabId from message (for Side Panel / DevTools)
  const messageTabId = 'tabId' in message ? message.tabId : undefined;

  switch (message.type) {
    case 'START_RECORDING': {
      // Use message.tabId for Side Panel, sender.tab.id for content script
      const recordTabId = messageTabId ?? sender.tab?.id ?? activeTabId;
      console.log('[Like Cake] START_RECORDING - tabId:', recordTabId);
      if (recordTabId) {
        startRecording(recordTabId, message.config);
        sendResponse({ success: true });
      } else {
        console.error('[Like Cake] No tab ID available');
        sendResponse({ error: 'No active tab' });
      }
      break;
    }

    case 'STOP_RECORDING': {
      stopRecording();
      sendResponse({ success: true });
      break;
    }

    case 'PAUSE_RECORDING': {
      if (sessionCache) {
        sessionCache.isPaused = true;
        saveCurrentSession(sessionCache);
      }
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'PAUSE_RECORDING' });
      }
      sendResponse({ success: true });
      break;
    }

    case 'RESUME_RECORDING': {
      if (sessionCache) {
        sessionCache.isPaused = false;
        saveCurrentSession(sessionCache);
      }
      if (activeTabId) {
        chrome.tabs.sendMessage(activeTabId, { type: 'RESUME_RECORDING' });
      }
      sendResponse({ success: true });
      break;
    }

    case 'EVENT_CAPTURED': {
      handleEventCaptured(message.event);
      sendResponse({ success: true });
      break;
    }

    case 'GET_RECORDING_STATE': {
      sendResponse(getRecordingState());
      break;
    }

    case 'GET_EVENTS': {
      sendResponse(getEventsData());
      break;
    }

    case 'CLEAR_EVENTS': {
      clearEvents();
      sendResponse({ success: true });
      break;
    }

    case 'RESET_SESSION': {
      // Force reset everything
      console.log('[Like Cake] Force resetting session');
      sessionCache = null;
      activeTabId = null;
      clearCurrentSession().then(() => {
        sendResponse({ success: true });
      });
      return true; // Keep channel open for async
    }

    case 'PING': {
      sendResponse({ type: 'PONG' });
      break;
    }

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep channel open for async
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
