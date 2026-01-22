/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `evt-${timestamp}-${random}`;
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: Parameters<T>) => void>(func: T, wait: number): T {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  } as T;
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: Parameters<T>) => void>(func: T, limit: number): T {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function throttled(this: unknown, ...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastCall >= limit) {
      lastCall = now;
      func.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(
        () => {
          lastCall = Date.now();
          func.apply(this, args);
          timeoutId = null;
        },
        limit - (now - lastCall)
      );
    }
  } as T;
}

/**
 * Deep clone an object (simple implementation)
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}
