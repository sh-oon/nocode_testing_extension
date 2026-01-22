#!/usr/bin/env tsx
/**
 * Extension Simulation Test
 *
 * This script simulates what the Extension does:
 * 1. Check Backend connection
 * 2. Create a session
 * 3. Send recorded events (simulated user interactions)
 * 4. Stop session
 * 5. Create scenario from session
 *
 * Usage: npx tsx scripts/extension-simulation.ts
 */

const BACKEND_URL = 'http://localhost:3001';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Generate unique IDs
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Simulate recorded events from a login form interaction
function createSimulatedEvents() {
  const now = Date.now();
  return [
    // 1. Navigate to login page
    {
      id: `evt-nav-${generateId()}`,
      type: 'navigation',
      timestamp: now,
      toUrl: 'https://example.com/login',
      fromUrl: 'https://example.com/',
      navigationType: 'push',
    },
    // 2. Click on email input
    {
      id: `evt-click-${generateId()}`,
      type: 'click',
      timestamp: now + 500,
      url: 'https://example.com/login',
      target: {
        tagName: 'INPUT',
        selector: 'input[data-testid="email"]',
        xpath: '//input[@data-testid="email"]',
        textContent: '',
        testId: 'email',
        attributes: { 'data-testid': 'email', type: 'email' },
        classNames: ['form-input'],
        isVisible: true,
        rect: { x: 100, y: 200, width: 300, height: 40 },
      },
      position: { x: 250, y: 220 },
      button: 0,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    },
    // 3. Type email (blur captures final value)
    {
      id: `evt-blur-${generateId()}`,
      type: 'blur',
      timestamp: now + 2000,
      url: 'https://example.com/login',
      target: {
        tagName: 'INPUT',
        selector: 'input[data-testid="email"]',
        xpath: '//input[@data-testid="email"]',
        textContent: '',
        testId: 'email',
        attributes: { 'data-testid': 'email', type: 'email' },
        classNames: ['form-input'],
        isVisible: true,
        rect: { x: 100, y: 200, width: 300, height: 40 },
      },
      value: 'user@example.com',
      isSensitive: false,
    },
    // 4. Click on password input
    {
      id: `evt-click2-${generateId()}`,
      type: 'click',
      timestamp: now + 2500,
      url: 'https://example.com/login',
      target: {
        tagName: 'INPUT',
        selector: 'input[data-testid="password"]',
        xpath: '//input[@data-testid="password"]',
        textContent: '',
        testId: 'password',
        attributes: { 'data-testid': 'password', type: 'password' },
        classNames: ['form-input'],
        isVisible: true,
        rect: { x: 100, y: 260, width: 300, height: 40 },
      },
      position: { x: 250, y: 280 },
      button: 0,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    },
    // 5. Type password (sensitive)
    {
      id: `evt-blur2-${generateId()}`,
      type: 'blur',
      timestamp: now + 4000,
      url: 'https://example.com/login',
      target: {
        tagName: 'INPUT',
        selector: 'input[data-testid="password"]',
        xpath: '//input[@data-testid="password"]',
        textContent: '',
        testId: 'password',
        attributes: { 'data-testid': 'password', type: 'password' },
        classNames: ['form-input'],
        isVisible: true,
        rect: { x: 100, y: 260, width: 300, height: 40 },
      },
      value: 'mySecretPassword123',
      isSensitive: true,
    },
    // 6. Click login button
    {
      id: `evt-click3-${generateId()}`,
      type: 'click',
      timestamp: now + 4500,
      url: 'https://example.com/login',
      target: {
        tagName: 'BUTTON',
        selector: 'button[data-testid="login-btn"]',
        xpath: '//button[@data-testid="login-btn"]',
        textContent: 'Sign In',
        testId: 'login-btn',
        attributes: { 'data-testid': 'login-btn', type: 'submit' },
        classNames: ['btn', 'btn-primary'],
        isVisible: true,
        rect: { x: 100, y: 320, width: 300, height: 44 },
      },
      position: { x: 250, y: 342 },
      button: 0,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    },
    // 7. Navigation to dashboard after login
    {
      id: `evt-nav2-${generateId()}`,
      type: 'navigation',
      timestamp: now + 5500,
      toUrl: 'https://example.com/dashboard',
      fromUrl: 'https://example.com/login',
      navigationType: 'push',
    },
  ];
}

async function runSimulation(): Promise<void> {
  console.log('\n🧪 Extension Simulation Test\n');
  console.log('This simulates what the Extension does when recording...\n');

  // Step 1: Check connection
  console.log('Step 1: Checking Backend connection...');
  try {
    const healthRes = await fetch(`${BACKEND_URL}/api/health`);
    if (!healthRes.ok) throw new Error('Backend not reachable');
    console.log('  ✓ Backend is connected\n');
  } catch {
    console.error('  ✗ Backend not running! Start with: yarn workspace @like-cake/backend dev\n');
    process.exit(1);
  }

  // Step 2: Create session (simulating "Start Recording")
  console.log('Step 2: Creating recording session...');
  const sessionRes = await fetch(`${BACKEND_URL}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://example.com/login',
      name: `Extension Simulation - ${new Date().toLocaleString()}`,
      viewport: { width: 1440, height: 900 },
    }),
  });
  const sessionData = (await sessionRes.json()) as ApiResponse<{ id: string; name: string }>;
  if (!sessionData.success) {
    console.error('  ✗ Failed to create session:', sessionData.error);
    process.exit(1);
  }
  const sessionId = sessionData.data!.id;
  console.log(`  ✓ Session created: ${sessionId}`);
  console.log(`  ✓ Name: ${sessionData.data!.name}\n`);

  // Step 3: Send events (simulating user interactions)
  console.log('Step 3: Sending recorded events...');
  const events = createSimulatedEvents();
  console.log('  Simulated user actions:');
  console.log('    1. Navigate to /login');
  console.log('    2. Click email input');
  console.log('    3. Type "user@example.com"');
  console.log('    4. Click password input');
  console.log('    5. Type password (sensitive)');
  console.log('    6. Click "Sign In" button');
  console.log('    7. Navigate to /dashboard\n');

  const eventsRes = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/events/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  });
  const eventsData = (await eventsRes.json()) as ApiResponse<{ count: number }>;
  if (!eventsData.success) {
    console.error('  ✗ Failed to send events:', eventsData.error);
    process.exit(1);
  }
  console.log(`  ✓ Sent ${eventsData.data!.count} events\n`);

  // Step 4: Stop session (simulating "Stop Recording")
  console.log('Step 4: Stopping recording...');
  await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/stop`, { method: 'POST' });
  console.log('  ✓ Recording stopped\n');

  // Step 5: Create scenario from session
  console.log('Step 5: Creating scenario from session...');
  const scenarioRes = await fetch(`${BACKEND_URL}/api/scenarios/from-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      name: 'Login Flow Scenario',
    }),
  });
  const scenarioData = (await scenarioRes.json()) as ApiResponse<{
    id: string;
    name: string;
    steps: Array<{ type: string; selector?: unknown; url?: string; value?: string; sensitive?: boolean }>;
  }>;
  if (!scenarioData.success) {
    console.error('  ✗ Failed to create scenario:', scenarioData.error);
    process.exit(1);
  }

  const scenario = scenarioData.data!;
  console.log(`  ✓ Scenario created: ${scenario.id}`);
  console.log(`  ✓ Name: ${scenario.name}`);
  console.log(`  ✓ Generated ${scenario.steps.length} steps:\n`);

  // Display generated steps
  console.log('  Generated AST Steps:');
  console.log('  ─────────────────────────────────────');
  scenario.steps.forEach((step, i) => {
    let detail = '';
    switch (step.type) {
      case 'navigate':
        detail = step.url || '';
        break;
      case 'click':
        detail = formatSelector(step.selector);
        break;
      case 'type':
        detail = step.sensitive
          ? `${formatSelector(step.selector)} → ********`
          : `${formatSelector(step.selector)} → "${step.value}"`;
        break;
      default:
        detail = JSON.stringify(step);
    }
    console.log(`  ${i + 1}. [${step.type}] ${detail}`);
  });
  console.log('  ─────────────────────────────────────\n');

  // Summary
  console.log('✅ Extension Simulation Complete!\n');
  console.log('What happened:');
  console.log('  • Extension captured 7 raw events (navigation, clicks, blur)');
  console.log('  • Backend transformed events into AST steps');
  console.log('  • Sensitive data (password) marked with sensitive: true');
  console.log('  • Selector strategy: data-testid (highest priority)\n');
  console.log(`Session ID: ${sessionId}`);
  console.log(`Scenario ID: ${scenario.id}`);
  console.log(`Backend URL: ${BACKEND_URL}\n`);
}

function formatSelector(selector: unknown): string {
  if (!selector) return '';
  if (typeof selector === 'string') return selector;
  const sel = selector as { strategy: string; value: string };
  if (sel.strategy === 'testId') return `[data-testid="${sel.value}"]`;
  return sel.value;
}

runSimulation().catch((error) => {
  console.error('Simulation failed:', error);
  process.exit(1);
});
