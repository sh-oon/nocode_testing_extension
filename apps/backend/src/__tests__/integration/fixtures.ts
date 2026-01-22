import type { RawEvent } from '@like-cake/event-collector';

/**
 * Sample raw events representing a login flow recording
 * These events simulate what the Extension would capture
 *
 * Event format follows @like-cake/event-collector types
 */
export const loginFlowEvents: RawEvent[] = [
  // Navigate to login page
  {
    id: 'evt-001',
    type: 'navigation',
    timestamp: 1704067200000,
    toUrl: 'https://example.com/login',
    fromUrl: 'https://example.com/',
    navigationType: 'push',
  },

  // Click on email input
  {
    id: 'evt-002',
    type: 'click',
    timestamp: 1704067201000,
    url: 'https://example.com/login',
    target: {
      tagName: 'INPUT',
      selector: '[data-testid="email-input"]',
      xpath: '//input[@data-testid="email-input"]',
      textContent: '',
      attributes: {
        type: 'email',
        'data-testid': 'email-input',
        placeholder: 'Enter your email',
      },
      classNames: ['form-input', 'email-field'],
      isVisible: true,
      rect: { x: 100, y: 200, width: 300, height: 40 },
    },
    position: { x: 250, y: 220 },
    button: 0,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  },

  // Type email (blur event captures final value)
  {
    id: 'evt-003',
    type: 'blur',
    timestamp: 1704067202000,
    url: 'https://example.com/login',
    target: {
      tagName: 'INPUT',
      selector: '[data-testid="email-input"]',
      xpath: '//input[@data-testid="email-input"]',
      textContent: '',
      attributes: {
        type: 'email',
        'data-testid': 'email-input',
        value: 'test@example.com',
      },
      classNames: ['form-input', 'email-field'],
      isVisible: true,
      rect: { x: 100, y: 200, width: 300, height: 40 },
    },
    value: 'test@example.com',
    isSensitive: false,
  },

  // Click on password input
  {
    id: 'evt-004',
    type: 'click',
    timestamp: 1704067203000,
    url: 'https://example.com/login',
    target: {
      tagName: 'INPUT',
      selector: '[data-testid="password-input"]',
      xpath: '//input[@data-testid="password-input"]',
      textContent: '',
      attributes: {
        type: 'password',
        'data-testid': 'password-input',
        placeholder: 'Enter your password',
      },
      classNames: ['form-input', 'password-field'],
      isVisible: true,
      rect: { x: 100, y: 260, width: 300, height: 40 },
    },
    position: { x: 250, y: 280 },
    button: 0,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  },

  // Type password (blur event captures final value)
  {
    id: 'evt-005',
    type: 'blur',
    timestamp: 1704067204000,
    url: 'https://example.com/login',
    target: {
      tagName: 'INPUT',
      selector: '[data-testid="password-input"]',
      xpath: '//input[@data-testid="password-input"]',
      textContent: '',
      attributes: {
        type: 'password',
        'data-testid': 'password-input',
        value: '••••••••',
      },
      classNames: ['form-input', 'password-field'],
      isVisible: true,
      rect: { x: 100, y: 260, width: 300, height: 40 },
    },
    value: 'secretpassword123',
    isSensitive: true,
  },

  // Click login button
  {
    id: 'evt-006',
    type: 'click',
    timestamp: 1704067205000,
    url: 'https://example.com/login',
    target: {
      tagName: 'BUTTON',
      selector: '[data-testid="login-button"]',
      xpath: '//button[@data-testid="login-button"]',
      textContent: 'Sign In',
      attributes: {
        type: 'submit',
        'data-testid': 'login-button',
      },
      classNames: ['btn', 'btn-primary'],
      isVisible: true,
      rect: { x: 100, y: 320, width: 300, height: 44 },
    },
    position: { x: 250, y: 342 },
    button: 0,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  },

  // Navigation after login
  {
    id: 'evt-007',
    type: 'navigation',
    timestamp: 1704067206000,
    toUrl: 'https://example.com/dashboard',
    fromUrl: 'https://example.com/login',
    navigationType: 'push',
  },
];

/**
 * Sample raw events for a search flow
 */
export const searchFlowEvents: RawEvent[] = [
  {
    id: 'evt-s01',
    type: 'click',
    timestamp: 1704067300000,
    url: 'https://example.com',
    target: {
      tagName: 'INPUT',
      selector: '[data-testid="search-input"]',
      xpath: '//input[@data-testid="search-input"]',
      textContent: '',
      attributes: {
        type: 'search',
        'data-testid': 'search-input',
        placeholder: 'Search...',
      },
      classNames: ['search-box'],
      isVisible: true,
      rect: { x: 500, y: 20, width: 250, height: 36 },
    },
    position: { x: 625, y: 38 },
    button: 0,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  },
  {
    id: 'evt-s02',
    type: 'blur',
    timestamp: 1704067301000,
    url: 'https://example.com',
    target: {
      tagName: 'INPUT',
      selector: '[data-testid="search-input"]',
      xpath: '//input[@data-testid="search-input"]',
      textContent: '',
      attributes: {
        type: 'search',
        'data-testid': 'search-input',
        value: 'test query',
      },
      classNames: ['search-box'],
      isVisible: true,
      rect: { x: 500, y: 20, width: 250, height: 36 },
    },
    value: 'test query',
    isSensitive: false,
  },
  {
    id: 'evt-s03',
    type: 'keydown',
    timestamp: 1704067302000,
    url: 'https://example.com',
    target: {
      tagName: 'INPUT',
      selector: '[data-testid="search-input"]',
      xpath: '//input[@data-testid="search-input"]',
      textContent: '',
      attributes: {
        type: 'search',
        'data-testid': 'search-input',
      },
      classNames: ['search-box'],
      isVisible: true,
      rect: { x: 500, y: 20, width: 250, height: 36 },
    },
    key: 'Enter',
    code: 'Enter',
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  },
];

/**
 * Expected steps from loginFlowEvents
 * (This is what the backend should produce after transformation)
 */
export const expectedLoginFlowSteps = [
  { type: 'navigate', url: '/login' },
  {
    type: 'click',
    selector: { strategy: 'testId', value: 'email-input' },
  },
  {
    type: 'type',
    selector: { strategy: 'testId', value: 'email-input' },
    value: 'test@example.com',
  },
  {
    type: 'click',
    selector: { strategy: 'testId', value: 'password-input' },
  },
  {
    type: 'type',
    selector: { strategy: 'testId', value: 'password-input' },
    value: 'secretpassword123',
    sensitive: true,
  },
  {
    type: 'click',
    selector: { strategy: 'testId', value: 'login-button' },
  },
  { type: 'navigate', url: '/dashboard' },
];

/**
 * Session creation input matching Extension format
 */
export const sampleSessionInput = {
  url: 'https://example.com/login',
  name: 'Login Flow Test',
  viewport: {
    width: 1440,
    height: 900,
  },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

/**
 * Complete scenario for runner testing
 */
export const sampleScenarioForRunner = {
  id: 'scenario-test-login',
  name: 'Login Flow Test',
  description: 'Test user login with email and password',
  meta: {
    url: 'https://example.com',
    viewport: { width: 1440, height: 900 },
    recordedAt: '2024-01-01T00:00:00.000Z',
    astSchemaVersion: '1.0.0',
  },
  steps: [
    {
      type: 'navigate' as const,
      url: 'https://example.com/login',
    },
    {
      type: 'type' as const,
      selector: '[data-testid="email-input"]',
      value: 'test@example.com',
    },
    {
      type: 'type' as const,
      selector: '[data-testid="password-input"]',
      value: 'testpassword123',
    },
    {
      type: 'click' as const,
      selector: '[data-testid="login-button"]',
    },
  ],
  variables: {
    email: 'test@example.com',
    password: 'testpassword123',
  },
};
