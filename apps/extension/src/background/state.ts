import type { TrackedMutation } from '@like-cake/event-collector';
import type { Message } from '../shared/messages';
import {
  getCurrentSession,
  getPlaybackSession,
  type PlaybackSession,
  type RecordingSession,
  saveCurrentSession,
  savePlaybackSession,
} from '../shared/storage';

/**
 * Shared state for the service worker.
 * All handler modules read/write through this singleton.
 */

// Track active recording tab
export let activeTabId: number | null = null;
export let sessionCache: RecordingSession | null = null;

// Playback state
export let playbackCache: PlaybackSession | null = null;

// Auto-assertion: pending DOM mutations buffer
export let pendingDomMutations: TrackedMutation[] = [];

// --- State setters (needed because `let` exports are read-only to consumers) ---

export function setActiveTabId(id: number | null): void {
  activeTabId = id;
}

export function setSessionCache(session: RecordingSession | null): void {
  sessionCache = session;
}

export function setPlaybackCache(session: PlaybackSession | null): void {
  playbackCache = session;
}

export function setPendingDomMutations(mutations: TrackedMutation[]): void {
  pendingDomMutations = mutations;
}

/**
 * Initialize caches from storage on service worker start.
 */
export async function initializeCache(): Promise<void> {
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

/**
 * Ensure content script is injected into the tab.
 * Returns true if ready, false if page needs refresh.
 */
export async function ensureContentScriptInjected(tabId: number): Promise<boolean> {
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
 * Notify all DevTools panels.
 */
export function notifyPanels(message: Message): void {
  chrome.runtime.sendMessage(message).catch(() => {
    // No panels listening
  });
}
