/**
 * Navigation handler — detects SPA and regular page navigation
 * using chrome.webNavigation API instead of History API monkey-patching.
 */

import type { RawEvent } from '@like-cake/event-collector';

// === Types ===

type NavigationType = 'push' | 'replace' | 'pop' | 'load' | 'hash';

// === State ===

let targetTabId: number | null = null;
let onNavigationEvent: ((event: RawEvent) => void) | null = null;
let isListening = false;

// === Event Handlers ===

/** SPA navigation via pushState/replaceState */
const handleHistoryStateUpdated = (
  details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
): void => {
  if (details.tabId !== targetTabId || details.frameId !== 0) return;
  emitNavigationEvent(details.url, 'push', details.timeStamp);
};

/** Hash fragment change */
const handleReferenceFragmentUpdated = (
  details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
): void => {
  if (details.tabId !== targetTabId || details.frameId !== 0) return;
  emitNavigationEvent(details.url, 'hash', details.timeStamp);
};

/** Full page load completed */
const handleCompleted = (
  details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
): void => {
  if (details.tabId !== targetTabId || details.frameId !== 0) return;
  emitNavigationEvent(details.url, 'load', details.timeStamp);
};

// === Helpers ===

const emitNavigationEvent = (
  url: string,
  navigationType: NavigationType,
  timestamp: number,
): void => {
  if (!onNavigationEvent) return;

  // Skip chrome-internal URLs
  if (url.startsWith('chrome') || url.startsWith('about:') || url.startsWith('edge')) return;

  const event: RawEvent = {
    type: 'navigation',
    id: `nav-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    timestamp,
    url,
    toUrl: url,
    navigationType,
  } as RawEvent;

  onNavigationEvent(event);
};

// === Public API ===

/**
 * Register callback for navigation events.
 * Must be called before startListening.
 */
export const setOnNavigationEvent = (
  callback: (event: RawEvent) => void,
): void => {
  onNavigationEvent = callback;
};

/**
 * Start listening for navigation events on a specific tab.
 */
export const startListening = (tabId: number): void => {
  if (isListening) {
    stopListening();
  }

  targetTabId = tabId;
  isListening = true;

  chrome.webNavigation.onHistoryStateUpdated.addListener(handleHistoryStateUpdated);
  chrome.webNavigation.onReferenceFragmentUpdated.addListener(handleReferenceFragmentUpdated);
  chrome.webNavigation.onCompleted.addListener(handleCompleted);

  console.log(`[Like Cake] Navigation listening started for tab ${tabId}`);
};

/**
 * Stop listening for navigation events.
 */
export const stopListening = (): void => {
  if (!isListening) return;

  chrome.webNavigation.onHistoryStateUpdated.removeListener(handleHistoryStateUpdated);
  chrome.webNavigation.onReferenceFragmentUpdated.removeListener(handleReferenceFragmentUpdated);
  chrome.webNavigation.onCompleted.removeListener(handleCompleted);

  targetTabId = null;
  isListening = false;

  console.log('[Like Cake] Navigation listening stopped');
};
