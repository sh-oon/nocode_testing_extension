import { describe, expect, it } from 'vitest';
import { mergeTypeSteps, transformEventsToSteps, transformEventToStep } from '../transformer';
import type {
  InputEventData,
  KeyboardEventData,
  MouseEventData,
  NavigationEventData,
  ScrollEventData,
} from '../types';

describe('transformEventToStep', () => {
  const mockElementInfo = {
    tagName: 'button',
    classNames: ['btn'],
    testId: 'submit-btn',
    attributes: {},
  };

  describe('click events', () => {
    it('should transform click event to ClickStep', () => {
      const event: MouseEventData = {
        type: 'click',
        id: 'evt-1',
        timestamp: Date.now(),
        target: mockElementInfo,
        url: 'http://example.com',
        button: 0,
        position: { x: 10, y: 20 },
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      };

      const step = transformEventToStep(event);

      expect(step).not.toBeNull();
      expect(step?.type).toBe('click');
      if (step?.type === 'click') {
        expect(step.selector).toBeDefined();
      }
    });

    it('should include modifiers when present', () => {
      const event: MouseEventData = {
        type: 'click',
        id: 'evt-1',
        timestamp: Date.now(),
        target: mockElementInfo,
        url: 'http://example.com',
        button: 0,
        position: { x: 10, y: 20 },
        modifiers: { alt: false, ctrl: true, meta: false, shift: true },
      };

      const step = transformEventToStep(event);

      expect(step?.type).toBe('click');
      if (step?.type === 'click') {
        expect(step.modifiers).toContain('Control');
        expect(step.modifiers).toContain('Shift');
      }
    });

    it('should set clickCount for double-clicks', () => {
      const event: MouseEventData = {
        type: 'dblclick',
        id: 'evt-1',
        timestamp: Date.now(),
        target: mockElementInfo,
        url: 'http://example.com',
        button: 0,
        position: { x: 10, y: 20 },
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      };

      const step = transformEventToStep(event);

      if (step?.type === 'click') {
        expect(step.clickCount).toBe(2);
      }
    });
  });

  describe('input events', () => {
    const mockInputElement = {
      tagName: 'input',
      classNames: [],
      testId: 'email-input',
      attributes: { type: 'text' },
    };

    it('should transform blur event to TypeStep', () => {
      const event: InputEventData = {
        type: 'blur',
        id: 'evt-1',
        timestamp: Date.now(),
        target: mockInputElement,
        url: 'http://example.com',
        value: 'test@example.com',
        inputType: 'text',
        isSensitive: false,
      };

      const step = transformEventToStep(event);

      expect(step).not.toBeNull();
      expect(step?.type).toBe('type');
      if (step?.type === 'type') {
        expect(step.value).toBe('test@example.com');
      }
    });

    it('should mark sensitive inputs', () => {
      const event: InputEventData = {
        type: 'blur',
        id: 'evt-1',
        timestamp: Date.now(),
        target: mockInputElement,
        url: 'http://example.com',
        value: '********',
        inputType: 'password',
        isSensitive: true,
      };

      const step = transformEventToStep(event);

      if (step?.type === 'type') {
        expect(step.sensitive).toBe(true);
      }
    });

    it('should ignore input events (not blur/change)', () => {
      const event: InputEventData = {
        type: 'input',
        id: 'evt-1',
        timestamp: Date.now(),
        target: mockInputElement,
        url: 'http://example.com',
        value: 'typing...',
        inputType: 'text',
        isSensitive: false,
      };

      const step = transformEventToStep(event);

      expect(step).toBeNull();
    });
  });

  describe('keyboard events', () => {
    it('should transform Enter key to KeypressStep', () => {
      const event: KeyboardEventData = {
        type: 'keydown',
        id: 'evt-1',
        timestamp: Date.now(),
        target: mockElementInfo,
        url: 'http://example.com',
        key: 'Enter',
        code: 'Enter',
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      };

      const step = transformEventToStep(event);

      expect(step).not.toBeNull();
      expect(step?.type).toBe('keypress');
      if (step?.type === 'keypress') {
        expect(step.key).toBe('Enter');
      }
    });

    it('should capture keyboard shortcuts', () => {
      const event: KeyboardEventData = {
        type: 'keydown',
        id: 'evt-1',
        timestamp: Date.now(),
        target: mockElementInfo,
        url: 'http://example.com',
        key: 's',
        code: 'KeyS',
        modifiers: { alt: false, ctrl: true, meta: false, shift: false },
      };

      const step = transformEventToStep(event);

      expect(step).not.toBeNull();
      if (step?.type === 'keypress') {
        expect(step.key).toBe('s');
        expect(step.modifiers).toContain('Control');
      }
    });

    it('should ignore regular typing keys', () => {
      const event: KeyboardEventData = {
        type: 'keydown',
        id: 'evt-1',
        timestamp: Date.now(),
        target: mockElementInfo,
        url: 'http://example.com',
        key: 'a',
        code: 'KeyA',
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      };

      const step = transformEventToStep(event);

      expect(step).toBeNull();
    });
  });

  describe('scroll events', () => {
    it('should transform scroll event to ScrollStep', () => {
      const event: ScrollEventData = {
        type: 'scroll',
        id: 'evt-1',
        timestamp: Date.now(),
        target: { tagName: 'div', classNames: [], attributes: {} },
        url: 'http://example.com',
        position: { x: 0, y: 500 },
        delta: { x: 0, y: 100 },
      };

      const step = transformEventToStep(event);

      expect(step).not.toBeNull();
      expect(step?.type).toBe('scroll');
      if (step?.type === 'scroll') {
        expect(step.position?.y).toBe(500);
      }
    });
  });

  describe('navigation events', () => {
    it('should transform navigation event to NavigateStep', () => {
      const event: NavigationEventData = {
        type: 'navigation',
        id: 'evt-1',
        timestamp: Date.now(),
        url: 'http://example.com/dashboard',
        toUrl: 'http://example.com/dashboard',
        fromUrl: 'http://example.com/home',
        navigationType: 'push',
      };

      const step = transformEventToStep(event);

      expect(step).not.toBeNull();
      expect(step?.type).toBe('navigate');
      if (step?.type === 'navigate') {
        expect(step.url).toBe('/dashboard');
      }
    });
  });
});

describe('transformEventsToSteps', () => {
  it('should transform multiple events', () => {
    const events = [
      {
        type: 'navigation' as const,
        id: 'evt-1',
        timestamp: Date.now(),
        url: 'http://example.com/login',
        toUrl: 'http://example.com/login',
        navigationType: 'push' as const,
      },
      {
        type: 'click' as const,
        id: 'evt-2',
        timestamp: Date.now(),
        target: { tagName: 'button', classNames: [], testId: 'login-btn', attributes: {} },
        url: 'http://example.com/login',
        button: 0,
        position: { x: 0, y: 0 },
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      },
    ];

    const steps = transformEventsToSteps(events);

    expect(steps.length).toBe(2);
    expect(steps[0].type).toBe('navigate');
    expect(steps[1].type).toBe('click');
  });
});

describe('mergeTypeSteps', () => {
  it('should merge consecutive type steps on same element', () => {
    const steps = [
      {
        type: 'type' as const,
        selector: { strategy: 'testId' as const, value: 'email' },
        value: 'a',
      },
      {
        type: 'type' as const,
        selector: { strategy: 'testId' as const, value: 'email' },
        value: 'ab',
      },
      {
        type: 'type' as const,
        selector: { strategy: 'testId' as const, value: 'email' },
        value: 'abc',
      },
    ];

    const merged = mergeTypeSteps(steps);

    expect(merged.length).toBe(1);
    if (merged[0].type === 'type') {
      expect(merged[0].value).toBe('abc');
    }
  });

  it('should not merge type steps on different elements', () => {
    const steps = [
      {
        type: 'type' as const,
        selector: { strategy: 'testId' as const, value: 'email' },
        value: 'test@example.com',
      },
      {
        type: 'type' as const,
        selector: { strategy: 'testId' as const, value: 'password' },
        value: 'secret',
      },
    ];

    const merged = mergeTypeSteps(steps);

    expect(merged.length).toBe(2);
  });

  it('should not merge non-type steps', () => {
    const steps = [
      { type: 'click' as const, selector: { strategy: 'testId' as const, value: 'btn1' } },
      { type: 'click' as const, selector: { strategy: 'testId' as const, value: 'btn1' } },
    ];

    const merged = mergeTypeSteps(steps);

    expect(merged.length).toBe(2);
  });
});
