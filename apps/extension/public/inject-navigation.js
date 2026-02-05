/**
 * Navigation interceptor - injected into main world
 * This script patches History API to capture SPA navigation
 */
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
      } catch (e) {
        // URL parsing failed
      }
    }
    return result;
  };

  history.replaceState = function(data, unused, url) {
    const result = originalReplaceState(data, unused, url);
    if (url) {
      try {
        const newUrl = new URL(url.toString(), window.location.href).href;
        dispatchNavEvent('replaceState', newUrl);
      } catch (e) {
        // URL parsing failed
      }
    }
    return result;
  };

  // Also listen for popstate
  window.addEventListener('popstate', function() {
    dispatchNavEvent('popState', window.location.href);
  });

  // Also listen for hashchange
  window.addEventListener('hashchange', function() {
    dispatchNavEvent('hashChange', window.location.href);
  });

  console.log('[Like Cake] Navigation listener injected into main world');
})();
