import type {
  ClickStep,
  HoverStep,
  KeypressStep,
  NavigateStep,
  ScrollStep,
  SelectStep,
  TypeStep,
  WaitStep,
} from '@like-cake/ast-types';
import type { KeyInput } from 'puppeteer';
import type { StepExecutor } from '../types';
import { findElement, toSelectorString, waitForElement } from './selector-utils';

/**
 * Execute navigate step
 */
export const executeNavigate: StepExecutor<NavigateStep> = async (step, context) => {
  const { page, options } = context;

  // Resolve URL (handle relative URLs with baseUrl)
  let url = step.url;
  if (options.baseUrl && !url.startsWith('http')) {
    url = new URL(url, options.baseUrl).href;
  }

  await page.goto(url, {
    waitUntil: step.waitUntil ?? 'networkidle2',
    timeout: step.timeout ?? options.defaultTimeout ?? 30000,
  });

  return { status: 'passed' };
};

/**
 * Execute click step
 */
export const executeClick: StepExecutor<ClickStep> = async (step, context) => {
  const { page, options } = context;

  const element = await findElement(page, step.selector, step.timeout ?? options.defaultTimeout);

  if (!element) {
    throw new Error(`Element not found: ${toSelectorString(step.selector)}`);
  }

  const clickOptions: {
    button?: 'left' | 'right' | 'middle';
    count?: number;
    offset?: { x: number; y: number };
  } = {
    button: step.button ?? 'left',
    count: step.clickCount ?? 1,
  };

  if (step.position) {
    clickOptions.offset = step.position;
  }

  // Handle modifier keys
  if (step.modifiers?.length) {
    for (const modifier of step.modifiers) {
      await page.keyboard.down(modifier);
    }
  }

  await element.click(clickOptions);

  // Release modifier keys
  if (step.modifiers?.length) {
    for (const modifier of step.modifiers) {
      await page.keyboard.up(modifier);
    }
  }

  return { status: 'passed' };
};

/**
 * Execute type step
 */
export const executeType: StepExecutor<TypeStep> = async (step, context) => {
  const { page, options, variables } = context;

  const element = await findElement(page, step.selector, step.timeout ?? options.defaultTimeout);

  if (!element) {
    throw new Error(`Element not found: ${toSelectorString(step.selector)}`);
  }

  // Clear existing content if requested
  if (step.clear) {
    await element.click({ count: 3 }); // Select all
    await page.keyboard.press('Backspace');
  }

  // Replace variables in value
  let value = step.value;
  for (const [key, val] of Object.entries(variables)) {
    value = value.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(val));
  }

  await element.type(value, {
    delay: step.delay ?? 0,
  });

  return { status: 'passed' };
};

/**
 * Execute keypress step
 */
export const executeKeypress: StepExecutor<KeypressStep> = async (step, context) => {
  const { page, options } = context;

  // Focus element if selector provided
  if (step.selector) {
    const element = await findElement(page, step.selector, step.timeout ?? options.defaultTimeout);
    if (element) {
      await element.focus();
    }
  }

  // Handle modifier keys
  if (step.modifiers?.length) {
    for (const modifier of step.modifiers) {
      await page.keyboard.down(modifier);
    }
  }

  await page.keyboard.press(step.key as KeyInput);

  // Release modifier keys
  if (step.modifiers?.length) {
    for (const modifier of step.modifiers) {
      await page.keyboard.up(modifier);
    }
  }

  return { status: 'passed' };
};

/**
 * Execute wait step
 */
export const executeWait: StepExecutor<WaitStep> = async (step, context) => {
  const { page, options } = context;

  switch (step.strategy) {
    case 'time':
      await new Promise((resolve) => setTimeout(resolve, step.duration ?? 1000));
      break;

    case 'selector':
      if (!step.selector) {
        throw new Error('Selector required for selector wait strategy');
      }
      await waitForElement(
        page,
        step.selector,
        step.state ?? 'visible',
        step.timeout ?? options.defaultTimeout
      );
      break;

    case 'navigation':
      await page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: step.timeout ?? options.defaultTimeout ?? 30000,
      });
      break;

    case 'networkIdle':
      await page.waitForNetworkIdle({
        timeout: step.timeout ?? options.defaultTimeout ?? 30000,
      });
      break;
  }

  return { status: 'passed' };
};

/**
 * Execute hover step
 */
export const executeHover: StepExecutor<HoverStep> = async (step, context) => {
  const { page, options } = context;

  const element = await findElement(page, step.selector, step.timeout ?? options.defaultTimeout);

  if (!element) {
    throw new Error(`Element not found: ${toSelectorString(step.selector)}`);
  }

  await element.hover();

  return { status: 'passed' };
};

/**
 * Execute scroll step
 */
export const executeScroll: StepExecutor<ScrollStep> = async (step, context) => {
  const { page, options } = context;

  if (step.selector) {
    const element = await findElement(page, step.selector, step.timeout ?? options.defaultTimeout);

    if (element) {
      await element.scrollIntoView();
    }
  } else if (step.position) {
    const pos = step.position;
    const behavior = step.behavior ?? 'auto';
    await page.evaluate(
      (scrollPos: { x?: number; y?: number }, scrollBehavior: string) => {
        window.scrollTo({
          left: scrollPos.x ?? window.scrollX,
          top: scrollPos.y ?? window.scrollY,
          behavior: scrollBehavior as ScrollBehavior,
        });
      },
      pos,
      behavior
    );
  }

  return { status: 'passed' };
};

/**
 * Execute select step
 */
export const executeSelect: StepExecutor<SelectStep> = async (step, context) => {
  const { page, options } = context;

  const selectorString = toSelectorString(step.selector);

  await page.waitForSelector(selectorString, {
    visible: true,
    timeout: step.timeout ?? options.defaultTimeout ?? 30000,
  });

  const values = Array.isArray(step.values) ? step.values : [step.values];
  await page.select(selectorString, ...values);

  return { status: 'passed' };
};
