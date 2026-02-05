import type { NavigateStep, SnapshotDomStep, WaitStep } from '@like-cake/ast-types';
import type { ScreenshotResult } from '@like-cake/dom-serializer';
import type { ExecutionContext, PlaybackAdapter, StepExecutionResult } from '../types';

/**
 * Substitutes variables in a string value
 */
function substituteVariables(
  value: string,
  variables: Record<string, string | number | boolean>
): string {
  return value.replace(/\$\{(\w+)\}/g, (_, varName) => {
    if (varName in variables) {
      return String(variables[varName]);
    }
    return `\${${varName}}`;
  });
}

/**
 * Execute a navigate step
 */
export async function executeNavigate(
  step: NavigateStep,
  adapter: PlaybackAdapter,
  context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    const url = substituteVariables(step.url, context.variables);
    const timeout = step.timeout ?? context.defaultTimeout;

    await adapter.navigate(url, {
      waitUntil: step.waitUntil,
      timeout,
    });

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
 * Execute a wait step
 */
export async function executeWait(
  step: WaitStep,
  adapter: PlaybackAdapter,
  context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();
  const timeout = step.timeout ?? context.defaultTimeout;

  try {
    switch (step.strategy) {
      case 'time': {
        const duration = step.duration ?? 1000;
        // Adjust wait time based on speed multiplier
        await adapter.wait(duration / context.speedMultiplier);
        break;
      }

      case 'selector': {
        if (!step.selector) {
          throw new Error('Selector is required for selector wait strategy');
        }
        await adapter.waitForSelector(step.selector, step.state, { timeout });
        break;
      }

      case 'navigation': {
        await adapter.waitForNavigation({ timeout });
        break;
      }

      case 'networkIdle': {
        await adapter.waitForNetworkIdle({ timeout });
        break;
      }

      default:
        throw new Error(`Unknown wait strategy: ${step.strategy}`);
    }

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
 * Execute a snapshot DOM step
 */
export async function executeSnapshotDom(
  step: SnapshotDomStep,
  adapter: PlaybackAdapter,
  context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    // Capture DOM snapshot
    const snapshot = await adapter.captureSnapshot({
      computedStyles: step.computedStyles,
      fullPage: step.fullPage,
    });

    // Capture screenshot if requested
    let screenshot: ScreenshotResult | undefined;
    if (step.includeScreenshot) {
      screenshot = await adapter.captureScreenshot({
        fullPage: step.fullPage,
      });
    }

    // Store in context
    context.snapshots.push({
      label: step.label,
      snapshot,
      screenshot,
    });

    return {
      status: 'passed',
      duration: Date.now() - startTime,
      snapshot,
      screenshot,
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
