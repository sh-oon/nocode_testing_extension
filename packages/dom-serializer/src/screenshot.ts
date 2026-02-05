import html2canvas from 'html2canvas';
import type { ScreenshotConfig, ScreenshotResult } from './types';
import { DEFAULT_SCREENSHOT_CONFIG } from './types';

/**
 * Hide elements matching selectors before screenshot
 */
function hideElements(selectors: string[]): Map<HTMLElement, string> {
  const hiddenElements = new Map<HTMLElement, string>();

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      for (const element of elements) {
        hiddenElements.set(element, element.style.visibility);
        element.style.visibility = 'hidden';
      }
    } catch {
      // Invalid selector, skip
    }
  }

  return hiddenElements;
}

/**
 * Restore hidden elements after screenshot
 */
function restoreElements(hiddenElements: Map<HTMLElement, string>): void {
  for (const [element, originalVisibility] of hiddenElements) {
    element.style.visibility = originalVisibility;
  }
}

/**
 * Get the target element for screenshot
 */
function getTargetElement(selector: string | undefined): HTMLElement {
  if (selector) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      return element;
    }
    console.warn(`[dom-serializer] Target selector "${selector}" not found, falling back to body`);
  }
  return document.body;
}

/**
 * Capture a screenshot using html2canvas
 */
export async function captureScreenshot(
  userConfig: ScreenshotConfig = {}
): Promise<ScreenshotResult> {
  // Merge config with defaults
  const config: Required<ScreenshotConfig> = {
    ...DEFAULT_SCREENSHOT_CONFIG,
    ...userConfig,
  };

  // Hide elements that should be excluded
  const hiddenElements = hideElements(config.excludeSelectors);

  try {
    // Get target element
    const targetElement = getTargetElement(config.targetSelector);

    // Configure html2canvas options
    const html2canvasOptions: Parameters<typeof html2canvas>[1] = {
      backgroundColor: config.backgroundColor,
      scale: config.scale * window.devicePixelRatio,
      useCORS: true,
      allowTaint: true,
      logging: false,
      // Full page capture
      windowWidth: config.fullPage ? document.documentElement.scrollWidth : window.innerWidth,
      windowHeight: config.fullPage ? document.documentElement.scrollHeight : window.innerHeight,
      x: config.fullPage ? 0 : window.scrollX,
      y: config.fullPage ? 0 : window.scrollY,
      width: config.fullPage ? document.documentElement.scrollWidth : window.innerWidth,
      height: config.fullPage ? document.documentElement.scrollHeight : window.innerHeight,
    };

    // Capture the screenshot
    const canvas = await html2canvas(targetElement, html2canvasOptions);

    // Convert to data URL
    const mimeType = config.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = config.format === 'jpeg' ? config.quality : undefined;
    const dataUrl = canvas.toDataURL(mimeType, quality);

    // Extract base64 data (remove data URL prefix)
    const base64Data = dataUrl.split(',')[1];

    const result: ScreenshotResult = {
      data: base64Data,
      format: config.format,
      width: canvas.width,
      height: canvas.height,
      timestamp: Date.now(),
    };

    return result;
  } finally {
    // Always restore hidden elements
    restoreElements(hiddenElements);
  }
}

/**
 * Capture a screenshot of a specific element
 */
export async function captureElementScreenshot(
  element: HTMLElement,
  userConfig: Omit<ScreenshotConfig, 'targetSelector' | 'fullPage'> = {}
): Promise<ScreenshotResult> {
  const config = {
    ...DEFAULT_SCREENSHOT_CONFIG,
    ...userConfig,
    targetSelector: '',
    fullPage: false,
  };

  const hiddenElements = hideElements(config.excludeSelectors);

  try {
    const html2canvasOptions: Parameters<typeof html2canvas>[1] = {
      backgroundColor: config.backgroundColor,
      scale: config.scale * window.devicePixelRatio,
      useCORS: true,
      allowTaint: true,
      logging: false,
    };

    const canvas = await html2canvas(element, html2canvasOptions);

    const mimeType = config.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = config.format === 'jpeg' ? config.quality : undefined;
    const dataUrl = canvas.toDataURL(mimeType, quality);
    const base64Data = dataUrl.split(',')[1];

    return {
      data: base64Data,
      format: config.format,
      width: canvas.width,
      height: canvas.height,
      timestamp: Date.now(),
    };
  } finally {
    restoreElements(hiddenElements);
  }
}

/**
 * Compare two screenshots using simple pixel comparison
 * Returns the percentage of different pixels (0-100)
 *
 * Note: For production use, consider using pixelmatch library instead
 * This is a simplified version for basic comparison
 */
export async function compareScreenshots(
  baseline: ScreenshotResult,
  actual: ScreenshotResult
): Promise<{ diffPercentage: number; matched: boolean }> {
  // Check if dimensions match
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    return {
      diffPercentage: 100,
      matched: false,
    };
  }

  // Create canvases for comparison
  const baselineCanvas = document.createElement('canvas');
  const actualCanvas = document.createElement('canvas');

  baselineCanvas.width = baseline.width;
  baselineCanvas.height = baseline.height;
  actualCanvas.width = actual.width;
  actualCanvas.height = actual.height;

  const baselineCtx = baselineCanvas.getContext('2d');
  const actualCtx = actualCanvas.getContext('2d');

  if (!baselineCtx || !actualCtx) {
    throw new Error('Failed to create canvas context');
  }

  // Load images
  const loadImage = (data: string, format: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `data:image/${format};base64,${data}`;
    });
  };

  const [baselineImg, actualImg] = await Promise.all([
    loadImage(baseline.data, baseline.format),
    loadImage(actual.data, actual.format),
  ]);

  baselineCtx.drawImage(baselineImg, 0, 0);
  actualCtx.drawImage(actualImg, 0, 0);

  // Get image data
  const baselineData = baselineCtx.getImageData(0, 0, baseline.width, baseline.height);
  const actualData = actualCtx.getImageData(0, 0, actual.width, actual.height);

  // Count different pixels
  let diffCount = 0;
  const totalPixels = baseline.width * baseline.height;
  const threshold = 10; // Color difference threshold

  for (let i = 0; i < baselineData.data.length; i += 4) {
    const rDiff = Math.abs(baselineData.data[i] - actualData.data[i]);
    const gDiff = Math.abs(baselineData.data[i + 1] - actualData.data[i + 1]);
    const bDiff = Math.abs(baselineData.data[i + 2] - actualData.data[i + 2]);

    if (rDiff > threshold || gDiff > threshold || bDiff > threshold) {
      diffCount++;
    }
  }

  const diffPercentage = (diffCount / totalPixels) * 100;

  return {
    diffPercentage,
    matched: diffPercentage < 1, // Less than 1% difference is considered a match
  };
}

/**
 * Convert base64 screenshot to Blob for download or storage
 */
export function screenshotToBlob(screenshot: ScreenshotResult): Blob {
  const byteCharacters = atob(screenshot.data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const mimeType = screenshot.format === 'jpeg' ? 'image/jpeg' : 'image/png';

  return new Blob([byteArray], { type: mimeType });
}

/**
 * Download screenshot as file
 */
export function downloadScreenshot(screenshot: ScreenshotResult, filename?: string): void {
  const blob = screenshotToBlob(screenshot);
  const url = URL.createObjectURL(blob);

  const extension = screenshot.format === 'jpeg' ? 'jpg' : 'png';
  const defaultFilename = `screenshot-${Date.now()}.${extension}`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || defaultFilename;
  link.click();

  URL.revokeObjectURL(url);
}
