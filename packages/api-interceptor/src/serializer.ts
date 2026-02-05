import type { SerializedHeaders } from './types';

/**
 * Generate a unique ID for requests
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Serialize Headers object to plain object
 */
export function serializeHeaders(
  headers: Headers | Record<string, string> | [string, string][] | undefined
): SerializedHeaders {
  const result: SerializedHeaders = {};

  if (!headers) {
    return result;
  }

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key.toLowerCase()] = value;
    }
  } else {
    for (const [key, value] of Object.entries(headers)) {
      result[key.toLowerCase()] = value;
    }
  }

  return result;
}

/**
 * Parse body content, attempting JSON parse if applicable
 */
export async function parseBody(
  body: BodyInit | null | undefined,
  contentType?: string,
  maxSize?: number
): Promise<unknown> {
  if (body === null || body === undefined) {
    return undefined;
  }

  try {
    let text: string;

    if (typeof body === 'string') {
      text = body;
    } else if (body instanceof Blob) {
      if (maxSize && body.size > maxSize) {
        return `[Body too large: ${body.size} bytes]`;
      }
      text = await body.text();
    } else if (body instanceof ArrayBuffer) {
      if (maxSize && body.byteLength > maxSize) {
        return `[Body too large: ${body.byteLength} bytes]`;
      }
      text = new TextDecoder().decode(body);
    } else if (body instanceof FormData) {
      return serializeFormData(body);
    } else if (body instanceof URLSearchParams) {
      return Object.fromEntries(body.entries());
    } else if (body instanceof ReadableStream) {
      return '[ReadableStream - body not captured]';
    } else {
      // Unknown type, try to stringify
      return String(body);
    }

    // Try to parse as JSON if content-type suggests JSON
    if (contentType?.includes('application/json') || isLikelyJson(text)) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return text;
  } catch (error) {
    return `[Error parsing body: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Parse Response body
 */
export async function parseResponseBody(response: Response, maxSize?: number): Promise<unknown> {
  try {
    // Clone the response to read the body without consuming it
    const clone = response.clone();
    const contentType = clone.headers.get('content-type') || '';
    const contentLength = clone.headers.get('content-length');

    // Check size before reading
    if (maxSize && contentLength) {
      const size = Number.parseInt(contentLength, 10);
      if (size > maxSize) {
        return `[Body too large: ${size} bytes]`;
      }
    }

    const text = await clone.text();

    if (maxSize && text.length > maxSize) {
      return `[Body too large: ${text.length} bytes]`;
    }

    // Try to parse as JSON
    if (contentType.includes('application/json') || isLikelyJson(text)) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return text;
  } catch (error) {
    return `[Error reading response: ${error instanceof Error ? error.message : String(error)}]`;
  }
}

/**
 * Serialize FormData to plain object
 */
function serializeFormData(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  formData.forEach((value, key) => {
    if (value instanceof File) {
      result[key] = {
        type: 'File',
        name: value.name,
        size: value.size,
        mimeType: value.type,
      };
    } else {
      // Handle multiple values for same key
      if (key in result) {
        const existing = result[key];
        if (Array.isArray(existing)) {
          existing.push(value);
        } else {
          result[key] = [existing, value];
        }
      } else {
        result[key] = value;
      }
    }
  });

  return result;
}

/**
 * Check if a string looks like JSON
 */
function isLikelyJson(text: string): boolean {
  const trimmed = text.trim();
  return (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  );
}

/**
 * Extract URL from various input types
 */
export function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  if (input instanceof Request) {
    return input.url;
  }
  return String(input);
}

/**
 * Extract method from fetch init options
 */
export function extractMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) {
    return init.method.toUpperCase();
  }
  if (input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

/**
 * Merge headers from request and init
 */
export function mergeHeaders(input: RequestInfo | URL, init?: RequestInit): SerializedHeaders {
  let headers: SerializedHeaders = {};

  // Get headers from Request object if applicable
  if (input instanceof Request) {
    headers = serializeHeaders(input.headers);
  }

  // Override with init headers
  if (init?.headers) {
    const initHeaders = serializeHeaders(
      init.headers as Headers | Record<string, string> | [string, string][]
    );
    headers = { ...headers, ...initHeaders };
  }

  return headers;
}

/**
 * Get body from request input
 */
export async function extractRequestBody(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxSize?: number
): Promise<unknown> {
  // Init body takes precedence
  if (init?.body !== undefined) {
    const contentType = init.headers
      ? serializeHeaders(init.headers as Headers | Record<string, string> | [string, string][])[
          'content-type'
        ]
      : undefined;
    return parseBody(init.body, contentType, maxSize);
  }

  // Get body from Request object
  if (input instanceof Request && input.body) {
    try {
      const clone = input.clone();
      const contentType = clone.headers.get('content-type') || undefined;
      const text = await clone.text();
      return parseBody(text, contentType, maxSize);
    } catch {
      return undefined;
    }
  }

  return undefined;
}
