import type { Step } from '@like-cake/ast-types';
import type {
  ExecutionContext,
  PlaybackAdapter,
  StepExecutionResult,
  StepExecutor,
} from '../types';
import {
  executeAssertApi,
  executeAssertElement,
  executeAssertPage,
  executeAssertStyle,
} from './assertions';
import {
  executeDragAndDrop,
  executeFileUpload,
  executeHistoryBack,
  executeHistoryForward,
  executeMouseOut,
} from './extended-actions';
import { executeNavigate, executeSnapshotDom, executeWait } from './navigation';
import {
  executeClick,
  executeHover,
  executeKeypress,
  executeScroll,
  executeSelect,
  executeType,
} from './ui-actions';

export {
  executeAssertApi,
  executeAssertElement,
  executeAssertPage,
  executeAssertStyle,
} from './assertions';
export {
  executeDragAndDrop,
  executeFileUpload,
  executeHistoryBack,
  executeHistoryForward,
  executeMouseOut,
} from './extended-actions';
export { executeNavigate, executeSnapshotDom, executeWait } from './navigation';
export {
  executeClick,
  executeHover,
  executeKeypress,
  executeScroll,
  executeSelect,
  executeType,
} from './ui-actions';

/**
 * Registry of step executors by step type
 */
const executorRegistry: Record<string, StepExecutor> = {
  navigate: executeNavigate as StepExecutor,
  click: executeClick as StepExecutor,
  type: executeType as StepExecutor,
  keypress: executeKeypress as StepExecutor,
  wait: executeWait as StepExecutor,
  hover: executeHover as StepExecutor,
  scroll: executeScroll as StepExecutor,
  select: executeSelect as StepExecutor,
  mouseOut: executeMouseOut as StepExecutor,
  dragAndDrop: executeDragAndDrop as StepExecutor,
  fileUpload: executeFileUpload as StepExecutor,
  historyBack: executeHistoryBack as StepExecutor,
  historyForward: executeHistoryForward as StepExecutor,
  assertApi: executeAssertApi as StepExecutor,
  assertElement: executeAssertElement as StepExecutor,
  assertPage: executeAssertPage as StepExecutor,
  assertStyle: executeAssertStyle as StepExecutor,
  snapshotDom: executeSnapshotDom as StepExecutor,
};

/**
 * Register a custom step executor
 */
export function registerExecutor(stepType: string, executor: StepExecutor): void {
  executorRegistry[stepType] = executor;
}

/**
 * Get executor for a step type
 */
export function getExecutor(stepType: string): StepExecutor | undefined {
  return executorRegistry[stepType];
}

/**
 * Execute a step using the appropriate executor
 */
export async function executeStep(
  step: Step,
  adapter: PlaybackAdapter,
  context: ExecutionContext
): Promise<StepExecutionResult> {
  const executor = getExecutor(step.type);

  if (!executor) {
    return {
      status: 'failed',
      duration: 0,
      error: {
        message: `No executor found for step type: ${step.type}`,
      },
    };
  }

  // Check for abort signal
  if (context.abortSignal?.aborted) {
    return {
      status: 'skipped',
      duration: 0,
    };
  }

  try {
    return await executor(step, adapter, context);
  } catch (error) {
    return {
      status: 'failed',
      duration: 0,
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}
