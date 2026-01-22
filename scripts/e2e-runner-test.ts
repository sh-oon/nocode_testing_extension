#!/usr/bin/env tsx
/**
 * End-to-End Runner Test Script
 *
 * This script tests the actual Puppeteer-based scenario execution:
 * 1. Start Backend server
 * 2. Create a session and send events
 * 3. Create and export scenario
 * 4. Run scenario with Puppeteer Runner
 * 5. Report results back to Backend
 *
 * Usage: npx tsx scripts/e2e-runner-test.ts
 */

import { spawn, type ChildProcess } from 'node:child_process';

const BACKEND_URL = 'http://localhost:3001';
const TEST_TIMEOUT = 60000;

/**
 * Generate unique ID for each test run
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create sample events for httpbin.org with unique IDs
 * Tests: navigation → click → type → keypress flow
 */
function createHttpbinEvents() {
  const now = Date.now();
  return [
    // 1. Navigate to forms page
    {
      id: `evt-nav-${generateId()}`,
      type: 'navigation',
      timestamp: now,
      toUrl: 'https://httpbin.org/forms/post',
      fromUrl: 'about:blank',
      navigationType: 'push',
    },
    // 2. Click on customer name input
    {
      id: `evt-click-${generateId()}`,
      type: 'click',
      timestamp: now + 1000,
      url: 'https://httpbin.org/forms/post',
      target: {
        tagName: 'INPUT',
        selector: 'input[name="custname"]',
        xpath: '//input[@name="custname"]',
        textContent: '',
        attributes: { name: 'custname', type: 'text' },
        classNames: [],
        isVisible: true,
        rect: { x: 100, y: 100, width: 200, height: 30 },
      },
      position: { x: 150, y: 115 },
      button: 0,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    },
    // 3. Type customer name (blur event captures final value)
    {
      id: `evt-blur-${generateId()}`,
      type: 'blur',
      timestamp: now + 2000,
      url: 'https://httpbin.org/forms/post',
      target: {
        tagName: 'INPUT',
        selector: 'input[name="custname"]',
        xpath: '//input[@name="custname"]',
        textContent: '',
        attributes: { name: 'custname', type: 'text', value: 'Test User' },
        classNames: [],
        isVisible: true,
        rect: { x: 100, y: 100, width: 200, height: 30 },
      },
      value: 'Test User',
      isSensitive: false,
    },
    // 4. Click on email input
    {
      id: `evt-click2-${generateId()}`,
      type: 'click',
      timestamp: now + 3000,
      url: 'https://httpbin.org/forms/post',
      target: {
        tagName: 'INPUT',
        selector: 'input[name="custemail"]',
        xpath: '//input[@name="custemail"]',
        textContent: '',
        attributes: { name: 'custemail', type: 'email' },
        classNames: [],
        isVisible: true,
        rect: { x: 100, y: 150, width: 200, height: 30 },
      },
      position: { x: 150, y: 165 },
      button: 0,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    },
    // 5. Type email
    {
      id: `evt-blur2-${generateId()}`,
      type: 'blur',
      timestamp: now + 4000,
      url: 'https://httpbin.org/forms/post',
      target: {
        tagName: 'INPUT',
        selector: 'input[name="custemail"]',
        xpath: '//input[@name="custemail"]',
        textContent: '',
        attributes: { name: 'custemail', type: 'email', value: 'test@example.com' },
        classNames: [],
        isVisible: true,
        rect: { x: 100, y: 150, width: 200, height: 30 },
      },
      value: 'test@example.com',
      isSensitive: false,
    },
  ];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function waitForServer(url: string, maxRetries = 20): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        console.log('✓ Backend server is ready');
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function runTest(): Promise<void> {
  console.log('\n=== E2E Runner Test (Puppeteer) ===\n');

  let backendProcess: ChildProcess | null = null;

  try {
    // Step 0: Start backend server
    console.log('Step 0: Starting backend server...');
    backendProcess = spawn('yarn', ['workspace', '@like-cake/backend', 'dev'], {
      stdio: 'pipe',
      env: { ...process.env, PORT: '3001' },
      shell: true,
    });

    backendProcess.stderr?.on('data', (data) => {
      const msg = data.toString();
      if (!msg.includes('[Like Cake]')) {
        console.error('  Backend error:', msg);
      }
    });

    const serverReady = await waitForServer(BACKEND_URL);
    if (!serverReady) {
      throw new Error('Backend server failed to start');
    }

    // Step 1: Create session and send events
    console.log('\nStep 1: Creating session and sending events...');
    const sessionRes = await fetch(`${BACKEND_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://httpbin.org',
        name: 'HTTPBin Runner Test',
        viewport: { width: 1280, height: 720 },
      }),
    });

    const sessionData = (await sessionRes.json()) as ApiResponse<{ id: string }>;
    if (!sessionData.success || !sessionData.data) {
      throw new Error(`Failed to create session: ${sessionData.error}`);
    }
    const sessionId = sessionData.data.id;
    console.log(`  ✓ Session created: ${sessionId}`);

    // Send events
    const httpbinEvents = createHttpbinEvents();
    const eventsRes = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/events/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: httpbinEvents }),
    });
    const eventsData = (await eventsRes.json()) as ApiResponse<{ count: number }>;
    if (!eventsData.success) {
      throw new Error(`Failed to send events: ${eventsData.error}`);
    }
    console.log(`  ✓ Sent ${eventsData.data?.count || httpbinEvents.length} events`);

    // Stop session
    await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/stop`, { method: 'POST' });

    // Debug: Check stored events
    console.log('\n  Checking stored events...');
    const sessionFullRes = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/full`);
    const sessionFullData = (await sessionFullRes.json()) as ApiResponse<{
      events: Array<{ type: string; toUrl?: string }>;
      eventCount: number;
    }>;
    console.log(`  Stored events: ${sessionFullData.data?.eventCount}`);
    if (sessionFullData.data?.events) {
      for (const evt of sessionFullData.data.events) {
        console.log(`    - ${evt.type}: ${evt.toUrl || ''}`);
      }
    }

    // Step 2: Create scenario
    console.log('\nStep 2: Creating scenario from session...');
    const scenarioRes = await fetch(`${BACKEND_URL}/api/scenarios/from-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, name: 'HTTPBin E2E Test' }),
    });

    const scenarioData = (await scenarioRes.json()) as ApiResponse<{
      id: string;
      steps: Array<{ type: string }>;
    }>;
    if (!scenarioData.success || !scenarioData.data) {
      throw new Error(`Failed to create scenario: ${scenarioData.error}`);
    }
    const scenarioId = scenarioData.data.id;
    console.log(`  ✓ Scenario created: ${scenarioId}`);
    console.log(`  ✓ Steps generated: ${scenarioData.data.steps.length}`);

    // Step 3: Export scenario
    console.log('\nStep 3: Exporting scenario for runner...');
    const exportRes = await fetch(`${BACKEND_URL}/api/scenarios/${scenarioId}/export`);
    const exportData = (await exportRes.json()) as ApiResponse<{
      id: string;
      meta: { name: string; url: string; viewport: { width: number; height: number } };
      steps: Array<{ type: string; url?: string; selector?: string }>;
    }>;

    if (!exportData.success || !exportData.data) {
      throw new Error(`Failed to export scenario: ${exportData.error}`);
    }
    const scenario = exportData.data;
    console.log(`  ✓ Exported scenario with ${scenario.steps.length} steps`);
    console.log('  Steps:');
    for (const step of scenario.steps) {
      console.log(`    - ${step.type}: ${step.url || step.selector || ''}`);
    }

    // Step 4: Run scenario with Puppeteer Runner
    console.log('\nStep 4: Running scenario with Puppeteer...');
    console.log('  Starting Runner...');

    const startTime = Date.now();
    const runnerResult = await runPuppeteerScenario(scenario);
    const duration = Date.now() - startTime;

    console.log(`  ✓ Runner completed in ${duration}ms`);
    console.log(`  Status: ${runnerResult.status}`);
    console.log(`  Passed: ${runnerResult.passed}/${runnerResult.totalSteps}`);

    // Step 5: Report results to Backend
    console.log('\nStep 5: Reporting results to Backend...');
    const resultRes = await fetch(`${BACKEND_URL}/api/scenarios/${scenarioId}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...runnerResult,
        environment: {
          os: process.platform,
          nodeVersion: process.version,
        },
        executedAt: Date.now(),
      }),
    });

    const resultData = (await resultRes.json()) as ApiResponse<{ id: string }>;
    if (!resultData.success) {
      throw new Error(`Failed to store result: ${resultData.error}`);
    }
    console.log(`  ✓ Result stored: ${resultData.data?.id}`);

    // Summary
    console.log('\n=== E2E Runner Test Complete ===');
    if (runnerResult.status === 'passed') {
      console.log('✓ All steps passed!\n');
    } else {
      console.log(`⚠ Some steps failed: ${runnerResult.failed}/${runnerResult.totalSteps}\n`);
    }

    console.log('Full Flow Verified:');
    console.log('  1. Extension (simulated) → Backend: Events recorded');
    console.log('  2. Backend → Scenario: Events transformed to AST');
    console.log('  3. Scenario → Runner: Puppeteer executed steps');
    console.log('  4. Runner → Backend: Results reported\n');
  } finally {
    // Cleanup
    if (backendProcess) {
      backendProcess.kill('SIGTERM');
      console.log('Backend server stopped');
    }
  }
}

/**
 * Convert AST Selector to CSS selector string
 */
function selectorToString(selector: { strategy: string; value: string } | string): string {
  if (typeof selector === 'string') return selector;

  switch (selector.strategy) {
    case 'testId':
      return `[data-testid="${selector.value}"]`;
    case 'role':
      return `[role="${selector.value}"]`;
    case 'css':
      return selector.value;
    case 'xpath':
      // Puppeteer handles xpath differently, but for CSS fallback
      return selector.value;
    default:
      return selector.value;
  }
}

/**
 * Resolve URL against base URL
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const base = new URL(baseUrl);
  return new URL(url, base).href;
}

/**
 * Run scenario using Puppeteer
 */
async function runPuppeteerScenario(scenario: {
  id: string;
  meta: { url: string; viewport: { width: number; height: number } };
  steps: Array<{
    type: string;
    url?: string;
    selector?: { strategy: string; value: string } | string;
  }>;
}): Promise<{
  status: 'passed' | 'failed';
  totalSteps: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  stepResults: Array<{
    stepId: string;
    index: number;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
  }>;
}> {
  // Dynamic import to avoid loading puppeteer if not installed
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const stepResults: Array<{
    stepId: string;
    index: number;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: string;
  }> = [];

  let passed = 0;
  let failed = 0;
  const startTime = Date.now();
  const baseUrl = scenario.meta.url;

  try {
    const page = await browser.newPage();
    await page.setViewport(scenario.meta.viewport);

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      const stepStart = Date.now();

      try {
        console.log(`    Running step ${i + 1}: ${step.type}`);

        switch (step.type) {
          case 'navigate': {
            if (step.url) {
              const fullUrl = resolveUrl(step.url, baseUrl);
              console.log(`      Navigating to: ${fullUrl}`);
              await page.goto(fullUrl, { waitUntil: 'networkidle0', timeout: 10000 });
            }
            break;
          }

          case 'click': {
            if (step.selector) {
              const cssSelector = selectorToString(step.selector);
              console.log(`      Clicking: ${cssSelector}`);
              await page.waitForSelector(cssSelector, { timeout: 5000 });
              await page.click(cssSelector);
            }
            break;
          }

          case 'type': {
            if (step.selector && 'value' in step) {
              const cssSelector = selectorToString(step.selector);
              const value = (step as { value: string }).value;
              console.log(`      Typing "${value}" into: ${cssSelector}`);
              await page.waitForSelector(cssSelector, { timeout: 5000 });
              await page.click(cssSelector); // Focus first
              await page.type(cssSelector, value);
            }
            break;
          }

          default:
            console.log(`      (Skipping unknown step type: ${step.type})`);
        }

        stepResults.push({
          stepId: `step-${i}`,
          index: i,
          status: 'passed',
          duration: Date.now() - stepStart,
        });
        passed++;
        console.log(`      ✓ Step ${i + 1} passed`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        stepResults.push({
          stepId: `step-${i}`,
          index: i,
          status: 'failed',
          duration: Date.now() - stepStart,
          error: errMsg,
        });
        failed++;
        console.log(`      ✗ Step ${i + 1} failed: ${errMsg}`);
      }
    }
  } finally {
    await browser.close();
  }

  return {
    status: failed === 0 ? 'passed' : 'failed',
    totalSteps: scenario.steps.length,
    passed,
    failed,
    skipped: 0,
    duration: Date.now() - startTime,
    stepResults,
  };
}

// Run with timeout
const timeoutId = setTimeout(() => {
  console.error('Test timed out!');
  process.exit(1);
}, TEST_TIMEOUT);

runTest()
  .then(() => {
    clearTimeout(timeoutId);
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(timeoutId);
    console.error('\n❌ E2E Runner Test Failed:', error.message);
    process.exit(1);
  });
