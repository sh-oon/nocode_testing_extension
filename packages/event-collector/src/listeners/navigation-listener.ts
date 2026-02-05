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
 *
 * Note: In Chrome extensions, content scripts run in an "isolated world".
 * To intercept History API calls from the main page (where SPA routers run),
 * we inject a script into the main world that sends custom events.
 */
export function attachNavigationListener(handler: EventHandler): () => void {
  const { handlePushState, handleReplaceState, handlePopState } = createNavigationListener(handler);

  // Check if we're in an extension context (isolated world)
  const isExtensionContext =
    typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;

  // Store original methods (for non-extension contexts)
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  // Handle custom navigation events from main world injection
  const handleMainWorldNavigation = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (!detail?.url) return;

    if (detail.type === 'pushState') {
      handlePushState(detail.url);
    } else if (detail.type === 'replaceState') {
      handleReplaceState(detail.url);
    }
  };

  // Listen for custom events (from main world script)
  window.addEventListener('__like_cake_navigation__', handleMainWorldNavigation);

  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', handlePopState);

  // Listen for hashchange (hash-based routing)
  const handleHashChange = () => {
    handlePushState(window.location.href);
  };
  window.addEventListener('hashchange', handleHashChange);

  // Inject main world script for History API patching (only in extension context)
  let injectedScript: HTMLScriptElement | null = null;
  if (isExtensionContext) {
    injectedScript = injectMainWorldScript();
  } else {
    // In non-extension context, patch directly
    history.pushState = (data: unknown, unused: string, url?: string | URL | null) => {
      const result = originalPushState(data, unused, url);
      if (url) {
        const newUrl = new URL(url.toString(), window.location.href).href;
        handlePushState(newUrl);
      }
      return result;
    };

    history.replaceState = (data: unknown, unused: string, url?: string | URL | null) => {
      const result = originalReplaceState(data, unused, url);
      if (url) {
        const newUrl = new URL(url.toString(), window.location.href).href;
        handleReplaceState(newUrl);
      }
      return result;
    };
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('__like_cake_navigation__', handleMainWorldNavigation);
    window.removeEventListener('popstate', handlePopState);
    window.removeEventListener('hashchange', handleHashChange);

    if (injectedScript && injectedScript.parentNode) {
      injectedScript.parentNode.removeChild(injectedScript);
    }

    if (!isExtensionContext) {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    }
  };
}

/**
 * Inject a script into the main world to patch History API
 * This is necessary for Chrome extensions where content scripts run in isolated world
 */
function injectMainWorldScript(): HTMLScriptElement {
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      // Prevent double injection
      if (window.__like_cake_nav_injected__) return;
      window.__like_cake_nav_injected__ = true;

      const originalPushState = history.pushState.bind(history);
      const originalReplaceState = history.replaceState.bind(history);

      const dispatchNavEvent = (type, url) => {
        window.dispatchEvent(new CustomEvent('__like_cake_navigation__', {
          detail: { type, url }
        }));
      };

      history.pushState = function(data, unused, url) {
        const result = originalPushState(data, unused, url);
        if (url) {
          try {
            const newUrl = new URL(url.toString(), window.location.href).href;
            dispatchNavEvent('pushState', newUrl);
          } catch (e) {}
        }
        return result;
      };

      history.replaceState = function(data, unused, url) {
        const result = originalReplaceState(data, unused, url);
        if (url) {
          try {
            const newUrl = new URL(url.toString(), window.location.href).href;
            dispatchNavEvent('replaceState', newUrl);
          } catch (e) {}
        }
        return result;
      };

      console.log('[Like Cake] Navigation listener injected into main world');
    })();
  `;

  // Insert at document start
  (document.head || document.documentElement).appendChild(script);
  return script;
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
