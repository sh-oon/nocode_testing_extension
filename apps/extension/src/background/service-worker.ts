import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { Scenario, Step } from '@like-cake/ast-types';
import type { FullSnapshot } from '@like-cake/dom-serializer';
import {
  mergeTypeSteps,
  type RawEvent,
  transformEventsToSteps,
  transformApiCallsToSteps,
  generateApiAssertions,
  getRelevantApiCalls,
  DEFAULT_EXCLUDE_PATTERNS,
  type TrackedMutation,
} from '@like-cake/event-collector';
import type {
  ApiCallCapturedMessage,
  DomMutationsStableMessage,
  IdleDetectedMessage,
  Message,
  RecordingStateMessage,
  SnapshotCapturedMessage,
  PlaybackStateMessage,
  StartPlaybackMessage,
} from '../shared/messages';
import {
  clearCurrentSession,
  createPlaybackSession,
  createSession,
  getBaselines,
  getCurrentSession,
  getPlaybackSession,
  type LabeledSnapshot,
  type PlaybackSession,
  type RecordingSession,
  type ScenarioBaseline,
  saveBaseline,
  saveCurrentSession,
  savePlaybackSession,
  deleteBaseline,
} from '../shared/storage';

/**
 * Service Worker - Background script for the extension
 * Manages recording sessions and coordinates between content script and panel
 */

// Track active recording tab
let activeTabId: number | null = null;
let sessionCache: RecordingSession | null = null;

// Playback state
let playbackCache: PlaybackSession | null = null;

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

  // Initialize playback cache
  playbackCache = await getPlaybackSession();
  if (playbackCache && playbackCache.state === 'playing') {
    console.log('[Like Cake] Found stale playback session, resetting...');
    playbackCache.state = 'stopped';
    await savePlaybackSession(playbackCache);
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

  // Clear auto-assertion buffers
  pendingDomMutations = [];

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
 * Get current recording state
 */
function getRecordingState(): RecordingStateMessage & {
  apiCallCount: number;
  snapshotCount: number;
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
 * Steps include both UI actions and API assertions
 */
function getEventsData(): { events: RawEvent[]; steps: Step[] } {
  const uiSteps = sessionCache?.steps ?? [];
  const apiCalls = sessionCache?.apiCalls ?? [];

  // Transform API calls to assertApi steps
  const apiSteps = transformApiCallsToSteps(apiCalls, {
    includeResponseBody: false, // Don't include body by default
    excludePatterns: [
      /google-analytics/,
      /googletagmanager/,
      /facebook\.com\/tr/,
      /analytics/,
      /tracking/,
      /beacon/,
      /hot-update/,
      /__vite/,
      /__webpack/,
      /\.map$/,
    ],
  });

  // Merge UI steps and API steps
  // API steps are added after the UI steps that triggered them
  const allSteps = [...uiSteps, ...apiSteps];

  return {
    events: sessionCache?.events ?? [],
    steps: allSteps,
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

// ============================================
// Auto-Assertion: Idle Detection + Step Insertion
// ============================================

/**
 * Buffer of pending DOM mutations received from content script.
 * These are consumed when IDLE_DETECTED fires.
 */
let pendingDomMutations: TrackedMutation[] = [];

/**
 * Handle DOM mutations stable message from content script.
 * Buffers mutations until idle is detected.
 */
function handleDomMutationsStable(mutations: TrackedMutation[]): void {
  if (!sessionCache?.isRecording) return;

  // Replace (not append) — each stable event represents the latest state
  pendingDomMutations = mutations;
  console.log(`[Like Cake] Buffered ${mutations.length} DOM mutations`);
}

/**
 * Handle idle detected message from content script.
 * This is the main orchestrator: inserts wait → assertApi → assertElement steps.
 */
function handleIdleDetected(
  idleStartedAt: number,
  idleDuration: number,
  _lastEventType: string
): void {
  if (!sessionCache?.isRecording) return;

  const autoSteps: import('@like-cake/ast-types').Step[] = [];
  const idleDetectedAt = idleStartedAt + idleDuration;

  // 1. Insert a domStable wait step
  autoSteps.push({
    type: 'wait',
    strategy: 'domStable',
    stabilityThreshold: 1500,
    description: 'Wait for DOM to stabilize after user action',
  });

  // 2. Generate assertApi steps from API calls during the idle window
  const apiCalls = sessionCache.apiCalls ?? [];
  if (apiCalls.length > 0) {
    const relevantCalls = getRelevantApiCalls(apiCalls, {
      lastEventTimestamp: idleStartedAt,
      idleDetectedAt,
    }, {
      excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
    });
    const apiAssertions = generateApiAssertions(relevantCalls, {
      maxAssertions: 2,
    });
    autoSteps.push(...apiAssertions);
  }

  // 3. Generate assertElement steps from buffered DOM mutations
  for (const mutation of pendingDomMutations) {
    const selectorInput: import('@like-cake/ast-types').SelectorInput = {
      strategy: 'css' as const,
      value: mutation.selector,
    };

    if (mutation.type === 'added' && mutation.textContent) {
      autoSteps.push({
        type: 'assertElement',
        selector: selectorInput,
        assertion: { type: 'text', value: mutation.textContent, contains: true },
        description: `Verify element "${mutation.selector}" contains "${mutation.textContent.slice(0, 40)}"`,
      });
    } else if (mutation.type === 'added') {
      autoSteps.push({
        type: 'assertElement',
        selector: selectorInput,
        assertion: { type: 'visible' },
        description: `Verify element "${mutation.selector}" is visible`,
      });
    } else if (mutation.type === 'textChanged' && mutation.textContent) {
      autoSteps.push({
        type: 'assertElement',
        selector: selectorInput,
        assertion: { type: 'text', value: mutation.textContent, contains: true },
        description: `Verify text changed to "${mutation.textContent.slice(0, 40)}"`,
      });
    }
  }

  // Clear the pending buffer
  pendingDomMutations = [];

  if (autoSteps.length <= 1) {
    // Only the wait step — nothing meaningful to assert
    console.log('[Like Cake] Idle detected but no meaningful assertions to add');
    return;
  }

  // Append auto-generated steps to session
  sessionCache.steps.push(...autoSteps);

  // Save to storage
  saveCurrentSession(sessionCache);

  // Notify panels of new steps
  notifyPanels({
    type: 'EVENTS_DATA',
    events: sessionCache.events,
    steps: sessionCache.steps,
  });

  console.log(`[Like Cake] Auto-inserted ${autoSteps.length} assertion steps`);
}

/**
 * Notify all DevTools panels
 */
function notifyPanels(message: Message): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // No panels listening
  });
}

// ============================================
// Playback Functions
// ============================================

/**
 * Start playback of a scenario
 */
async function startPlayback(
  tabId: number,
  scenario: Scenario,
  baselineId?: string
): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) return;

  // Check if this is a restricted URL
  if (
    tab.url.startsWith('chrome://') ||
    tab.url.startsWith('chrome-extension://') ||
    tab.url.startsWith('about:')
  ) {
    console.error('[Like Cake] Cannot playback on restricted URL:', tab.url);
    notifyPanels({
      type: 'PLAYBACK_ERROR',
      error: 'Cannot playback on restricted URL',
    });
    return;
  }

  // Ensure content script is injected
  const injected = await ensureContentScriptInjected(tabId);
  if (!injected) {
    console.error('[Like Cake] Failed to ensure content script for playback');
    return;
  }

  // Create playback session
  const totalSteps = scenario.steps.length;
  playbackCache = createPlaybackSession(scenario.id, totalSteps, baselineId);
  playbackCache.state = 'playing';
  playbackCache.startTime = Date.now();
  activeTabId = tabId;

  await savePlaybackSession(playbackCache);

  // Notify panels that playback started
  notifyPanels({
    type: 'PLAYBACK_STARTED',
  } as Message);

  // Start playback in content script
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'START_PLAYBACK',
      scenario,
    } as StartPlaybackMessage);
  } catch (error) {
    console.error('[Like Cake] Failed to start playback:', error);
    playbackCache.state = 'error';
    playbackCache.error = error instanceof Error ? error.message : String(error);
    await savePlaybackSession(playbackCache);

    notifyPanels({
      type: 'PLAYBACK_ERROR',
      error: playbackCache.error,
    });
  }
}

/**
 * Pause playback
 */
async function pausePlayback(): Promise<void> {
  if (playbackCache) {
    playbackCache.state = 'paused';
    await savePlaybackSession(playbackCache);
  }

  if (activeTabId) {
    try {
      await chrome.tabs.sendMessage(activeTabId, { type: 'PAUSE_PLAYBACK' });
    } catch (error) {
      console.error('[Like Cake] Failed to pause playback:', error);
    }
  }

  notifyPanels({ type: 'PLAYBACK_PAUSED' } as Message);
}

/**
 * Resume playback
 */
async function resumePlayback(): Promise<void> {
  if (playbackCache) {
    playbackCache.state = 'playing';
    await savePlaybackSession(playbackCache);
  }

  if (activeTabId) {
    try {
      await chrome.tabs.sendMessage(activeTabId, { type: 'RESUME_PLAYBACK' });
    } catch (error) {
      console.error('[Like Cake] Failed to resume playback:', error);
    }
  }

  notifyPanels({ type: 'PLAYBACK_RESUMED' } as Message);
}

/**
 * Stop playback
 */
async function stopPlayback(): Promise<void> {
  if (playbackCache) {
    playbackCache.state = 'stopped';
    await savePlaybackSession(playbackCache);
  }

  if (activeTabId) {
    try {
      await chrome.tabs.sendMessage(activeTabId, { type: 'STOP_PLAYBACK' });
    } catch (error) {
      console.error('[Like Cake] Failed to stop playback:', error);
    }
  }

  notifyPanels({ type: 'PLAYBACK_STOPPED' } as Message);
}

/**
 * Execute single step
 */
async function stepPlayback(): Promise<void> {
  if (!playbackCache || playbackCache.state !== 'paused') {
    return;
  }

  if (activeTabId) {
    try {
      await chrome.tabs.sendMessage(activeTabId, { type: 'STEP_PLAYBACK' });
    } catch (error) {
      console.error('[Like Cake] Failed to step playback:', error);
    }
  }
}

/**
 * Handle playback step start from content script
 */
async function handlePlaybackStepStart(stepIndex: number, step: Step): Promise<void> {
  if (playbackCache) {
    playbackCache.currentStepIndex = stepIndex;
    await savePlaybackSession(playbackCache);
  }

  notifyPanels({
    type: 'PLAYBACK_STEP_START',
    stepIndex,
    step,
  });
}

/**
 * Handle playback step complete from content script
 */
async function handlePlaybackStepComplete(
  stepIndex: number,
  result: { status: 'passed' | 'failed' | 'skipped'; duration: number; error?: { message: string } }
): Promise<void> {
  if (playbackCache) {
    playbackCache.currentStepIndex = stepIndex;

    // Check if this is the last step
    if (stepIndex >= playbackCache.totalSteps - 1 && result.status !== 'failed') {
      playbackCache.state = 'completed';
    }

    await savePlaybackSession(playbackCache);
  }

  notifyPanels({
    type: 'PLAYBACK_STEP_COMPLETE',
    stepIndex,
    result,
  });

  // If completed, send completion notification
  if (playbackCache?.state === 'completed') {
    notifyPanels({ type: 'PLAYBACK_COMPLETED' } as Message);
  }
}

/**
 * Handle playback error from content script
 */
async function handlePlaybackError(error: string, stepIndex?: number): Promise<void> {
  if (playbackCache) {
    playbackCache.state = 'error';
    playbackCache.error = error;
    await savePlaybackSession(playbackCache);
  }

  notifyPanels({
    type: 'PLAYBACK_ERROR',
    error,
    stepIndex,
  });
}

/**
 * Get current playback state
 */
function getPlaybackState(): PlaybackStateMessage {
  return {
    type: 'PLAYBACK_STATE',
    state: playbackCache?.state ?? 'idle',
    currentStepIndex: playbackCache?.currentStepIndex ?? -1,
    totalSteps: playbackCache?.totalSteps ?? 0,
  };
}

// ============================================
// Baseline Functions
// ============================================

/**
 * Get all baselines
 */
async function handleGetBaselines(): Promise<ScenarioBaseline[]> {
  return await getBaselines();
}

/**
 * Save a new baseline
 */
async function handleSaveBaseline(baseline: ScenarioBaseline): Promise<void> {
  await saveBaseline(baseline);
}

/**
 * Delete a baseline
 */
async function handleDeleteBaseline(id: string): Promise<void> {
  await deleteBaseline(id);
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

    case 'API_CALL_CAPTURED': {
      handleApiCallCaptured(message.apiCall);
      sendResponse({ success: true });
      break;
    }

    case 'IDLE_DETECTED': {
      const idleMsg = message as IdleDetectedMessage;
      handleIdleDetected(idleMsg.idleStartedAt, idleMsg.idleDuration, idleMsg.lastEventType);
      sendResponse({ success: true });
      break;
    }

    case 'DOM_MUTATIONS_STABLE': {
      const domMsg = message as DomMutationsStableMessage;
      handleDomMutationsStable(domMsg.mutations);
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

    case 'GET_API_CALLS': {
      sendResponse(getApiCallsData());
      break;
    }

    case 'CAPTURE_SNAPSHOT': {
      // Forward to content script
      const captureTabId = messageTabId ?? sender.tab?.id ?? activeTabId;
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

    case 'SNAPSHOT_CAPTURED': {
      handleSnapshotCaptured(message.snapshot, message.label);
      sendResponse({ success: true });
      break;
    }

    case 'GET_SNAPSHOTS': {
      sendResponse(getSnapshotsData());
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

    // Playback messages
    case 'START_PLAYBACK': {
      const playTabId = messageTabId ?? sender.tab?.id ?? activeTabId;
      if (playTabId && message.scenario) {
        startPlayback(playTabId, message.scenario);
        sendResponse({ success: true });
      } else {
        sendResponse({ error: 'No tab ID or scenario' });
      }
      break;
    }

    case 'PAUSE_PLAYBACK': {
      pausePlayback();
      sendResponse({ success: true });
      break;
    }

    case 'RESUME_PLAYBACK': {
      resumePlayback();
      sendResponse({ success: true });
      break;
    }

    case 'STOP_PLAYBACK': {
      stopPlayback();
      sendResponse({ success: true });
      break;
    }

    case 'STEP_PLAYBACK': {
      stepPlayback();
      sendResponse({ success: true });
      break;
    }

    case 'GET_PLAYBACK_STATE': {
      sendResponse(getPlaybackState());
      break;
    }

    case 'PLAYBACK_STEP_START': {
      handlePlaybackStepStart(message.stepIndex, message.step);
      sendResponse({ success: true });
      break;
    }

    case 'PLAYBACK_STEP_COMPLETE': {
      handlePlaybackStepComplete(message.stepIndex, message.result);
      sendResponse({ success: true });
      break;
    }

    case 'PLAYBACK_ERROR': {
      handlePlaybackError(message.error, message.stepIndex);
      sendResponse({ success: true });
      break;
    }

    // Baseline messages
    case 'GET_BASELINES': {
      handleGetBaselines().then((baselines) => sendResponse({ baselines }));
      return true; // Keep channel open for async
    }

    case 'SAVE_BASELINE': {
      handleSaveBaseline(message.baseline).then(() => sendResponse({ success: true }));
      return true;
    }

    case 'DELETE_BASELINE': {
      handleDeleteBaseline(message.id).then(() => sendResponse({ success: true }));
      return true;
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
