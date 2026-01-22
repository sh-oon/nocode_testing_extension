import {
  type CollectorConfig,
  createEventCollector,
  type EventCollector,
  type RawEvent,
} from '@like-cake/event-collector';
import type { Message } from '../shared/messages';

/**
 * Content Script - Runs in the context of web pages
 * Handles event collection using @like-cake/event-collector
 */

let collector: EventCollector | null = null;
let isInitialized = false;

/**
 * Initialize the event collector with given config
 */
function initializeCollector(config: Partial<CollectorConfig> = {}): void {
  if (collector) {
    collector.stop();
  }

  collector = createEventCollector({
    ...config,
    ignoreSelectors: [
      // Ignore extension-injected elements
      '[data-like-cake-ignore]',
      '.like-cake-overlay',
    ],
  });

  // Forward events to service worker
  collector.onEvent((event: RawEvent) => {
    sendEventToBackground(event);
  });

  isInitialized = true;
  console.log('[Like Cake] Event collector initialized');
}

/**
 * Send captured event to background service worker
 */
function sendEventToBackground(event: RawEvent): void {
  chrome.runtime
    .sendMessage({
      type: 'EVENT_CAPTURED',
      event,
    })
    .catch((error) => {
      // Extension context might be invalidated
      console.warn('[Like Cake] Failed to send event:', error);
    });
}

/**
 * Handle messages from service worker or panel
 */
function handleMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  switch (message.type) {
    case 'START_RECORDING': {
      if (!isInitialized) {
        initializeCollector(message.config);
      }
      collector?.start();
      sendResponse({
        success: true,
        url: window.location.href,
        timestamp: Date.now(),
      });
      console.log('[Like Cake] Recording started');
      break;
    }

    case 'STOP_RECORDING': {
      const eventCount = collector?.getEvents().length ?? 0;
      collector?.stop();
      sendResponse({
        success: true,
        eventCount,
      });
      console.log('[Like Cake] Recording stopped');
      break;
    }

    case 'PAUSE_RECORDING': {
      collector?.pause();
      sendResponse({ success: true });
      console.log('[Like Cake] Recording paused');
      break;
    }

    case 'RESUME_RECORDING': {
      collector?.resume();
      sendResponse({ success: true });
      console.log('[Like Cake] Recording resumed');
      break;
    }

    case 'GET_RECORDING_STATE': {
      const state = collector?.getState() ?? 'idle';
      sendResponse({
        isRecording: state === 'recording',
        isPaused: state === 'paused',
        eventCount: collector?.getEvents().length ?? 0,
      });
      break;
    }

    case 'GET_EVENTS': {
      sendResponse({
        events: collector?.getEvents() ?? [],
        steps: collector?.getSteps() ?? [],
      });
      break;
    }

    case 'CLEAR_EVENTS': {
      collector?.clear();
      sendResponse({ success: true });
      console.log('[Like Cake] Events cleared');
      break;
    }

    case 'PING': {
      sendResponse({ type: 'PONG' });
      break;
    }

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep channel open for async response
}

// Listen for messages
chrome.runtime.onMessage.addListener(handleMessage);

// Notify that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {
  // Extension might not be ready yet
});

console.log('[Like Cake] Content script loaded');
