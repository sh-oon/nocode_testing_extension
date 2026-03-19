/**
 * Playwright-style actionability checks for elements.
 *
 * Each check is a pure synchronous function that runs in the browser context.
 * The polling wrapper (rAF-based) is handled by the adapter layer.
 */

/**
 * Which checks to perform for a given action
 */
export interface ActionabilityChecks {
  attached: boolean;
  visible: boolean;
  enabled: boolean;
  stable: boolean;
  receivesEvents: boolean;
  editable: boolean;
}

/**
 * Describes why an actionability check failed
 */
export interface ActionabilityFailure {
  check: keyof ActionabilityChecks;
  message: string;
}

/**
 * Result of a single-frame actionability check
 */
export interface ActionabilityResult {
  passed: boolean;
  failure?: ActionabilityFailure;
  boundingRect?: { x: number; y: number; width: number; height: number };
}

type ActionType = 'click' | 'hover' | 'type' | 'select';

/**
 * Checks required per action type (Playwright convention)
 *
 * | check          | click | hover | type | select |
 * |----------------|:-----:|:-----:|:----:|:------:|
 * | attached       |   ✓   |   ✓   |  ✓   |   ✓    |
 * | visible        |   ✓   |   ✓   |  ✓   |   ✓    |
 * | enabled        |   ✓   |       |  ✓   |   ✓    |
 * | stable         |   ✓   |   ✓   |      |        |
 * | receivesEvents |   ✓   |   ✓   |      |        |
 * | editable       |       |       |  ✓   |        |
 */
export const ACTION_CHECKS: Record<ActionType, ActionabilityChecks> = {
  click: {
    attached: true,
    visible: true,
    enabled: true,
    stable: true,
    receivesEvents: true,
    editable: false,
  },
  hover: {
    attached: true,
    visible: true,
    enabled: false,
    stable: true,
    receivesEvents: true,
    editable: false,
  },
  type: {
    attached: true,
    visible: true,
    enabled: true,
    stable: false,
    receivesEvents: false,
    editable: true,
  },
  select: {
    attached: true,
    visible: true,
    enabled: true,
    stable: false,
    receivesEvents: false,
    editable: false,
  },
};

/**
 * Describes an element that obscures the target (for error messages)
 */
function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls =
    el.className && typeof el.className === 'string'
      ? `.${el.className.trim().split(/\s+/).join('.')}`
      : '';
  return `<${tag}${id}${cls}>`;
}

/**
 * Single-frame actionability check.
 *
 * Runs synchronously in the browser context. The `stable` check is NOT
 * handled here — it requires comparing bounding rects across 2 rAF frames,
 * so the caller (polling wrapper) manages that state.
 */
export function checkActionability(
  element: Element,
  checks: ActionabilityChecks
): ActionabilityResult {
  // ── attached ──
  if (checks.attached && !element.isConnected) {
    return {
      passed: false,
      failure: { check: 'attached', message: 'Element is detached from the DOM' },
    };
  }

  // ── visible ──
  if (checks.visible) {
    if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) {
      return {
        passed: false,
        failure: { check: 'visible', message: 'Element is not an HTML or SVG element' },
      };
    }

    const style = window.getComputedStyle(element);

    if (style.display === 'none') {
      return {
        passed: false,
        failure: { check: 'visible', message: 'Element has display:none' },
      };
    }
    if (style.visibility === 'hidden') {
      return {
        passed: false,
        failure: { check: 'visible', message: 'Element has visibility:hidden' },
      };
    }
    if (style.opacity === '0') {
      return {
        passed: false,
        failure: { check: 'visible', message: 'Element has opacity:0' },
      };
    }

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      return {
        passed: false,
        failure: { check: 'visible', message: 'Element has zero size' },
      };
    }
  }

  // ── enabled ──
  if (checks.enabled) {
    const htmlEl = element as HTMLElement;

    // Check disabled property (button, input, select, textarea)
    if ('disabled' in htmlEl && (htmlEl as HTMLButtonElement).disabled) {
      return {
        passed: false,
        failure: { check: 'enabled', message: 'Element is disabled' },
      };
    }

    // Check aria-disabled
    if (element.getAttribute('aria-disabled') === 'true') {
      return {
        passed: false,
        failure: { check: 'enabled', message: 'Element has aria-disabled="true"' },
      };
    }

    // Check if inside a disabled fieldset
    const fieldset = element.closest('fieldset:disabled');
    if (fieldset) {
      // Elements inside <legend> of a disabled fieldset are NOT disabled
      const legend = fieldset.querySelector('legend');
      const isInsideLegend = legend?.contains(element) ?? false;
      if (!isInsideLegend) {
        return {
          passed: false,
          failure: { check: 'enabled', message: 'Element is inside a disabled fieldset' },
        };
      }
    }
  }

  // ── receivesEvents (hit test) ──
  if (checks.receivesEvents) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const hitEl = document.elementFromPoint(centerX, centerY);

    if (hitEl && hitEl !== element && !element.contains(hitEl)) {
      return {
        passed: false,
        failure: {
          check: 'receivesEvents',
          message: `Element is obscured by ${describeElement(hitEl)}`,
        },
      };
    }
  }

  // ── editable ──
  if (checks.editable) {
    const htmlEl = element as HTMLInputElement | HTMLTextAreaElement;
    const isInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;

    if (isInput && htmlEl.readOnly) {
      return {
        passed: false,
        failure: { check: 'editable', message: 'Element is readonly' },
      };
    }

    if (element.getAttribute('aria-readonly') === 'true') {
      return {
        passed: false,
        failure: { check: 'editable', message: 'Element has aria-readonly="true"' },
      };
    }

    // contentEditable elements are always editable (unless readonly is set above)
    const isContentEditable =
      (element instanceof HTMLElement && element.isContentEditable) ||
      element.getAttribute('contenteditable') === 'true';
    if (!isInput && !isContentEditable) {
      return {
        passed: false,
        failure: { check: 'editable', message: 'Element is not an editable field' },
      };
    }
  }

  // ── compute bounding rect for stability comparison ──
  const rect = element.getBoundingClientRect();
  const boundingRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };

  return { passed: true, boundingRect };
}

/**
 * Serializable polling function for PuppeteerAdapter's page.evaluate().
 *
 * Arguments: (selectorStr: string, checksJSON: string, timeoutMs: number)
 * Returns: void (throws on failure)
 *
 * This string contains an inlined version of the check logic because
 * page.evaluate cannot reference closures from the Node.js context.
 */
export const ACTIONABILITY_POLL_FN = `(function(selectorStr, checksJSON, timeoutMs) {
  var checks = JSON.parse(checksJSON);

  function describeElement(el) {
    var tag = el.tagName.toLowerCase();
    var id = el.id ? '#' + el.id : '';
    var cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.trim().split(/\\s+/).join('.') : '';
    return '<' + tag + id + cls + '>';
  }

  function findElement(sel) {
    if (sel.startsWith('xpath/')) {
      var xpath = sel.slice(6);
      var result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    }
    return document.querySelector(sel);
  }

  function runChecks(element) {
    if (checks.attached && !element.isConnected) {
      return { passed: false, failure: { check: 'attached', message: 'Element is detached from the DOM' } };
    }

    if (checks.visible) {
      var style = window.getComputedStyle(element);
      if (style.display === 'none') return { passed: false, failure: { check: 'visible', message: 'Element has display:none' } };
      if (style.visibility === 'hidden') return { passed: false, failure: { check: 'visible', message: 'Element has visibility:hidden' } };
      if (style.opacity === '0') return { passed: false, failure: { check: 'visible', message: 'Element has opacity:0' } };
      var rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return { passed: false, failure: { check: 'visible', message: 'Element has zero size' } };
    }

    if (checks.enabled) {
      if ('disabled' in element && element.disabled) return { passed: false, failure: { check: 'enabled', message: 'Element is disabled' } };
      if (element.getAttribute('aria-disabled') === 'true') return { passed: false, failure: { check: 'enabled', message: 'Element has aria-disabled="true"' } };
      var fieldset = element.closest('fieldset:disabled');
      if (fieldset) {
        var legend = fieldset.querySelector('legend');
        var isInsideLegend = legend ? legend.contains(element) : false;
        if (!isInsideLegend) return { passed: false, failure: { check: 'enabled', message: 'Element is inside a disabled fieldset' } };
      }
    }

    if (checks.receivesEvents) {
      var r = element.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var hitEl = document.elementFromPoint(cx, cy);
      if (hitEl && hitEl !== element && !element.contains(hitEl)) {
        return { passed: false, failure: { check: 'receivesEvents', message: 'Element is obscured by ' + describeElement(hitEl) } };
      }
    }

    if (checks.editable) {
      var isInput = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
      if (isInput && element.readOnly) return { passed: false, failure: { check: 'editable', message: 'Element is readonly' } };
      if (element.getAttribute('aria-readonly') === 'true') return { passed: false, failure: { check: 'editable', message: 'Element has aria-readonly="true"' } };
      var isContentEditable = (element instanceof HTMLElement && element.isContentEditable) || element.getAttribute('contenteditable') === 'true';
      if (!isInput && !isContentEditable) {
        return { passed: false, failure: { check: 'editable', message: 'Element is not an editable field' } };
      }
    }

    var br = element.getBoundingClientRect();
    return { passed: true, boundingRect: { x: br.x, y: br.y, width: br.width, height: br.height } };
  }

  return new Promise(function(resolve, reject) {
    var startTime = Date.now();
    var prevRect = null;

    function poll() {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error('Actionability timeout after ' + timeoutMs + 'ms: ' + (lastFailure || 'element not found')));
        return;
      }

      var element = findElement(selectorStr);
      if (!element) {
        lastFailure = 'Element not found';
        requestAnimationFrame(poll);
        return;
      }

      var result = runChecks(element);
      if (!result.passed) {
        lastFailure = result.failure.message;
        prevRect = null;
        requestAnimationFrame(poll);
        return;
      }

      if (checks.stable) {
        var curRect = result.boundingRect;
        if (!prevRect ||
            prevRect.x !== curRect.x || prevRect.y !== curRect.y ||
            prevRect.width !== curRect.width || prevRect.height !== curRect.height) {
          prevRect = curRect;
          lastFailure = 'Element position is not stable';
          requestAnimationFrame(poll);
          return;
        }
      }

      resolve();
    }

    var lastFailure = null;
    requestAnimationFrame(poll);
  });
})`;
