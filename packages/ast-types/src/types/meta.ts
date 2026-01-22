/**
 * Viewport dimensions
 */
export interface Viewport {
  width: number;
  height: number;
  /** Device scale factor */
  deviceScaleFactor?: number;
  /** Whether to emulate mobile */
  isMobile?: boolean;
  /** Whether to emulate touch events */
  hasTouch?: boolean;
  /** Whether to render in landscape */
  isLandscape?: boolean;
}

/**
 * Locale and timezone settings
 */
export interface LocaleSettings {
  /** Locale string (e.g., 'en-US', 'ko-KR') */
  locale?: string;
  /** Timezone ID (e.g., 'America/New_York', 'Asia/Seoul') */
  timezone?: string;
}

/**
 * Recording environment metadata
 */
export interface RecordingMeta {
  /** ISO 8601 timestamp of recording start */
  recordedAt: string;
  /** Base URL where recording started */
  url: string;
  /** Viewport at recording time */
  viewport: Viewport;
  /** User agent string */
  userAgent?: string;
  /** Locale settings during recording */
  locale?: LocaleSettings;
  /** Chrome extension version used for recording */
  extensionVersion?: string;
  /** AST schema version for compatibility checking */
  astSchemaVersion: string;
}

/**
 * Execution environment metadata (filled during test run)
 */
export interface ExecutionMeta {
  /** ISO 8601 timestamp of execution start */
  executedAt: string;
  /** ISO 8601 timestamp of execution end */
  completedAt?: string;
  /** Execution duration in milliseconds */
  duration?: number;
  /** Operating system */
  os?: string;
  /** Node.js version */
  nodeVersion?: string;
  /** Puppeteer version */
  puppeteerVersion?: string;
  /** Chrome/Chromium version */
  browserVersion?: string;
  /** Execution result status */
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  /** Error information if failed */
  error?: {
    message: string;
    stack?: string;
    stepId?: string;
  };
}

/**
 * Combined scenario metadata
 */
export interface ScenarioMeta extends RecordingMeta {
  /** Last execution metadata (optional) */
  lastExecution?: ExecutionMeta;
  /** Tags for organizing scenarios */
  tags?: string[];
  /** Priority level */
  priority?: 'critical' | 'high' | 'medium' | 'low';
  /** Author information */
  author?: string;
  /** Last modified timestamp */
  modifiedAt?: string;
}
