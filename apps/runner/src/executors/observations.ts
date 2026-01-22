import type { SnapshotDomStep } from '@like-cake/ast-types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import type { DomSnapshot, ExecutionContext, StepExecutor } from '../types';

/**
 * Execute snapshotDom step
 */
export const executeSnapshotDom: StepExecutor<SnapshotDomStep> = async (step, context) => {
  const { cdpSession, page, options, scenarioId, stepIndex } = context;

  // Default computed styles to capture
  const computedStyles = step.computedStyles ?? [
    'display',
    'visibility',
    'opacity',
    'color',
    'background-color',
    'font-size',
  ];

  // Capture DOM snapshot via CDP
  const snapshot = await cdpSession.send('DOMSnapshot.captureSnapshot', {
    computedStyles,
    includeDOMRects: true,
    includePaintOrder: false,
    includeBlendedBackgroundColors: false,
    includeTextColorOpacities: false,
  });

  const domSnapshot: DomSnapshot = {
    label: step.label,
    documents: snapshot.documents,
    strings: snapshot.strings,
    timestamp: Date.now(),
  };

  // Save snapshot to file if directory specified
  if (options.snapshotDir) {
    const snapshotDir = path.resolve(options.snapshotDir);
    fs.mkdirSync(snapshotDir, { recursive: true });

    const filename = `${scenarioId}_step${stepIndex}_${step.label}.json.gz`;
    const filepath = path.join(snapshotDir, filename);

    // Compress and save
    const jsonData = JSON.stringify(snapshot);
    const compressed = zlib.gzipSync(jsonData);
    fs.writeFileSync(filepath, compressed);

    domSnapshot.screenshotPath = filepath;
  }

  // Capture screenshot if requested
  let screenshotPath: string | undefined;
  if (step.includeScreenshot && options.screenshotDir) {
    const screenshotDir = path.resolve(options.screenshotDir);
    fs.mkdirSync(screenshotDir, { recursive: true });

    const filename = `${scenarioId}_step${stepIndex}_${step.label}.png`;
    screenshotPath = path.join(screenshotDir, filename);

    await page.screenshot({
      path: screenshotPath,
      fullPage: step.fullPage ?? false,
    });

    domSnapshot.screenshotPath = screenshotPath;
  }

  return {
    status: 'passed',
    snapshotPath: domSnapshot.screenshotPath,
    screenshotPath,
  };
};

/**
 * Capture screenshot on failure
 */
export async function captureFailureScreenshot(
  context: ExecutionContext,
  stepIndex: number,
  _error: Error
): Promise<string | undefined> {
  const { page, options, scenarioId } = context;

  if (!options.screenshotOnFailure || !options.screenshotDir) {
    return undefined;
  }

  try {
    const screenshotDir = path.resolve(options.screenshotDir);
    fs.mkdirSync(screenshotDir, { recursive: true });

    const filename = `${scenarioId}_step${stepIndex}_failure.png`;
    const screenshotPath = path.join(screenshotDir, filename);

    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });

    return screenshotPath;
  } catch {
    // Ignore screenshot errors
    return undefined;
  }
}
