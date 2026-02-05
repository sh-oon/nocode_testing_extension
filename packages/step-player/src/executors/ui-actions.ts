import type {
  ClickStep,
  HoverStep,
  KeypressStep,
  ScrollStep,
  SelectStep,
  TypeStep,
} from '@like-cake/ast-types';
import type { ExecutionContext, PlaybackAdapter, StepExecutionResult } from '../types';

/**
 * Execute a click step
 */
export async function executeClick(
  step: ClickStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    await adapter.click(step.selector, {
      button: step.button,
      clickCount: step.clickCount,
      position: step.position,
      modifiers: step.modifiers,
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
    return `\${${varName}}`; // Keep unresolved variables as-is
  });
}

/**
 * Execute a type step
 */
export async function executeType(
  step: TypeStep,
  adapter: PlaybackAdapter,
  context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    // Substitute variables in the value
    const value = substituteVariables(step.value, context.variables);

    await adapter.type(step.selector, value, {
      clear: step.clear,
      delay: step.delay ? step.delay / context.speedMultiplier : undefined,
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
 * Execute a keypress step
 */
export async function executeKeypress(
  step: KeypressStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    await adapter.keypress(step.key, step.selector, step.modifiers);

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
 * Execute a hover step
 */
export async function executeHover(
  step: HoverStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    await adapter.hover(step.selector, step.position);

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
 * Execute a scroll step
 */
export async function executeScroll(
  step: ScrollStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    await adapter.scroll(step.selector, {
      behavior: step.behavior,
      position: step.position,
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
 * Execute a select step
 */
export async function executeSelect(
  step: SelectStep,
  adapter: PlaybackAdapter,
  _context: ExecutionContext
): Promise<StepExecutionResult> {
  const startTime = Date.now();

  try {
    await adapter.select(step.selector, step.values);

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
