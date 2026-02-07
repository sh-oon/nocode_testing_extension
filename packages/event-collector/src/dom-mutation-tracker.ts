/**
 * DOM Mutation Tracker
 *
 * Monitors DOM changes during recording idle periods (e.g., after a user
 * clicks "Create folder" and a new folder item appears). Detected changes
 * are reported via the `onStable` callback so they can be transformed into
 * `assertElement` steps.
 */

/** Tags that should never be tracked */
const IGNORED_TAGS = new Set([
  'script',
  'style',
  'link',
  'meta',
  'noscript',
]);

/** Maximum mutations reported per stable period */
const MAX_MUTATIONS_PER_REPORT = 3;

/** Default stability threshold in milliseconds */
const DEFAULT_STABILITY_THRESHOLD = 1500;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Configuration for the DomMutationTracker
 */
export interface DomMutationTrackerConfig {
  /** Time after last mutation to consider DOM stable (ms). Default: 1500 */
  stabilityThreshold: number;
  /** Selectors to ignore */
  ignoreSelectors: string[];
  /** Called when DOM stabilizes after mutations */
  onStable: (mutations: TrackedMutation[]) => void;
}

/**
 * A single tracked mutation
 */
export interface TrackedMutation {
  /** Mutation type */
  type: 'added' | 'textChanged';
  /** CSS selector for the element */
  selector: string;
  /** Text content (for added elements with text, or changed text) */
  textContent?: string;
  /** Element tag name */
  tagName: string;
}

// ---------------------------------------------------------------------------
// Selector helper
// ---------------------------------------------------------------------------

/**
 * Generate a CSS selector for an element.
 *
 * Priority: data-testid > role+aria-label > role > id > tag+classes > tag
 */
export function generateSelector(el: HTMLElement): string {
  // 1. data-testid
  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  // 2. role + accessible name
  const role = el.getAttribute('role');
  const ariaLabel = el.getAttribute('aria-label');
  if (role && ariaLabel) return `[role="${role}"][aria-label="${ariaLabel}"]`;
  if (role) return `[role="${role}"]`;

  // 3. id
  if (el.id) return `#${el.id}`;

  // 4. tag + distinctive classes (filter out internal classes)
  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .filter((c) => !c.startsWith('like-cake'))
    .slice(0, 2);
  if (classes.length > 0) return `${tag}.${classes.join('.')}`;

  return tag;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a node is a trackable HTMLElement (not script/style/etc.)
 */
function isTrackableElement(node: Node): node is HTMLElement {
  if (!(node instanceof HTMLElement)) return false;
  return !IGNORED_TAGS.has(node.tagName.toLowerCase());
}

/**
 * Check whether an element matches any of the ignore selectors
 * (always includes `[data-like-cake-ignore]`).
 */
function matchesIgnore(el: HTMLElement, selectors: string[]): boolean {
  for (const sel of selectors) {
    try {
      if (el.matches(sel)) return true;
    } catch {
      // Invalid selector -- skip
    }
  }
  try {
    if (el.matches('[data-like-cake-ignore]')) return true;
  } catch {
    // noop
  }
  return false;
}

/**
 * Check if the element is still attached to the DOM and has non-zero dimensions.
 */
function isVisibleInDom(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  return rect.width >= 1 && rect.height >= 1;
}

/**
 * Calculate a significance score for sorting mutations.
 *
 * Higher is more significant:
 *   - Elements with meaningful text content score higher.
 *   - Elements nearer the viewport center score higher.
 */
function significanceScore(el: HTMLElement): number {
  let score = 0;

  // Text boosts significance
  const text = el.textContent?.trim();
  if (text && text.length > 0) {
    score += 100;
  }

  // Proximity to viewport center boosts significance
  try {
    const rect = el.getBoundingClientRect();
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = window.innerHeight / 2;
    const elCenterX = rect.left + rect.width / 2;
    const elCenterY = rect.top + rect.height / 2;
    const distance = Math.sqrt(
      (elCenterX - viewportCenterX) ** 2 + (elCenterY - viewportCenterY) ** 2,
    );
    // Normalise: closer to center -> higher score (max 50)
    const maxDist = Math.sqrt(viewportCenterX ** 2 + viewportCenterY ** 2);
    if (maxDist > 0) {
      score += Math.max(0, 50 * (1 - distance / maxDist));
    }
  } catch {
    // getBoundingClientRect might not be meaningful in test environment
  }

  return score;
}

// ---------------------------------------------------------------------------
// Internal buffered mutation entry
// ---------------------------------------------------------------------------

interface BufferedMutation {
  type: 'added' | 'textChanged';
  element: HTMLElement;
}

// ---------------------------------------------------------------------------
// DomMutationTracker class
// ---------------------------------------------------------------------------

/**
 * Watches for DOM mutations and reports significant changes after a
 * configurable stability period (no new mutations for N ms).
 *
 * Usage:
 * ```ts
 * const tracker = new DomMutationTracker({
 *   stabilityThreshold: 1500,
 *   ignoreSelectors: ['.loading-spinner'],
 *   onStable: (mutations) => {
 *     for (const m of mutations) console.log(m.type, m.selector);
 *   },
 * });
 * tracker.start();
 * // ... user interactions happen, DOM changes are observed ...
 * tracker.stop();
 * ```
 */
export class DomMutationTracker {
  private config: DomMutationTrackerConfig;
  private observer: MutationObserver | null = null;
  private buffer: BufferedMutation[] = [];
  private stabilityTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    config: Partial<DomMutationTrackerConfig> & Pick<DomMutationTrackerConfig, 'onStable'>,
  ) {
    this.config = {
      stabilityThreshold: config.stabilityThreshold ?? DEFAULT_STABILITY_THRESHOLD,
      ignoreSelectors: config.ignoreSelectors ?? [],
      onStable: config.onStable,
    };
  }

  /**
   * Start observing mutations on `document.body`.
   */
  start(): void {
    if (this.observer) return;

    this.observer = new MutationObserver((records) => {
      this.handleMutations(records);
    });

    this.observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  /**
   * Stop observing and clear all internal state and timers.
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.clearStabilityTimer();
    this.buffer = [];
  }

  /**
   * Clear accumulated mutations buffer without stopping observation.
   * Call this after navigation events to avoid stale data.
   */
  reset(): void {
    this.buffer = [];
    this.clearStabilityTimer();
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private handleMutations(records: MutationRecord[]): void {
    for (const record of records) {
      if (record.type === 'childList') {
        for (const node of Array.from(record.addedNodes)) {
          if (isTrackableElement(node)) {
            this.buffer.push({ type: 'added', element: node });
          }
        }
      } else if (record.type === 'characterData') {
        const target = record.target.parentElement;
        if (target && isTrackableElement(target)) {
          this.buffer.push({ type: 'textChanged', element: target });
        }
      }
    }

    if (this.buffer.length > 0) {
      this.resetStabilityTimer();
    }
  }

  private resetStabilityTimer(): void {
    this.clearStabilityTimer();
    this.stabilityTimer = setTimeout(() => {
      this.onStabilityReached();
    }, this.config.stabilityThreshold);
  }

  private clearStabilityTimer(): void {
    if (this.stabilityTimer !== null) {
      clearTimeout(this.stabilityTimer);
      this.stabilityTimer = null;
    }
  }

  private onStabilityReached(): void {
    this.stabilityTimer = null;

    const { ignoreSelectors } = this.config;

    // Deduplicate by element reference
    const seen = new Set<HTMLElement>();
    const filtered: BufferedMutation[] = [];

    for (const entry of this.buffer) {
      const { element } = entry;

      // Skip duplicates
      if (seen.has(element)) continue;
      seen.add(element);

      // Skip ignored selectors
      if (matchesIgnore(element, ignoreSelectors)) continue;

      // Skip elements no longer in the DOM (e.g., loading spinners)
      if (!isVisibleInDom(element)) continue;

      filtered.push(entry);
    }

    // Clear the buffer now that we have processed it
    this.buffer = [];

    if (filtered.length === 0) return;

    // Sort by significance (text > viewport proximity > others)
    filtered.sort(
      (a, b) => significanceScore(b.element) - significanceScore(a.element),
    );

    // Limit to max mutations
    const top = filtered.slice(0, MAX_MUTATIONS_PER_REPORT);

    // Convert to TrackedMutation
    const tracked: TrackedMutation[] = top.map((entry) => {
      const text = entry.element.textContent?.trim();
      return {
        type: entry.type,
        selector: generateSelector(entry.element),
        textContent: text && text.length > 0 ? text : undefined,
        tagName: entry.element.tagName.toLowerCase(),
      };
    });

    this.config.onStable(tracked);
  }
}

/**
 * Create a new DomMutationTracker instance
 */
export function createDomMutationTracker(
  config: Partial<DomMutationTrackerConfig> & Pick<DomMutationTrackerConfig, 'onStable'>,
): DomMutationTracker {
  return new DomMutationTracker(config);
}
