import type { Scenario, Step } from '@like-cake/ast-types';
import type { Message, PlaybackStateMessage, StartPlaybackMessage } from '../../shared/messages';
import {
  createPlaybackSession,
  savePlaybackSession,
} from '../../shared/storage';
import {
  activeTabId,
  ensureContentScriptInjected,
  notifyPanels,
  playbackCache,
  setActiveTabId,
  setPlaybackCache,
} from '../state';

/**
 * Start playback of a scenario
 */
async function startPlayback(
  tabId: number,
  scenario: Scenario,
  baselineId?: string,
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
  const newPlayback = createPlaybackSession(scenario.id, totalSteps, baselineId);
  newPlayback.state = 'playing';
  newPlayback.startTime = Date.now();
  setPlaybackCache(newPlayback);
  setActiveTabId(tabId);

  await savePlaybackSession(newPlayback);

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
    newPlayback.state = 'error';
    newPlayback.error = error instanceof Error ? error.message : String(error);
    await savePlaybackSession(newPlayback);

    notifyPanels({
      type: 'PLAYBACK_ERROR',
      error: newPlayback.error,
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
  result: { status: 'passed' | 'failed' | 'skipped'; duration: number; error?: { message: string } },
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

// --- Message handlers ---

export function handleStartPlayback(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
  tabId?: number,
): boolean | void {
  const msg = message as StartPlaybackMessage;
  const playTabId = tabId ?? sender.tab?.id ?? activeTabId;
  if (playTabId && msg.scenario) {
    startPlayback(playTabId, msg.scenario);
    sendResponse({ success: true });
  } else if (msg.scenario) {
    // Fallback: query active tab (wizard mode without prior recording)
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        startPlayback(tab.id, msg.scenario);
        sendResponse({ success: true });
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
    return true;
  } else {
    sendResponse({ error: 'No tab ID or scenario' });
  }
}

export function handlePausePlayback(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  pausePlayback();
  sendResponse({ success: true });
}

export function handleResumePlayback(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  resumePlayback();
  sendResponse({ success: true });
}

export function handleStopPlayback(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  stopPlayback();
  sendResponse({ success: true });
}

export function handleStepPlayback(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  stepPlayback();
  sendResponse({ success: true });
}

export function handleGetPlaybackState(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  sendResponse(getPlaybackState());
}

export function handlePlaybackStepStartMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  const msg = message as { stepIndex: number; step: Step };
  handlePlaybackStepStart(msg.stepIndex, msg.step);
  sendResponse({ success: true });
}

export function handlePlaybackStepCompleteMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  const msg = message as {
    stepIndex: number;
    result: { status: 'passed' | 'failed' | 'skipped'; duration: number; error?: { message: string } };
  };
  handlePlaybackStepComplete(msg.stepIndex, msg.result);
  sendResponse({ success: true });
}

export function handlePlaybackErrorMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  const msg = message as { error: string; stepIndex?: number };
  handlePlaybackError(msg.error, msg.stepIndex);
  sendResponse({ success: true });
}
