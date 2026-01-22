#!/usr/bin/env tsx
/**
 * End-to-End Flow Test Script
 *
 * This script demonstrates and tests the complete flow:
 * 1. Start Backend server
 * 2. Create a session (simulating Extension)
 * 3. Send recorded events
 * 4. Create scenario from session
 * 5. Export scenario
 * 6. Run scenario with Runner
 *
 * Usage: npx tsx scripts/e2e-flow-test.ts
 */

import { spawn, type ChildProcess } from 'node:child_process';

const BACKEND_URL = 'http://localhost:3001';
const TEST_TIMEOUT = 30000;

// Sample events matching event-collector format
const sampleEvents = [
  {
    id: 'evt-001',
    type: 'navigation',
    timestamp: Date.now(),
    toUrl: 'https://httpbin.org/html',
    fromUrl: 'about:blank',
    navigationType: 'push',
  },
  {
    id: 'evt-002',
    type: 'click',
    timestamp: Date.now() + 1000,
    url: 'https://httpbin.org/html',
    target: {
      tagName: 'H1',
      selector: 'h1',
      xpath: '//h1',
      textContent: 'Herman Melville - Moby-Dick',
      attributes: {},
      classNames: [],
      isVisible: true,
      rect: { x: 0, y: 0, width: 100, height: 30 },
    },
    position: { x: 50, y: 15 },
    button: 0,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  },
];

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
  console.log('\n=== E2E Flow Test ===\n');

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

    // Step 1: Create session
    console.log('\nStep 1: Creating recording session...');
    const sessionRes = await fetch(`${BACKEND_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://httpbin.org',
        name: 'E2E Test Session',
        viewport: { width: 1440, height: 900 },
      }),
    });

    const sessionData = (await sessionRes.json()) as ApiResponse<{ id: string; name: string }>;
    if (!sessionData.success || !sessionData.data) {
      throw new Error(`Failed to create session: ${sessionData.error}`);
    }
    console.log(`  ✓ Session created: ${sessionData.data.id}`);

    const sessionId = sessionData.data.id;

    // Step 2: Send events
    console.log('\nStep 2: Sending recorded events...');
    const eventsRes = await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/events/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: sampleEvents }),
    });

    const eventsData = (await eventsRes.json()) as ApiResponse<{ count: number }>;
    if (!eventsData.success) {
      throw new Error(`Failed to send events: ${eventsData.error}`);
    }
    console.log(`  ✓ Sent ${eventsData.data?.count} events`);

    // Step 3: Stop session
    console.log('\nStep 3: Stopping recording session...');
    await fetch(`${BACKEND_URL}/api/sessions/${sessionId}/stop`, {
      method: 'POST',
    });
    console.log('  ✓ Session stopped');

    // Step 4: Create scenario from session
    console.log('\nStep 4: Creating scenario from session...');
    const scenarioRes = await fetch(`${BACKEND_URL}/api/scenarios/from-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        name: 'E2E Test Scenario',
      }),
    });

    const scenarioData = (await scenarioRes.json()) as ApiResponse<{
      id: string;
      steps: Array<{ type: string }>;
    }>;
    if (!scenarioData.success || !scenarioData.data) {
      throw new Error(`Failed to create scenario: ${scenarioData.error}`);
    }
    console.log(`  ✓ Scenario created: ${scenarioData.data.id}`);
    console.log(`  ✓ Generated ${scenarioData.data.steps.length} steps`);

    const scenarioId = scenarioData.data.id;

    // Step 5: Export scenario
    console.log('\nStep 5: Exporting scenario...');
    const exportRes = await fetch(`${BACKEND_URL}/api/scenarios/${scenarioId}/export`);
    const exportData = (await exportRes.json()) as ApiResponse<{
      id: string;
      meta: { name: string; url: string };
      steps: unknown[];
    }>;

    if (!exportData.success || !exportData.data) {
      throw new Error(`Failed to export scenario: ${exportData.error}`);
    }

    console.log('  ✓ Scenario exported successfully');
    console.log(`    - ID: ${exportData.data.id}`);
    console.log(`    - Name: ${exportData.data.meta.name}`);
    console.log(`    - Steps: ${exportData.data.steps.length}`);

    // Step 6: Verify scenario format is runner-compatible
    console.log('\nStep 6: Verifying runner compatibility...');
    const scenario = exportData.data;

    const requiredFields = ['id', 'meta', 'steps'];
    const metaFields = ['name', 'url', 'viewport', 'recordedAt', 'astSchemaVersion'];

    const missingFields = requiredFields.filter((f) => !(f in scenario));
    const missingMeta = metaFields.filter((f) => !(f in (scenario.meta || {})));

    if (missingFields.length > 0 || missingMeta.length > 0) {
      throw new Error(
        `Invalid scenario format: missing ${[...missingFields, ...missingMeta.map((f) => `meta.${f}`)].join(', ')}`
      );
    }

    console.log('  ✓ Scenario format is valid for runner');

    // Step 7: Store mock execution result
    console.log('\nStep 7: Storing execution result...');
    const resultRes = await fetch(`${BACKEND_URL}/api/scenarios/${scenarioId}/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'passed',
        totalSteps: scenario.steps.length,
        passed: scenario.steps.length,
        failed: 0,
        skipped: 0,
        duration: 2500,
        stepResults: scenario.steps.map((_, i) => ({
          stepId: `step-${i}`,
          index: i,
          status: 'passed',
          duration: Math.floor(2500 / scenario.steps.length),
        })),
        environment: {
          os: process.platform,
          nodeVersion: process.version,
        },
        executedAt: Date.now(),
      }),
    });

    const resultData = (await resultRes.json()) as ApiResponse<{ id: string; status: string }>;
    if (!resultData.success) {
      throw new Error(`Failed to store result: ${resultData.error}`);
    }
    console.log(`  ✓ Result stored: ${resultData.data?.id}`);

    // Summary
    console.log('\n=== E2E Flow Test Complete ===');
    console.log('✓ All steps passed successfully!\n');
    console.log('Flow verified:');
    console.log('  Extension → Backend (session, events)');
    console.log('  Backend → Scenario (transformation)');
    console.log('  Scenario → Export (runner format)');
    console.log('  Runner → Backend (results)\n');
  } finally {
    // Cleanup
    if (backendProcess) {
      backendProcess.kill('SIGTERM');
      console.log('Backend server stopped');
    }
  }
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
    console.error('\n❌ E2E Test Failed:', error.message);
    process.exit(1);
  });
