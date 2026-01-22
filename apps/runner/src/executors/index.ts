import type { Step, StepType } from '@like-cake/ast-types';
import type { ExecutionContext, StepExecutor, StepResult } from '../types';
import { executeAssertApi, executeAssertElement } from './assertions';
import { captureFailureScreenshot, executeSnapshotDom } from './observations';
import {
  executeClick,
  executeHover,
  executeKeypress,
  executeNavigate,
  executeScroll,
  executeSelect,
  executeType,
  executeWait,
} from './ui-actions';

/**
 * Map of step types to their executors
 * Using type assertion since each executor has a more specific type
 */
const executorMap: Record<StepType, StepExecutor> = {
  navigate: executeNavigate as StepExecutor,
  click: executeClick as StepExecutor,
  type: executeType as StepExecutor,
  keypress: executeKeypress as StepExecutor,
  wait: executeWait as StepExecutor,
  hover: executeHover as StepExecutor,
  scroll: executeScroll as StepExecutor,
  select: executeSelect as StepExecutor,
  assertApi: executeAssertApi as StepExecutor,
  assertElement: executeAssertElement as StepExecutor,
  snapshotDom: executeSnapshotDom as StepExecutor,
};

/**
 * Execute a single step
 */
export async function executeStep(step: Step, context: ExecutionContext): Promise<StepResult> {
  const startTime = Date.now();
  const stepId = step.id ?? `step-${context.stepIndex}`;

  try {
    const executor = executorMap[step.type];
    if (!executor) {
      throw new Error(`Unknown step type: ${step.type}`);
    }

    const partialResult = await executor(step, context);

    return {
      stepId,
      index: context.stepIndex,
      status: partialResult.status ?? 'passed',
      duration: Date.now() - startTime,
      ...partialResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Capture failure screenshot
    const screenshotPath = await captureFailureScreenshot(
      context,
      context.stepIndex,
      error instanceof Error ? error : new Error(errorMessage)
    );

    // Handle optional steps
    if (step.optional) {
      return {
        stepId,
        index: context.stepIndex,
        status: 'skipped',
        duration: Date.now() - startTime,
        error: { message: errorMessage, stack: errorStack },
        screenshotPath,
      };
    }

    return {
      stepId,
      index: context.stepIndex,
      status: 'failed',
      duration: Date.now() - startTime,
      error: { message: errorMessage, stack: errorStack },
      screenshotPath,
    };
  }
}

export {
  executeNavigate,
  executeClick,
  executeType,
  executeKeypress,
  executeWait,
  executeHover,
  executeScroll,
  executeSelect,
  executeAssertApi,
  executeAssertElement,
  executeSnapshotDom,
  captureFailureScreenshot,
};
