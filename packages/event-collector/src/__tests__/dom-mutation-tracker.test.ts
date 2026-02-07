// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrackedMutation } from '../dom-mutation-tracker';
import { DomMutationTracker, generateSelector } from '../dom-mutation-tracker';

/**
 * Helper: create an HTMLElement and give it a non-zero bounding rect so the
 * tracker considers it visible.
 */
function createVisibleElement(
  tag: string,
  attrs: Record<string, string> = {},
  textContent?: string,
): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
  if (textContent) {
    el.textContent = textContent;
  }
  // jsdom returns 0x0 from getBoundingClientRect by default.
  // Stub it to simulate a visible element.
  el.getBoundingClientRect = () => ({
    x: 100,
    y: 100,
    width: 200,
    height: 40,
    top: 100,
    right: 300,
    bottom: 140,
    left: 100,
    toJSON: () => ({}),
  });
  return el;
}

/**
 * Flush pending MutationObserver microtasks and advance timers.
 *
 * jsdom delivers MutationObserver records via microtasks. We need to:
 * 1. Yield to let microtasks (MO callbacks) execute
 * 2. Then advance fake timers by the desired amount
 *
 * Using `await Promise.resolve()` flushes microtasks without touching
 * the fake timer system.
 */
async function flush(): Promise<void> {
  // Multiple yields to ensure all queued microtasks resolve
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('DomMutationTracker', () => {
  let onStable: ReturnType<typeof vi.fn<(mutations: TrackedMutation[]) => void>>;
  let tracker: DomMutationTracker;

  beforeEach(() => {
    vi.useFakeTimers();
    onStable = vi.fn();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    tracker?.stop();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  // -------------------------------------------------------------------------
  // Basic tracking
  // -------------------------------------------------------------------------

  it('should track a new visible element added to the DOM', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    const el = createVisibleElement('div', { 'data-testid': 'folder-item' }, 'My Folder');
    document.body.appendChild(el);

    await flush();
    vi.advanceTimersByTime(500);

    expect(onStable).toHaveBeenCalledTimes(1);
    const mutations = onStable.mock.calls[0][0];
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({
      type: 'added',
      selector: '[data-testid="folder-item"]',
      textContent: 'My Folder',
      tagName: 'div',
    });
  });

  // -------------------------------------------------------------------------
  // Ignored elements
  // -------------------------------------------------------------------------

  it('should ignore script elements', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    const script = document.createElement('script');
    script.textContent = 'console.log("hello")';
    document.body.appendChild(script);

    await flush();
    vi.advanceTimersByTime(500);

    expect(onStable).not.toHaveBeenCalled();
  });

  it('should ignore style elements', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    const style = document.createElement('style');
    style.textContent = 'body { color: red; }';
    document.body.appendChild(style);

    await flush();
    vi.advanceTimersByTime(500);

    expect(onStable).not.toHaveBeenCalled();
  });

  it('should ignore elements matching ignoreSelectors', async () => {
    tracker = new DomMutationTracker({
      onStable,
      stabilityThreshold: 500,
      ignoreSelectors: ['.loading-spinner'],
    });
    tracker.start();

    const spinner = createVisibleElement('div', { class: 'loading-spinner' }, 'Loading...');
    document.body.appendChild(spinner);

    await flush();
    vi.advanceTimersByTime(500);

    expect(onStable).not.toHaveBeenCalled();
  });

  it('should ignore elements with data-like-cake-ignore attribute', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    const el = createVisibleElement('div', { 'data-like-cake-ignore': '' }, 'Ignore me');
    document.body.appendChild(el);

    await flush();
    vi.advanceTimersByTime(500);

    expect(onStable).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Element removed before stability
  // -------------------------------------------------------------------------

  it('should ignore elements removed from DOM before stability is reached', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    const el = createVisibleElement('div', {}, 'Temporary');
    document.body.appendChild(el);
    await flush();

    // Remove the element before stability threshold
    document.body.removeChild(el);
    await flush();

    vi.advanceTimersByTime(500);

    // The element is no longer connected -- onStable should either not fire
    // or not include the removed element.
    if (onStable.mock.calls.length > 0) {
      const mutations = onStable.mock.calls[0][0] as TrackedMutation[];
      const found = mutations.find((m) => m.textContent === 'Temporary');
      expect(found).toBeUndefined();
    }
  });

  // -------------------------------------------------------------------------
  // Text content changed
  // -------------------------------------------------------------------------

  it('should track text content changes as textChanged', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });

    const el = createVisibleElement('span', { 'data-testid': 'counter' }, '0');
    document.body.appendChild(el);

    tracker.start();

    // Mutate the text node directly to trigger a characterData mutation
    el.firstChild!.textContent = '42';
    await flush();

    vi.advanceTimersByTime(500);

    expect(onStable).toHaveBeenCalledTimes(1);
    const mutations = onStable.mock.calls[0][0];
    expect(mutations).toHaveLength(1);
    expect(mutations[0]).toMatchObject({
      type: 'textChanged',
      selector: '[data-testid="counter"]',
      textContent: '42',
      tagName: 'span',
    });
  });

  // -------------------------------------------------------------------------
  // Stability threshold behaviour
  // -------------------------------------------------------------------------

  it('should reset the stability timer when new mutations arrive', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    // First mutation
    const el1 = createVisibleElement('div', { 'data-testid': 'item-1' }, 'Item 1');
    document.body.appendChild(el1);
    await flush();

    // Advance partway (300ms) -- not yet at threshold
    vi.advanceTimersByTime(300);
    expect(onStable).not.toHaveBeenCalled();

    // Second mutation resets the timer
    const el2 = createVisibleElement('div', { 'data-testid': 'item-2' }, 'Item 2');
    document.body.appendChild(el2);
    await flush();

    // Advance another 300ms (total 600ms from first, 300ms from second)
    vi.advanceTimersByTime(300);
    expect(onStable).not.toHaveBeenCalled();

    // Advance remaining 200ms to hit threshold from the second mutation
    vi.advanceTimersByTime(200);
    expect(onStable).toHaveBeenCalledTimes(1);

    // Both mutations should be reported together
    const mutations = onStable.mock.calls[0][0];
    expect(mutations).toHaveLength(2);
  });

  it('should use default stabilityThreshold of 1500ms when not configured', async () => {
    tracker = new DomMutationTracker({ onStable });
    tracker.start();

    const el = createVisibleElement('div', { 'data-testid': 'item' }, 'Hello');
    document.body.appendChild(el);
    await flush();

    vi.advanceTimersByTime(1499);
    expect(onStable).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onStable).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Max 3 mutations per stable period
  // -------------------------------------------------------------------------

  it('should limit to max 3 mutations per stable period', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    // Add 5 visible elements
    for (let i = 0; i < 5; i++) {
      const el = createVisibleElement('div', { 'data-testid': `item-${i}` }, `Item ${i}`);
      document.body.appendChild(el);
    }

    await flush();
    vi.advanceTimersByTime(500);

    expect(onStable).toHaveBeenCalledTimes(1);
    const mutations = onStable.mock.calls[0][0];
    expect(mutations).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // reset() clears buffer
  // -------------------------------------------------------------------------

  it('should clear the mutation buffer when reset() is called', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    const el = createVisibleElement('div', { 'data-testid': 'item' }, 'Hello');
    document.body.appendChild(el);
    await flush();

    // Reset before stability is reached
    tracker.reset();

    vi.advanceTimersByTime(500);
    expect(onStable).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // stop() disconnects observer
  // -------------------------------------------------------------------------

  it('should not track mutations after stop() is called', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();
    tracker.stop();

    const el = createVisibleElement('div', { 'data-testid': 'item' }, 'After stop');
    document.body.appendChild(el);

    await flush();
    vi.advanceTimersByTime(500);

    expect(onStable).not.toHaveBeenCalled();
  });

  it('should clear pending timers when stop() is called', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    const el = createVisibleElement('div', { 'data-testid': 'item' }, 'Hello');
    document.body.appendChild(el);
    await flush();

    // Stop before stability threshold
    tracker.stop();
    vi.advanceTimersByTime(500);

    expect(onStable).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Selector generation
  // -------------------------------------------------------------------------

  describe('generateSelector', () => {
    it('should prefer data-testid over other attributes', () => {
      const el = document.createElement('div');
      el.setAttribute('data-testid', 'my-button');
      el.setAttribute('role', 'button');
      el.id = 'btn-1';

      expect(generateSelector(el)).toBe('[data-testid="my-button"]');
    });

    it('should use role + aria-label when no data-testid', () => {
      const el = document.createElement('button');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Close dialog');

      expect(generateSelector(el)).toBe('[role="button"][aria-label="Close dialog"]');
    });

    it('should use role alone when aria-label is missing', () => {
      const el = document.createElement('div');
      el.setAttribute('role', 'navigation');

      expect(generateSelector(el)).toBe('[role="navigation"]');
    });

    it('should use id when no role or testid', () => {
      const el = document.createElement('div');
      el.id = 'sidebar';

      expect(generateSelector(el)).toBe('#sidebar');
    });

    it('should use tag + classes when no other distinguishing attribute', () => {
      const el = document.createElement('div');
      el.classList.add('card', 'primary');

      expect(generateSelector(el)).toBe('div.card.primary');
    });

    it('should filter out classes starting with like-cake', () => {
      const el = document.createElement('div');
      el.classList.add('like-cake-internal', 'card');

      expect(generateSelector(el)).toBe('div.card');
    });

    it('should limit to 2 classes', () => {
      const el = document.createElement('div');
      el.classList.add('a', 'b', 'c', 'd');

      expect(generateSelector(el)).toBe('div.a.b');
    });

    it('should fall back to tag name when no attributes', () => {
      const el = document.createElement('section');

      expect(generateSelector(el)).toBe('section');
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('should not fire onStable when no mutations occurred', () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    vi.advanceTimersByTime(2000);
    expect(onStable).not.toHaveBeenCalled();
  });

  it('should deduplicate mutations for the same element', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    const el = createVisibleElement('div', { 'data-testid': 'item' }, 'Hello');
    document.body.appendChild(el);
    await flush();

    // Trigger another mutation on same element (text change)
    el.firstChild!.textContent = 'Updated';
    await flush();

    vi.advanceTimersByTime(500);

    expect(onStable).toHaveBeenCalledTimes(1);
    // Only one entry for this element (deduplication)
    const mutations = onStable.mock.calls[0][0];
    expect(mutations).toHaveLength(1);
  });

  it('should handle multiple stable periods independently', async () => {
    tracker = new DomMutationTracker({ onStable, stabilityThreshold: 500 });
    tracker.start();

    // First stable period
    const el1 = createVisibleElement('div', { 'data-testid': 'first' }, 'First');
    document.body.appendChild(el1);
    await flush();
    vi.advanceTimersByTime(500);

    expect(onStable).toHaveBeenCalledTimes(1);

    // Second stable period
    const el2 = createVisibleElement('div', { 'data-testid': 'second' }, 'Second');
    document.body.appendChild(el2);
    await flush();
    vi.advanceTimersByTime(500);

    expect(onStable).toHaveBeenCalledTimes(2);
    expect(onStable.mock.calls[1][0][0]).toMatchObject({
      selector: '[data-testid="second"]',
    });
  });
});
