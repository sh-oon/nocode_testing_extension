import type { EventHandler, NavigationEventData } from '../types';
import { generateEventId } from '../utils/helpers';

/**
 * Create a navigation event listener
 * Tracks URL changes via History API and popstate
 */
export function createNavigationListener(handler: EventHandler): {
  handlePushState: (url: string) => void;
  handleReplaceState: (url: string) => void;
  handlePopState: (event: PopStateEvent) => void;
} {
  let currentUrl = window.location.href;

  const emitNavigationEvent = (
    toUrl: string,
    navigationType: 'push' | 'replace' | 'pop' | 'reload'
  ) => {
    const fromUrl = currentUrl;
    currentUrl = toUrl;

    // Don't emit if URL didn't actually change
    if (fromUrl === toUrl) return;

    const rawEvent: NavigationEventData = {
      type: 'navigation',
      id: generateEventId(),
      timestamp: Date.now(),
      url: toUrl,
      toUrl,
      fromUrl,
      navigationType,
    };

    handler(rawEvent);
  };

  return {
    handlePushState: (url: string) => emitNavigationEvent(url, 'push'),
    handleReplaceState: (url: string) => emitNavigationEvent(url, 'replace'),
    handlePopState: (_event: PopStateEvent) => {
      emitNavigationEvent(window.location.href, 'pop');
    },
  };
}

/**
 * Attach navigation listener
 * Patches History API to intercept navigation
 */
export function attachNavigationListener(handler: EventHandler): () => void {
  const { handlePushState, handleReplaceState, handlePopState } = createNavigationListener(handler);

  // Store original methods
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  // Patch pushState
  history.pushState = (data: unknown, unused: string, url?: string | URL | null) => {
    const result = originalPushState(data, unused, url);
    if (url) {
      const newUrl = new URL(url.toString(), window.location.href).href;
      handlePushState(newUrl);
    }
    return result;
  };

  // Patch replaceState
  history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
    const result = originalReplaceState(data, unused, url);
    if (url) {
      const newUrl = new URL(url.toString(), window.location.href).href;
      handleReplaceState(newUrl);
    }
    return result;
  };

  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', handlePopState);

  // Return cleanup function
  return () => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', handlePopState);
  };
}

/**
 * Create a simple navigation event for initial page load
 */
export function createInitialNavigationEvent(): NavigationEventData {
  return {
    type: 'navigation',
    id: generateEventId(),
    timestamp: Date.now(),
    url: window.location.href,
    toUrl: window.location.href,
    navigationType: 'push',
  };
}
