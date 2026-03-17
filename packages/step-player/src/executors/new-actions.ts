/**
 * New UI action executors for Phase 4 step types:
 * mouseOut, dragAndDrop, fileUpload, historyBack, historyForward
 */

import type {
  DragAndDropStep,
  FileUploadStep,
  HistoryBackStep,
  HistoryForwardStep,
  MouseOutStep,
} from '@like-cake/ast-types';
import type { ExecutionContext, PlaybackAdapter, StepExecutionResult } from '../types';

/**
 * Execute a mouseOut step — move mouse away from the target element
 */
export async function executeMouseOut(
  step: MouseOutStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    await adapter.mouseOut(step.selector);

    return {
      status: 'passed',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'failed',
      duration: Date.now() - startTime,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

/**
 * Execute a dragAndDrop step — drag source element onto drop target
 */
export async function executeDragAndDrop(
  step: DragAndDropStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    await adapter.dragAndDrop(step.selector, step.dropTarget);

    return {
      status: 'passed',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'failed',
      duration: Date.now() - startTime,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

/**
 * Execute a fileUpload step — set files on a file input element
 */
export async function executeFileUpload(
  step: FileUploadStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    await adapter.uploadFile(step.selector, step.filePaths);

    return {
      status: 'passed',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'failed',
      duration: Date.now() - startTime,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

/**
 * Execute a historyBack step — navigate back in browser history
 */
export async function executeHistoryBack(
  _step: HistoryBackStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    await adapter.goBack();

    return {
      status: 'passed',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'failed',
      duration: Date.now() - startTime,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

/**
 * Execute a historyForward step — navigate forward in browser history
 */
export async function executeHistoryForward(
  _step: HistoryForwardStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    await adapter.goForward();

    return {
      status: 'passed',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'failed',
      duration: Date.now() - startTime,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}
