import type { DomMutationTracker, EventCollector, IdleDetector } from '@like-cake/event-collector';
import type { StepPlayer } from '@like-cake/step-player';
import type { CaptureSnapshotMessage, Message, StartPlaybackMessage } from '../shared/messages';
import { startElementInspect, stopElementInspect } from './inspection';
import { sendApiCallToBackground, sendSnapshotToBackground } from './messaging';
import {
  initializePlayback,
  getPlaybackState,
  pausePlayback,
  startPlayback,
  stepPlayback,
  stopPlayback,
} from './playback';
import {
  type NavigationEvent,
  flushNavigationBuffer,
  initializeCollector,
  notifyMainWorldRecordingState,
  sendNavigationEvent,
} from './recording';
import { captureSnapshotInternal } from './snapshot';

/**
 * Content Script - Runs in ISOLATED world.
 *
 * NO main world injection at load time.
 * API interception is handled by CDP in the service worker.
 * Navigation is handled by chrome.webNavigation in the service worker.
 *
 * Fallback listeners are activated only when service worker sends
 * ENABLE_FALLBACK_LISTENERS (when CDP is unavailable).
 */

// ============================================
// Constants
// ============================================
const NAV_BUFFER_MAX_SIZE = 50;

// Global State
// ============================================
let collector: EventCollector | null = null;
let idleDetector: IdleDetector | null = null;
let domTracker: DomMutationTracker | null = null;
let isInitialized = false;
let navigationEventBuffer: NavigationEvent[] = [];

let player: StepPlayer | null = null;

// Fallback mode listeners
let fallbackListenersActive = false;

// ============================================
// FALLBACK LISTENERS (activated on demand only)
// ============================================

/**
 * Enable fallback event listeners for when CDP is unavailable.
 * Listens for CustomEvents from injected main-world scripts.
 */
function enableFallbackListeners(): void {
  if (fallbackListenersActive) return;
  fallbackListenersActive = true;

  window.addEventListener('__like_cake_navigation__', handleFallbackNavigation as EventListener);
  window.addEventListener('__like_cake_api_call__', handleFallbackApiCall as EventListener);

  console.log('[Like Cake] Fallback listeners enabled');
}

/**
 * Disable fallback event listeners.
 */
function disableFallbackListeners(): void {
  if (!fallbackListenersActive) return;
  fallbackListenersActive = false;

  window.removeEventListener('__like_cake_navigation__', handleFallbackNavigation as EventListener);
  window.removeEventListener('__like_cake_api_call__', handleFallbackApiCall as EventListener);

  console.log('[Like Cake] Fallback listeners disabled');
}

function handleFallbackNavigation(event: CustomEvent): void {
  const detail = event.detail;
  if (!detail?.url) return;

  const navEvent: NavigationEvent = {
    type: detail.type,
    url: detail.url,
    timestamp: Date.now(),
  };

  if (collector?.getState() === 'recording') {
    sendNavigationEvent(navEvent);
  } else {
    navigationEventBuffer.push(navEvent);
    if (navigationEventBuffer.length > NAV_BUFFER_MAX_SIZE) {
      navigationEventBuffer.shift();
    }
  }
}

function handleFallbackApiCall(event: CustomEvent): void {
  const apiCall = event.detail;
  if (!apiCall?.request) return;
  sendApiCallToBackground(apiCall);
}

// ============================================
// MESSAGE HANDLER
// ============================================

/**
 * Handle messages from service worker or panel
 */
function handleMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void
): boolean {
  switch (message.type) {
    case 'ENABLE_FALLBACK_LISTENERS': {
      enableFallbackListeners();
      sendResponse({ success: true });
      break;
    }

    case 'DISABLE_FALLBACK_LISTENERS': {
      disableFallbackListeners();
      sendResponse({ success: true });
      break;
    }

    case 'START_RECORDING': {
      if (!isInitialized) {
        const components = initializeCollector(message.config);
        collector = components.collector;
        idleDetector = components.idleDetector;
        domTracker = components.domTracker;
        isInitialized = true;
      }
      collector?.start();
      idleDetector?.start();
      domTracker?.start();

      notifyMainWorldRecordingState(true);

      sendNavigationEvent({
        type: 'initial',
        url: window.location.href,
        timestamp: Date.now(),
      });

      flushNavigationBuffer(navigationEventBuffer);
      navigationEventBuffer = [];

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
      idleDetector?.stop();
      domTracker?.stop();

      notifyMainWorldRecordingState(false);

      // Disable fallback listeners if they were active
      disableFallbackListeners();

      sendResponse({
        success: true,
        eventCount,
      });
      console.log('[Like Cake] Recording stopped');
      break;
    }

    case 'PAUSE_RECORDING': {
      collector?.pause();
      idleDetector?.stop();
      domTracker?.stop();
      notifyMainWorldRecordingState(false);
      sendResponse({ success: true });
      console.log('[Like Cake] Recording paused');
      break;
    }

    case 'RESUME_RECORDING': {
      collector?.resume();
      idleDetector?.start();
      domTracker?.start();
      notifyMainWorldRecordingState(true);
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

    case 'GET_API_CALLS': {
      sendResponse({ apiCalls: [] });
      break;
    }

    case 'CAPTURE_SNAPSHOT': {
      const snapshotMessage = message as CaptureSnapshotMessage;
      const includeScreenshot = snapshotMessage.includeScreenshot ?? true;
      const snapshotLabel = snapshotMessage.label;

      captureSnapshotInternal(includeScreenshot)
        .then((snapshot) => {
          sendSnapshotToBackground(snapshot, snapshotLabel);
          sendResponse({ success: true, snapshotId: snapshot.dom.id });
        })
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      return true;
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

    case 'START_PLAYBACK': {
      const playbackMessage = message as StartPlaybackMessage;
      initializePlayback(playbackMessage.scenario)
        .then((components) => {
          player = components.player;
          return startPlayback(player);
        })
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error('[Like Cake] Playback failed:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      return true;
    }

    case 'PAUSE_PLAYBACK': {
      if (player) {
        pausePlayback(player);
      }
      sendResponse({ success: true });
      break;
    }

    case 'RESUME_PLAYBACK': {
      if (player) {
        player.play().catch((error) => {
          console.error('[Like Cake] Resume failed:', error);
        });
      }
      sendResponse({ success: true });
      break;
    }

    case 'STOP_PLAYBACK': {
      if (player) {
        stopPlayback(player);
      }
      sendResponse({ success: true });
      break;
    }

    case 'STEP_PLAYBACK': {
      if (!player) {
        sendResponse({
          success: false,
          error: 'Player not initialized',
        });
        return true;
      }
      stepPlayback(player)
        .then((result) => sendResponse({ success: true, result }))
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      return true;
    }

    case 'GET_PLAYBACK_STATE': {
      sendResponse(getPlaybackState(player));
      break;
    }

    case 'START_ELEMENT_INSPECT': {
      startElementInspect();
      sendResponse({ success: true });
      break;
    }

    case 'STOP_ELEMENT_INSPECT': {
      stopElementInspect();
      sendResponse({ success: true });
      break;
    }

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true;
}

// Listen for messages
chrome.runtime.onMessage.addListener(handleMessage);

// Notify that content script is ready
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY' }).catch(() => {
  // Extension might not be ready yet
});

console.log('[Like Cake] Content script loaded');
