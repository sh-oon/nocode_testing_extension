import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce, deepClone, generateEventId, throttle } from '../utils/helpers';

describe('generateEventId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateEventId();
    const id2 = generateEventId();

    expect(id1).not.toBe(id2);
  });

  it('should start with evt- prefix', () => {
    const id = generateEventId();

    expect(id.startsWith('evt-')).toBe(true);
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce function calls', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on subsequent calls', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should throttle function calls', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should allow calls after limit', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttledFn();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('deepClone', () => {
  it('should clone primitive values', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(null)).toBeNull();
  });

  it('should clone arrays', () => {
    const original = [1, 2, 3];
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);

    // Modify original should not affect clone
    original.push(4);
    expect(cloned.length).toBe(3);
  });

  it('should clone objects', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);

    // Modify original should not affect clone
    original.b.c = 99;
    expect(cloned.b.c).toBe(2);
  });

  it('should clone nested structures', () => {
    const original = {
      arr: [1, { nested: true }],
      obj: { deep: { value: 'test' } },
    };
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned.arr).not.toBe(original.arr);
    expect(cloned.obj.deep).not.toBe(original.obj.deep);
  });
});
