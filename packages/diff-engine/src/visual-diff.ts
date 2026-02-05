import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { VisualDiffConfig, VisualDiffResult } from './types';
import { DEFAULT_VISUAL_DIFF_CONFIG } from './types';

/**
 * Decodes a base64 image string to PNG data
 */
function decodeBase64Image(base64: string): PNG {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  return PNG.sync.read(buffer);
}

/**
 * Encodes PNG data to base64 string
 */
function encodeToBase64(png: PNG): string {
  const buffer = PNG.sync.write(png);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

/**
 * Creates a mask from ignore regions
 */
function applyMask(
  png: PNG,
  masks: Array<{ x: number; y: number; width: number; height: number }>
): void {
  for (const mask of masks) {
    for (let y = mask.y; y < mask.y + mask.height && y < png.height; y++) {
      for (let x = mask.x; x < mask.x + mask.width && x < png.width; x++) {
        const idx = (png.width * y + x) << 2;
        // Set to transparent (or a neutral color)
        png.data[idx] = 128; // R
        png.data[idx + 1] = 128; // G
        png.data[idx + 2] = 128; // B
        png.data[idx + 3] = 255; // A
      }
    }
  }
}

/**
 * Resizes a PNG to match target dimensions by padding or cropping
 */
function normalizeSize(png: PNG, targetWidth: number, targetHeight: number): PNG {
  if (png.width === targetWidth && png.height === targetHeight) {
    return png;
  }

  const normalized = new PNG({ width: targetWidth, height: targetHeight });

  // Fill with transparent pixels first
  normalized.data.fill(0);

  // Copy existing pixels
  const copyWidth = Math.min(png.width, targetWidth);
  const copyHeight = Math.min(png.height, targetHeight);

  for (let y = 0; y < copyHeight; y++) {
    for (let x = 0; x < copyWidth; x++) {
      const srcIdx = (png.width * y + x) << 2;
      const dstIdx = (targetWidth * y + x) << 2;
      normalized.data[dstIdx] = png.data[srcIdx];
      normalized.data[dstIdx + 1] = png.data[srcIdx + 1];
      normalized.data[dstIdx + 2] = png.data[srcIdx + 2];
      normalized.data[dstIdx + 3] = png.data[srcIdx + 3];
    }
  }

  return normalized;
}

/**
 * Compares two screenshots and returns the diff result
 */
export function compareScreenshots(
  baselineImage: string,
  actualImage: string,
  userConfig: VisualDiffConfig = {}
): VisualDiffResult {
  const config: Required<VisualDiffConfig> = {
    ...DEFAULT_VISUAL_DIFF_CONFIG,
    ...userConfig,
  };

  // Decode images
  let baselinePng: PNG;
  let actualPng: PNG;

  try {
    baselinePng = decodeBase64Image(baselineImage);
    actualPng = decodeBase64Image(actualImage);
  } catch (_error) {
    // If decoding fails, return a failure result
    return {
      passed: false,
      diffPercentage: 100,
      diffPixelCount: 0,
      totalPixels: 0,
      dimensionsMatch: false,
      baselineDimensions: { width: 0, height: 0 },
      actualDimensions: { width: 0, height: 0 },
      threshold: config.diffThreshold,
    };
  }

  // Store original dimensions
  const baselineDimensions = { width: baselinePng.width, height: baselinePng.height };
  const actualDimensions = { width: actualPng.width, height: actualPng.height };
  const dimensionsMatch =
    baselinePng.width === actualPng.width && baselinePng.height === actualPng.height;

  // Apply masks if configured
  if (config.ignoreMasks.length > 0) {
    applyMask(baselinePng, config.ignoreMasks);
    applyMask(actualPng, config.ignoreMasks);
  }

  // Normalize sizes if different
  if (!dimensionsMatch) {
    const maxWidth = Math.max(baselinePng.width, actualPng.width);
    const maxHeight = Math.max(baselinePng.height, actualPng.height);
    baselinePng = normalizeSize(baselinePng, maxWidth, maxHeight);
    actualPng = normalizeSize(actualPng, maxWidth, maxHeight);
  }

  // Create diff image
  const { width, height } = baselinePng;
  const diffPng = new PNG({ width, height });

  // Perform pixel comparison
  const diffPixelCount = pixelmatch(baselinePng.data, actualPng.data, diffPng.data, width, height, {
    threshold: config.threshold,
    includeAA: config.includeAntiAlias,
    alpha: config.alpha,
    diffColor: [config.diffColor.r, config.diffColor.g, config.diffColor.b],
    diffColorAlt: [0, 255, 0], // Green for anti-aliased pixels
  });

  // Calculate statistics
  const totalPixels = width * height;
  const diffPercentage = (diffPixelCount / totalPixels) * 100;
  const passed = diffPercentage <= config.diffThreshold;

  // Generate diff image only if there are differences
  const diffImage = diffPixelCount > 0 ? encodeToBase64(diffPng) : undefined;

  return {
    passed,
    diffPercentage: Math.round(diffPercentage * 100) / 100, // Round to 2 decimal places
    diffPixelCount,
    totalPixels,
    diffImage,
    dimensionsMatch,
    baselineDimensions,
    actualDimensions,
    threshold: config.diffThreshold,
  };
}

/**
 * Creates a side-by-side comparison image
 */
export function createSideBySideImage(
  baselineImage: string,
  actualImage: string,
  diffImage?: string
): string {
  const baseline = decodeBase64Image(baselineImage);
  const actual = decodeBase64Image(actualImage);

  // Determine dimensions
  const maxHeight = Math.max(baseline.height, actual.height);
  const totalWidth =
    baseline.width + actual.width + (diffImage ? decodeBase64Image(diffImage).width : 0);
  const gap = 10;

  const combined = new PNG({
    width: totalWidth + (diffImage ? gap * 2 : gap),
    height: maxHeight,
  });

  // Fill with white background
  for (let i = 0; i < combined.data.length; i += 4) {
    combined.data[i] = 255;
    combined.data[i + 1] = 255;
    combined.data[i + 2] = 255;
    combined.data[i + 3] = 255;
  }

  // Copy baseline
  copyImage(baseline, combined, 0, 0);

  // Copy actual
  copyImage(actual, combined, baseline.width + gap, 0);

  // Copy diff if present
  if (diffImage) {
    const diff = decodeBase64Image(diffImage);
    copyImage(diff, combined, baseline.width + actual.width + gap * 2, 0);
  }

  return encodeToBase64(combined);
}

/**
 * Copies one PNG into another at the specified position
 */
function copyImage(src: PNG, dst: PNG, offsetX: number, offsetY: number): void {
  for (let y = 0; y < src.height && y + offsetY < dst.height; y++) {
    for (let x = 0; x < src.width && x + offsetX < dst.width; x++) {
      const srcIdx = (src.width * y + x) << 2;
      const dstIdx = (dst.width * (y + offsetY) + (x + offsetX)) << 2;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }
}

/**
 * Creates an overlay comparison image (actual with diff highlighted)
 */
export function createOverlayImage(
  actualImage: string,
  diffImage: string,
  opacity: number = 0.5
): string {
  const actual = decodeBase64Image(actualImage);
  const diff = decodeBase64Image(diffImage);

  // Ensure same dimensions
  if (actual.width !== diff.width || actual.height !== diff.height) {
    throw new Error('Image dimensions must match for overlay');
  }

  const overlay = new PNG({ width: actual.width, height: actual.height });

  for (let i = 0; i < actual.data.length; i += 4) {
    // Check if this pixel is different (magenta in diff image)
    const isDiff = diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 255;

    if (isDiff) {
      // Blend with diff color
      overlay.data[i] = Math.round(actual.data[i] * (1 - opacity) + diff.data[i] * opacity);
      overlay.data[i + 1] = Math.round(
        actual.data[i + 1] * (1 - opacity) + diff.data[i + 1] * opacity
      );
      overlay.data[i + 2] = Math.round(
        actual.data[i + 2] * (1 - opacity) + diff.data[i + 2] * opacity
      );
      overlay.data[i + 3] = 255;
    } else {
      // Keep original pixel
      overlay.data[i] = actual.data[i];
      overlay.data[i + 1] = actual.data[i + 1];
      overlay.data[i + 2] = actual.data[i + 2];
      overlay.data[i + 3] = actual.data[i + 3];
    }
  }

  return encodeToBase64(overlay);
}

/**
 * Creates a formatted report of visual differences
 */
export function formatVisualDiffReport(result: VisualDiffResult): string {
  const lines: string[] = [];

  lines.push('=== Visual Comparison Report ===');
  lines.push('');
  lines.push(`Status: ${result.passed ? '✓ PASSED' : '✗ FAILED'}`);
  lines.push(`Diff Percentage: ${result.diffPercentage}%`);
  lines.push(`Diff Threshold: ${result.threshold}%`);
  lines.push(
    `Different Pixels: ${result.diffPixelCount.toLocaleString()} / ${result.totalPixels.toLocaleString()}`
  );
  lines.push('');
  lines.push(`Dimensions Match: ${result.dimensionsMatch ? 'Yes' : 'No'}`);
  lines.push(`  Baseline: ${result.baselineDimensions.width}x${result.baselineDimensions.height}`);
  lines.push(`  Actual: ${result.actualDimensions.width}x${result.actualDimensions.height}`);

  if (result.diffImage) {
    lines.push('');
    lines.push('Diff image available (highlighted differences in magenta)');
  }

  return lines.join('\n');
}

/**
 * Quick check if two screenshots are visually identical
 */
export function areScreenshotsEqual(
  baselineImage: string,
  actualImage: string,
  threshold: number = 0
): boolean {
  const result = compareScreenshots(baselineImage, actualImage, {
    threshold: 0.1,
    diffThreshold: threshold,
  });
  return result.passed && result.dimensionsMatch;
}
