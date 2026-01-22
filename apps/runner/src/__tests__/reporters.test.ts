import { describe, expect, it } from 'vitest';
import { generateJsonReport, generateJunitReport } from '../reporters';
import type { ScenarioExecutionResult } from '../types';

const mockResult: ScenarioExecutionResult = {
  scenarioId: 'scenario-test-001',
  scenarioName: 'Test Scenario',
  stepResults: [
    {
      stepId: 'step-1',
      index: 0,
      status: 'passed',
      duration: 100,
    },
    {
      stepId: 'step-2',
      index: 1,
      status: 'passed',
      duration: 200,
    },
    {
      stepId: 'step-3',
      index: 2,
      status: 'failed',
      duration: 50,
      error: {
        message: 'Element not found',
        stack: 'Error: Element not found\n    at test.ts:10',
      },
    },
  ],
  summary: {
    totalSteps: 3,
    passed: 2,
    failed: 1,
    skipped: 0,
    duration: 350,
    success: false,
  },
  snapshots: [],
  apiCalls: [
    {
      request: {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {},
        timestamp: 1000,
      },
      response: {
        url: 'https://api.example.com/users',
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { users: [] },
        responseTime: 150,
        timestamp: 1150,
      },
    },
  ],
  startedAt: Date.now() - 1000,
  endedAt: Date.now(),
};

describe('generateJsonReport', () => {
  it('should generate valid JSON report', () => {
    const json = generateJsonReport([mockResult]);
    const report = JSON.parse(json);

    expect(report.summary.totalScenarios).toBe(1);
    expect(report.summary.passed).toBe(0);
    expect(report.summary.failed).toBe(1);
    expect(report.scenarios).toHaveLength(1);
    expect(report.scenarios[0].id).toBe('scenario-test-001');
    expect(report.scenarios[0].steps).toHaveLength(3);
    expect(report.scenarios[0].apiCalls).toHaveLength(1);
  });

  it('should include timestamp', () => {
    const json = generateJsonReport([mockResult]);
    const report = JSON.parse(json);

    expect(report.timestamp).toBeDefined();
    expect(new Date(report.timestamp).getTime()).not.toBeNaN();
  });
});

describe('generateJunitReport', () => {
  it('should generate valid JUnit XML', () => {
    const xml = generateJunitReport([mockResult]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<testsuites');
    expect(xml).toContain('<testsuite name="Test Scenario"');
    expect(xml).toContain('<testcase name="step-1"');
    expect(xml).toContain('<testcase name="step-3"');
    expect(xml).toContain('<failure message="Element not found"');
    expect(xml).toContain('</testsuites>');
  });

  it('should include correct counts', () => {
    const xml = generateJunitReport([mockResult]);

    expect(xml).toContain('tests="3"');
    expect(xml).toContain('failures="1"');
    expect(xml).toContain('skipped="0"');
  });

  it('should escape XML special characters', () => {
    const resultWithSpecialChars: ScenarioExecutionResult = {
      ...mockResult,
      scenarioName: 'Test <Scenario> & "Quotes"',
      stepResults: [
        {
          stepId: 'step-1',
          index: 0,
          status: 'failed',
          duration: 100,
          error: {
            message: 'Error with <tags> & "quotes"',
          },
        },
      ],
      summary: {
        totalSteps: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: 100,
        success: false,
      },
    };

    const xml = generateJunitReport([resultWithSpecialChars]);

    expect(xml).toContain('&lt;Scenario&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;Quotes&quot;');
    expect(xml).not.toContain('<Scenario>');
  });
});
