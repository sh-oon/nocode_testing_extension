/**
 * JSONPath builder utility
 * Converts an array of path segments into a JSONPath expression
 */

/**
 * Build a JSONPath expression from an array of path segments
 *
 * @example
 * buildJsonPath(['data', 'user', 'id']) → '$.data.user.id'
 * buildJsonPath(['data', 'items', 0, 'name']) → '$.data.items[0].name'
 * buildJsonPath(['some-key', 'with spaces']) → "$['some-key']['with spaces']"
 */
export function buildJsonPath(path: (string | number)[]): string {
  let result = '$';

  for (const segment of path) {
    if (typeof segment === 'number') {
      result += `[${segment}]`;
    } else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(segment)) {
      result += `.${segment}`;
    } else {
      result += `['${segment}']`;
    }
  }

  return result;
}

/**
 * Determine the display type of a JSON value
 */
export function getValueType(value: unknown): 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as 'object' | 'string' | 'number' | 'boolean';
}

/**
 * Get a short preview string for a value
 */
export function getValuePreview(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    return value.length > 40 ? `"${value.slice(0, 40)}..."` : `"${value}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return `{${keys.length} keys}`;
  }
  return String(value);
}
