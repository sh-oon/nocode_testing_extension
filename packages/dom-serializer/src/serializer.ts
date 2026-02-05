import type {
  BoundingRect,
  DomSnapshot,
  ScrollPosition,
  SerializedCommentNode,
  SerializedDoctypeNode,
  SerializedElement,
  SerializedNode,
  SerializedTextNode,
  SerializerConfig,
  ViewportInfo,
} from './types';
import { DEFAULT_SERIALIZER_CONFIG } from './types';

/**
 * Node ID counter for unique IDs within a snapshot
 */
let nodeIdCounter = 0;

/**
 * Reset the node ID counter
 */
function resetNodeIdCounter(): void {
  nodeIdCounter = 0;
}

/**
 * Generate a unique snapshot ID
 */
export function generateSnapshotId(): string {
  return `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Check if an element is visible in the viewport
 */
function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return true; // SVG and other elements are considered visible
  }

  // Check if element has dimensions
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }

  // Check computed style
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }

  // Check if element is in viewport (with some margin)
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Element is visible if it's at least partially in the extended viewport
  const margin = 100;
  const isInViewport =
    rect.bottom >= -margin &&
    rect.top <= viewportHeight + margin &&
    rect.right >= -margin &&
    rect.left <= viewportWidth + margin;

  return isInViewport || element.offsetParent !== null;
}

/**
 * Get bounding rect for an element
 */
function getBoundingRect(element: Element): BoundingRect {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}

/**
 * Get computed styles for an element
 */
function getComputedStyles(element: Element, properties: string[]): Record<string, string> {
  const styles: Record<string, string> = {};
  const computed = window.getComputedStyle(element);

  for (const prop of properties) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'initial' && value !== 'inherit') {
      styles[prop] = value;
    }
  }

  return styles;
}

/**
 * Get element attributes as a plain object
 */
function getAttributes(element: Element, excludeAttributes: string[]): Record<string, string> {
  const attributes: Record<string, string> = {};
  const excludeSet = new Set(excludeAttributes.map((a) => a.toLowerCase()));

  for (const attr of element.attributes) {
    const name = attr.name.toLowerCase();
    if (!excludeSet.has(name)) {
      attributes[name] = attr.value;
    }
  }

  return attributes;
}

/**
 * Check if element should be skipped based on selectors
 */
function shouldSkipElement(element: Element, skipSelectors: string[]): boolean {
  for (const selector of skipSelectors) {
    try {
      if (element.matches(selector)) {
        return true;
      }
    } catch {
      // Invalid selector, skip check
    }
  }
  return false;
}

/**
 * Serialize a DOM node recursively
 */
function serializeNode(
  node: Node,
  config: Required<SerializerConfig>,
  depth: number
): SerializedNode | null {
  // Check max depth
  if (depth > config.maxDepth) {
    return null;
  }

  const id = nodeIdCounter++;

  switch (node.nodeType) {
    case Node.ELEMENT_NODE: {
      const element = node as Element;

      // Check if should skip
      if (shouldSkipElement(element, config.skipSelectors)) {
        return null;
      }

      const serialized: SerializedElement = {
        type: 'element',
        id,
        tagName: element.tagName.toLowerCase(),
        attributes: getAttributes(element, config.excludeAttributes),
        children: [],
      };

      // Add visibility info
      if (config.includeVisibility) {
        serialized.isVisible = isElementVisible(element);
      }

      // Add bounding rect
      if (config.includeBoundingRects) {
        serialized.boundingRect = getBoundingRect(element);
      }

      // Add computed styles
      if (config.includeComputedStyles) {
        serialized.computedStyle = getComputedStyles(element, config.styleProperties);
      }

      // Serialize children
      for (const child of element.childNodes) {
        const serializedChild = serializeNode(child, config, depth + 1);
        if (serializedChild) {
          serialized.children.push(serializedChild);
        }
      }

      // Serialize shadow DOM
      if (config.includeShadowDom && element.shadowRoot) {
        serialized.shadowRoot = [];
        for (const child of element.shadowRoot.childNodes) {
          const serializedChild = serializeNode(child, config, depth + 1);
          if (serializedChild) {
            serialized.shadowRoot.push(serializedChild);
          }
        }
      }

      return serialized;
    }

    case Node.TEXT_NODE: {
      const text = node.textContent?.trim();
      if (!text) {
        return null; // Skip empty text nodes
      }

      const serialized: SerializedTextNode = {
        type: 'text',
        id,
        content: text,
      };

      return serialized;
    }

    case Node.COMMENT_NODE: {
      const serialized: SerializedCommentNode = {
        type: 'comment',
        id,
        content: node.textContent || '',
      };

      return serialized;
    }

    case Node.DOCUMENT_TYPE_NODE: {
      const doctype = node as DocumentType;
      const serialized: SerializedDoctypeNode = {
        type: 'doctype',
        id,
        name: doctype.name,
        publicId: doctype.publicId,
        systemId: doctype.systemId,
      };

      return serialized;
    }

    default:
      return null;
  }
}

/**
 * Get current viewport information
 */
function getViewportInfo(): ViewportInfo {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

/**
 * Get current scroll position
 */
function getScrollPosition(): ScrollPosition {
  return {
    x: window.scrollX || window.pageXOffset || 0,
    y: window.scrollY || window.pageYOffset || 0,
  };
}

/**
 * Serialize document doctype
 */
function serializeDoctype(doctype: DocumentType | null): SerializedDoctypeNode | undefined {
  if (!doctype) {
    return undefined;
  }

  return {
    type: 'doctype',
    id: nodeIdCounter++,
    name: doctype.name,
    publicId: doctype.publicId,
    systemId: doctype.systemId,
  };
}

/**
 * Capture a DOM snapshot
 */
export function captureSnapshot(userConfig: SerializerConfig = {}): DomSnapshot {
  // Reset ID counter for new snapshot
  resetNodeIdCounter();

  // Merge config with defaults
  const config: Required<SerializerConfig> = {
    ...DEFAULT_SERIALIZER_CONFIG,
    ...userConfig,
  };

  // Serialize the document element
  const root = serializeNode(document.documentElement, config, 0);

  if (!root) {
    throw new Error('Failed to serialize document element');
  }

  const snapshot: DomSnapshot = {
    id: generateSnapshotId(),
    root,
    url: window.location.href,
    title: document.title,
    timestamp: Date.now(),
    viewport: getViewportInfo(),
    scrollPosition: getScrollPosition(),
    doctype: serializeDoctype(document.doctype),
  };

  return snapshot;
}

/**
 * Serialize a specific element (not the entire document)
 */
export function serializeElement(
  element: Element,
  userConfig: SerializerConfig = {}
): SerializedElement | null {
  resetNodeIdCounter();

  const config: Required<SerializerConfig> = {
    ...DEFAULT_SERIALIZER_CONFIG,
    ...userConfig,
  };

  const serialized = serializeNode(element, config, 0);

  if (serialized?.type !== 'element') {
    return null;
  }

  return serialized;
}

/**
 * Find differences between two serialized nodes (basic comparison)
 */
export function compareNodes(
  baseline: SerializedNode | null,
  actual: SerializedNode | null
): { hasDifferences: boolean; differences: string[] } {
  const differences: string[] = [];

  if (!baseline && !actual) {
    return { hasDifferences: false, differences };
  }

  if (!baseline || !actual) {
    differences.push(baseline ? 'Node removed' : 'Node added');
    return { hasDifferences: true, differences };
  }

  if (baseline.type !== actual.type) {
    differences.push(`Type changed: ${baseline.type} → ${actual.type}`);
    return { hasDifferences: true, differences };
  }

  if (baseline.type === 'element' && actual.type === 'element') {
    if (baseline.tagName !== actual.tagName) {
      differences.push(`Tag changed: ${baseline.tagName} → ${actual.tagName}`);
    }

    // Compare attributes
    const baselineAttrs = baseline.attributes;
    const actualAttrs = actual.attributes;
    const allAttrKeys = new Set([...Object.keys(baselineAttrs), ...Object.keys(actualAttrs)]);

    for (const key of allAttrKeys) {
      if (!(key in baselineAttrs)) {
        differences.push(`Attribute added: ${key}="${actualAttrs[key]}"`);
      } else if (!(key in actualAttrs)) {
        differences.push(`Attribute removed: ${key}`);
      } else if (baselineAttrs[key] !== actualAttrs[key]) {
        differences.push(
          `Attribute changed: ${key}="${baselineAttrs[key]}" → "${actualAttrs[key]}"`
        );
      }
    }

    // Compare children count
    if (baseline.children.length !== actual.children.length) {
      differences.push(
        `Children count changed: ${baseline.children.length} → ${actual.children.length}`
      );
    }
  }

  if (baseline.type === 'text' && actual.type === 'text') {
    if (baseline.content !== actual.content) {
      differences.push(`Text changed: "${baseline.content}" → "${actual.content}"`);
    }
  }

  return {
    hasDifferences: differences.length > 0,
    differences,
  };
}
