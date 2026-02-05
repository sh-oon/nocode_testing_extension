/**
 * Node types for serialization
 */
export type SerializedNodeType = 'element' | 'text' | 'comment' | 'document' | 'doctype';

/**
 * Serialized DOM node base interface
 */
export interface SerializedNodeBase {
  /** Node type */
  type: SerializedNodeType;
  /** Unique identifier for this node in the snapshot */
  id: number;
}

/**
 * Serialized element node
 */
export interface SerializedElement extends SerializedNodeBase {
  type: 'element';
  /** Tag name (lowercase) */
  tagName: string;
  /** Element attributes */
  attributes: Record<string, string>;
  /** Child nodes */
  children: SerializedNode[];
  /** Computed styles (optional, only for visible elements) */
  computedStyle?: Record<string, string>;
  /** Bounding rect (optional) */
  boundingRect?: BoundingRect;
  /** Whether element is visible */
  isVisible?: boolean;
  /** Shadow DOM root (if present) */
  shadowRoot?: SerializedNode[];
}

/**
 * Serialized text node
 */
export interface SerializedTextNode extends SerializedNodeBase {
  type: 'text';
  /** Text content */
  content: string;
}

/**
 * Serialized comment node
 */
export interface SerializedCommentNode extends SerializedNodeBase {
  type: 'comment';
  /** Comment content */
  content: string;
}

/**
 * Serialized document type node
 */
export interface SerializedDoctypeNode extends SerializedNodeBase {
  type: 'doctype';
  /** Document type name */
  name: string;
  /** Public ID */
  publicId: string;
  /** System ID */
  systemId: string;
}

/**
 * Union type for all serialized nodes
 */
export type SerializedNode =
  | SerializedElement
  | SerializedTextNode
  | SerializedCommentNode
  | SerializedDoctypeNode;

/**
 * Bounding rectangle for an element
 */
export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Viewport information
 */
export interface ViewportInfo {
  width: number;
  height: number;
  devicePixelRatio: number;
}

/**
 * Scroll position
 */
export interface ScrollPosition {
  x: number;
  y: number;
}

/**
 * Complete DOM snapshot
 */
export interface DomSnapshot {
  /** Unique snapshot ID */
  id: string;
  /** Serialized DOM tree starting from document element */
  root: SerializedNode;
  /** Page URL at time of snapshot */
  url: string;
  /** Page title */
  title: string;
  /** Timestamp when snapshot was taken */
  timestamp: number;
  /** Viewport dimensions */
  viewport: ViewportInfo;
  /** Scroll position */
  scrollPosition: ScrollPosition;
  /** Document doctype (if present) */
  doctype?: SerializedDoctypeNode;
}

/**
 * Screenshot capture result
 */
export interface ScreenshotResult {
  /** Base64 encoded image data */
  data: string;
  /** Image format (png, jpeg) */
  format: 'png' | 'jpeg';
  /** Image width */
  width: number;
  /** Image height */
  height: number;
  /** Timestamp when screenshot was taken */
  timestamp: number;
}

/**
 * Combined snapshot with DOM and screenshot
 */
export interface FullSnapshot {
  /** DOM structure snapshot */
  dom: DomSnapshot;
  /** Visual screenshot */
  screenshot?: ScreenshotResult;
}

/**
 * Configuration for DOM serialization
 */
export interface SerializerConfig {
  /** Include computed styles (default: false, increases snapshot size) */
  includeComputedStyles?: boolean;
  /** Include bounding rects (default: false) */
  includeBoundingRects?: boolean;
  /** Include visibility info (default: true) */
  includeVisibility?: boolean;
  /** Include shadow DOM (default: true) */
  includeShadowDom?: boolean;
  /** CSS properties to capture (if includeComputedStyles is true) */
  styleProperties?: string[];
  /** Maximum depth to serialize (default: unlimited) */
  maxDepth?: number;
  /** Elements to skip serialization (CSS selectors) */
  skipSelectors?: string[];
  /** Attributes to exclude */
  excludeAttributes?: string[];
}

/**
 * Configuration for screenshot capture
 */
export interface ScreenshotConfig {
  /** Image format (default: 'png') */
  format?: 'png' | 'jpeg';
  /** JPEG quality (0-1, default: 0.92) */
  quality?: number;
  /** Scale factor (default: 1) */
  scale?: number;
  /** Background color (default: '#ffffff') */
  backgroundColor?: string;
  /** Whether to capture full page or just viewport (default: false = viewport only) */
  fullPage?: boolean;
  /** Specific element to capture (CSS selector) */
  targetSelector?: string;
  /** Exclude elements from screenshot (CSS selectors) */
  excludeSelectors?: string[];
}

/**
 * DOM Serializer instance interface
 */
export interface DomSerializer {
  /** Capture DOM snapshot */
  captureSnapshot(config?: SerializerConfig): DomSnapshot;
  /** Capture screenshot */
  captureScreenshot(config?: ScreenshotConfig): Promise<ScreenshotResult>;
  /** Capture both DOM and screenshot */
  captureFullSnapshot(
    domConfig?: SerializerConfig,
    screenshotConfig?: ScreenshotConfig
  ): Promise<FullSnapshot>;
}

/**
 * Default CSS properties to capture for computed styles
 */
export const DEFAULT_STYLE_PROPERTIES = [
  'display',
  'visibility',
  'opacity',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'margin',
  'padding',
  'border',
  'background-color',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'text-align',
  'z-index',
  'overflow',
  'transform',
];

/**
 * Default serializer configuration
 */
export const DEFAULT_SERIALIZER_CONFIG: Required<SerializerConfig> = {
  includeComputedStyles: false,
  includeBoundingRects: false,
  includeVisibility: true,
  includeShadowDom: true,
  styleProperties: DEFAULT_STYLE_PROPERTIES,
  maxDepth: Number.POSITIVE_INFINITY,
  skipSelectors: ['script', 'noscript', 'style', 'link[rel="stylesheet"]'],
  excludeAttributes: ['data-reactid', 'data-react-checksum'],
};

/**
 * Default screenshot configuration
 */
export const DEFAULT_SCREENSHOT_CONFIG: Required<ScreenshotConfig> = {
  format: 'png',
  quality: 0.92,
  scale: 1,
  backgroundColor: '#ffffff',
  fullPage: false,
  targetSelector: '',
  excludeSelectors: [],
};
