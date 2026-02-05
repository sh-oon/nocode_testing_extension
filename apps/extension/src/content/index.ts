import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { Scenario } from '@like-cake/ast-types';
import { captureFullSnapshot, type FullSnapshot } from '@like-cake/dom-serializer';
import {
  type CollectorConfig,
  createEventCollector,
  type EventCollector,
  type RawEvent,
} from '@like-cake/event-collector';
import {
  ExtensionAdapter,
  StepPlayer,
  type PlayerState,
  type StepExecutionResult,
} from '@like-cake/step-player';
import type { CaptureSnapshotMessage, Message, StartPlaybackMessage } from '../shared/messages';

/**
 * Content Script - Runs in the context of web pages
 * Handles event collection using @like-cake/event-collector,
 * API interception using @like-cake/api-interceptor,
 * and DOM snapshots using @like-cake/dom-serializer
 */

// ============================================
// EARLY INJECTION: Patch APIs immediately
// This must happen before any page JavaScript runs
// ============================================
injectNavigationPatchEarly();
injectApiInterceptorEarly();

let collector: EventCollector | null = null;
let isInitialized = false;
let navigationEventBuffer: Array<{ type: string; url: string; timestamp: number }> = [];

/**
 * Inject navigation patch script into main world IMMEDIATELY
 * This runs at document_start, before any page JavaScript
 * Uses external script file to bypass CSP restrictions
 */
function injectNavigationPatchEarly(): void {
  // Listen for navigation events from main world
  window.addEventListener('__like_cake_navigation__', ((event: CustomEvent) => {
    const detail = event.detail;
    if (!detail?.url) return;

    // Buffer events if recording hasn't started yet
    // Or forward immediately if collector is active
    const navEvent = {
      type: detail.type,
      url: detail.url,
      timestamp: Date.now(),
    };

    if (collector?.getState() === 'recording') {
      // Forward immediately
      sendNavigationEvent(navEvent);
    } else {
      // Buffer for later (in case recording starts soon)
      navigationEventBuffer.push(navEvent);
      // Keep buffer small
      if (navigationEventBuffer.length > 50) {
        navigationEventBuffer.shift();
      }
    }
  }) as EventListener);

  // Inject external script file into main world (bypasses CSP)
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject-navigation.js');
  script.onload = () => {
    script.remove(); // Clean up after loading
  };

  // Insert as early as possible
  if (document.documentElement) {
    document.documentElement.appendChild(script);
  } else {
    // Fallback: wait for documentElement
    const observer = new MutationObserver(() => {
      if (document.documentElement) {
        document.documentElement.appendChild(script);
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true });
  }
}

/**
 * Inject API interceptor script into main world IMMEDIATELY
 * This captures fetch/XHR calls from page load
 */
function injectApiInterceptorEarly(): void {
  // Listen for API call events from main world
  window.addEventListener('__like_cake_api_call__', ((event: CustomEvent) => {
    const apiCall = event.detail;
    if (!apiCall?.request) return;

    // Forward to background
    sendApiCallToBackground(apiCall);
  }) as EventListener);

  // Inject external script file into main world
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject-api.js');
  script.onload = () => {
    script.remove();
  };

  // Insert as early as possible
  if (document.documentElement) {
    document.documentElement.appendChild(script);
  } else {
    const observer = new MutationObserver(() => {
      if (document.documentElement) {
        document.documentElement.appendChild(script);
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true });
  }
}

/**
 * Notify main world about recording state change
 */
function notifyMainWorldRecordingState(isRecording: boolean): void {
  const eventName = isRecording ? '__like_cake_start_recording__' : '__like_cake_stop_recording__';
  window.dispatchEvent(new CustomEvent(eventName));
}

/**
 * Send navigation event to background
 */
function sendNavigationEvent(navEvent: { type: string; url: string; timestamp: number }): void {
  // Create a RawEvent-compatible navigation event
  const event: RawEvent = {
    type: 'navigation',
    id: `nav-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp: navEvent.timestamp,
    url: navEvent.url,
    toUrl: navEvent.url,
    navigationType: navEvent.type === 'pushState' ? 'push' :
                    navEvent.type === 'replaceState' ? 'replace' :
                    navEvent.type === 'popState' ? 'pop' : 'push',
  } as RawEvent;

  sendEventToBackground(event);
}

// Playback state
let player: StepPlayer | null = null;
let playbackAdapter: ExtensionAdapter | null = null;

/**
 * Initialize the event collector with given config
 */
function initializeCollector(config: Partial<CollectorConfig> = {}): void {
  if (collector) {
    collector.stop();
  }

  collector = createEventCollector({
    ...config,
    // Disable built-in navigation listener - we handle it separately with early injection
    captureNavigation: false,
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
 * Flush buffered navigation events when recording starts
 * This captures navigations that happened before recording started
 */
function flushNavigationBuffer(): void {
  // Only flush recent events (within last 5 seconds)
  const now = Date.now();
  const recentEvents = navigationEventBuffer.filter(e => now - e.timestamp < 5000);

  for (const navEvent of recentEvents) {
    sendNavigationEvent(navEvent);
  }

  // Clear buffer
  navigationEventBuffer = [];
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
 * Send captured API call to background service worker
 */
function sendApiCallToBackground(apiCall: CapturedApiCall): void {
  chrome.runtime
    .sendMessage({
      type: 'API_CALL_CAPTURED',
      apiCall,
    })
    .catch((error) => {
      // Extension context might be invalidated
      console.warn('[Like Cake] Failed to send API call:', error);
    });
}

/**
 * Send captured snapshot to background service worker
 */
function sendSnapshotToBackground(snapshot: FullSnapshot, label?: string): void {
  chrome.runtime
    .sendMessage({
      type: 'SNAPSHOT_CAPTURED',
      snapshot,
      label,
    })
    .catch((error) => {
      // Extension context might be invalidated
      console.warn('[Like Cake] Failed to send snapshot:', error);
    });
}

/**
 * Capture a DOM snapshot and optionally a screenshot
 */
async function captureSnapshotInternal(includeScreenshot = true): Promise<FullSnapshot> {
  console.log('[Like Cake] Capturing snapshot...');

  try {
    const snapshot = await captureFullSnapshot(
      {
        // DOM serialization config
        includeComputedStyles: false,
        includeBoundingRects: true,
        includeVisibility: true,
        includeShadowDom: true,
        skipSelectors: [
          'script',
          'noscript',
          'style',
          'link[rel="stylesheet"]',
          '[data-like-cake-ignore]',
          '.like-cake-overlay',
        ],
      },
      includeScreenshot
        ? {
            // Screenshot config
            format: 'png',
            scale: 1,
            fullPage: false,
            excludeSelectors: ['[data-like-cake-ignore]', '.like-cake-overlay'],
          }
        : undefined
    );

    // If no screenshot requested, remove it from the result
    if (!includeScreenshot) {
      return { dom: snapshot.dom };
    }

    console.log('[Like Cake] Snapshot captured successfully');
    return snapshot;
  } catch (error) {
    console.error('[Like Cake] Failed to capture snapshot:', error);
    throw error;
  }
}

// ============================================
// Playback Functions
// ============================================

/**
 * Initialize playback with a scenario
 */
async function initializePlayback(scenario: Scenario): Promise<void> {
  // Clean up existing player
  if (player) {
    player.stop();
  }

  // Create adapter and player
  playbackAdapter = new ExtensionAdapter();
  await playbackAdapter.initialize();

  player = new StepPlayer(playbackAdapter, {
    defaultTimeout: 30000,
    screenshotOnFailure: true,
    continueOnFailure: false,
    pauseOnFailure: true,
  });

  // Set up event listeners
  player.on('stepStart', (event) => {
    const { stepIndex, step } = event.data;
    notifyServiceWorker('PLAYBACK_STEP_START', { stepIndex, step });
    console.log(`[Like Cake] Step ${stepIndex} started:`, step?.type);
  });

  player.on('stepComplete', (event) => {
    const { stepIndex, result } = event.data;
    notifyServiceWorker('PLAYBACK_STEP_COMPLETE', {
      stepIndex,
      result: result
        ? {
            status: result.status,
            duration: result.duration,
            error: result.error,
          }
        : undefined,
    });
    console.log(`[Like Cake] Step ${stepIndex} completed:`, result?.status);
  });

  player.on('stateChange', (event) => {
    const { state } = event.data;
    console.log(`[Like Cake] Playback state changed:`, state);
  });

  player.on('playbackComplete', () => {
    notifyServiceWorker('PLAYBACK_COMPLETED', {});
    console.log('[Like Cake] Playback completed');
  });

  player.on('playbackError', (event) => {
    notifyServiceWorker('PLAYBACK_ERROR', {
      error: event.data.error?.message ?? 'Unknown error',
      stepIndex: event.data.stepIndex,
    });
    console.error('[Like Cake] Playback error:', event.data.error);
  });

  // Load scenario
  player.load(scenario);
  console.log('[Like Cake] Playback initialized with scenario:', scenario.id);
}

/**
 * Start or resume playback
 */
async function startPlayback(): Promise<void> {
  if (!player) {
    throw new Error('Player not initialized');
  }

  await player.play();
}

/**
 * Pause playback
 */
function pausePlayback(): void {
  if (player) {
    player.pause();
    console.log('[Like Cake] Playback paused');
  }
}

/**
 * Stop playback
 */
function stopPlayback(): void {
  if (player) {
    player.stop();
    console.log('[Like Cake] Playback stopped');
  }
}

/**
 * Execute single step
 */
async function stepPlayback(): Promise<StepExecutionResult | null> {
  if (!player) {
    throw new Error('Player not initialized');
  }

  return await player.step();
}

/**
 * Get current playback state
 */
function getPlaybackState(): { state: PlayerState; currentStepIndex: number } {
  return {
    state: player?.state ?? 'idle',
    currentStepIndex: player?.currentStepIndex ?? -1,
  };
}

/**
 * Send notification to service worker
 */
function notifyServiceWorker(
  type: string,
  data: Record<string, unknown>
): void {
  chrome.runtime.sendMessage({ type, ...data }).catch((error) => {
    console.warn('[Like Cake] Failed to notify service worker:', error);
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

      // Notify main world to start capturing and flush buffered API calls
      notifyMainWorldRecordingState(true);

      // Send initial navigation event for current URL
      sendNavigationEvent({
        type: 'initial',
        url: window.location.href,
        timestamp: Date.now(),
      });

      // Flush any buffered navigation events from before recording started
      flushNavigationBuffer();

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

      // Notify main world to stop capturing
      notifyMainWorldRecordingState(false);

      sendResponse({
        success: true,
        eventCount,
      });
      console.log('[Like Cake] Recording stopped');
      break;
    }

    case 'PAUSE_RECORDING': {
      collector?.pause();
      notifyMainWorldRecordingState(false);
      sendResponse({ success: true });
      console.log('[Like Cake] Recording paused');
      break;
    }

    case 'RESUME_RECORDING': {
      collector?.resume();
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
      // API calls are now managed by background service worker
      // Forward request to background
      sendResponse({ apiCalls: [] });
      break;
    }

    case 'CAPTURE_SNAPSHOT': {
      const snapshotMessage = message as CaptureSnapshotMessage;
      const includeScreenshot = snapshotMessage.includeScreenshot ?? true;
      const snapshotLabel = snapshotMessage.label;

      // Capture snapshot asynchronously
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

      // Return true to indicate we'll send response asynchronously
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

    // Playback messages
    case 'START_PLAYBACK': {
      const playbackMessage = message as StartPlaybackMessage;
      initializePlayback(playbackMessage.scenario)
        .then(() => startPlayback())
        .then(() => sendResponse({ success: true }))
        .catch((error) => {
          console.error('[Like Cake] Playback failed:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      return true; // Keep channel open for async
    }

    case 'PAUSE_PLAYBACK': {
      pausePlayback();
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
      stopPlayback();
      sendResponse({ success: true });
      break;
    }

    case 'STEP_PLAYBACK': {
      stepPlayback()
        .then((result) => sendResponse({ success: true, result }))
        .catch((error) => {
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      return true; // Keep channel open for async
    }

    case 'GET_PLAYBACK_STATE': {
      sendResponse(getPlaybackState());
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
