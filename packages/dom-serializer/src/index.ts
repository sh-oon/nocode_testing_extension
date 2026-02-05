/**
 * @like-cake/dom-serializer
 *
 * DOM serialization and screenshot capture for E2E test automation.
 * Provides tools to capture DOM structure as JSON and visual screenshots.
 */

export {
  captureElementScreenshot,
  captureScreenshot,
  compareScreenshots,
  downloadScreenshot,
  screenshotToBlob,
} from './screenshot';
export {
  captureSnapshot,
  compareNodes,
  generateSnapshotId,
  serializeElement,
} from './serializer';
export * from './types';

import { captureScreenshot } from './screenshot';
import { captureSnapshot } from './serializer';
import type {
  DomSerializer,
  DomSnapshot,
  FullSnapshot,
  ScreenshotConfig,
  ScreenshotResult,
  SerializerConfig,
} from './types';

/**
 * Create a DOM serializer instance with default configuration
 */
export function createDomSerializer(
  defaultDomConfig: SerializerConfig = {},
  defaultScreenshotConfig: ScreenshotConfig = {}
): DomSerializer {
  return {
    captureSnapshot(config?: SerializerConfig): DomSnapshot {
      return captureSnapshot({ ...defaultDomConfig, ...config });
    },

    async captureScreenshot(config?: ScreenshotConfig): Promise<ScreenshotResult> {
      return captureScreenshot({ ...defaultScreenshotConfig, ...config });
    },

    async captureFullSnapshot(
      domConfig?: SerializerConfig,
      screenshotConfig?: ScreenshotConfig
    ): Promise<FullSnapshot> {
      const [dom, screenshot] = await Promise.all([
        Promise.resolve(captureSnapshot({ ...defaultDomConfig, ...domConfig })),
        captureScreenshot({ ...defaultScreenshotConfig, ...screenshotConfig }),
      ]);

      return {
        dom,
        screenshot,
      };
    },
  };
}

/**
 * Convenience function to capture a full snapshot (DOM + screenshot)
 */
export async function captureFullSnapshot(
  domConfig?: SerializerConfig,
  screenshotConfig?: ScreenshotConfig
): Promise<FullSnapshot> {
  const [dom, screenshot] = await Promise.all([
    Promise.resolve(captureSnapshot(domConfig)),
    captureScreenshot(screenshotConfig),
  ]);

  return {
    dom,
    screenshot,
  };
}

/**
 * Compress a DOM snapshot using JSON stringification
 * For actual gzip compression, use pako or similar library on the server
 */
export function serializeSnapshot(snapshot: DomSnapshot): string {
  return JSON.stringify(snapshot);
}

/**
 * Deserialize a DOM snapshot from JSON string
 */
export function deserializeSnapshot(json: string): DomSnapshot {
  return JSON.parse(json);
}

/**
 * Calculate approximate size of a snapshot in bytes
 */
export function estimateSnapshotSize(snapshot: DomSnapshot): number {
  return new Blob([JSON.stringify(snapshot)]).size;
}

/**
 * Calculate approximate size of a screenshot in bytes
 */
export function estimateScreenshotSize(screenshot: ScreenshotResult): number {
  // Base64 encoding increases size by ~33%
  return Math.ceil((screenshot.data.length * 3) / 4);
}
