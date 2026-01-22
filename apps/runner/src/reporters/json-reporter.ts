import * as fs from 'node:fs';
import type { ScenarioExecutionResult } from '../types';

/**
 * Generate JSON report from execution results
 */
export function generateJsonReport(results: ScenarioExecutionResult[]): string {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalScenarios: results.length,
      passed: results.filter((r) => r.summary.success).length,
      failed: results.filter((r) => !r.summary.success).length,
      totalSteps: results.reduce((sum, r) => sum + r.summary.totalSteps, 0),
      totalDuration: results.reduce((sum, r) => sum + r.summary.duration, 0),
    },
    scenarios: results.map((result) => ({
      id: result.scenarioId,
      name: result.scenarioName,
      success: result.summary.success,
      summary: result.summary,
      steps: result.stepResults.map((step) => ({
        id: step.stepId,
        index: step.index,
        status: step.status,
        duration: step.duration,
        error: step.error,
        screenshotPath: step.screenshotPath,
        snapshotPath: step.snapshotPath,
        apiResponse: step.apiResponse,
      })),
      apiCalls: result.apiCalls.map((call) => ({
        url: call.request.url,
        method: call.request.method,
        status: call.response?.status,
        responseTime: call.response?.responseTime,
      })),
      startedAt: new Date(result.startedAt).toISOString(),
      endedAt: new Date(result.endedAt).toISOString(),
    })),
  };

  return JSON.stringify(report, null, 2);
}

/**
 * Write JSON report to file
 */
export function writeJsonReport(results: ScenarioExecutionResult[], filePath: string): void {
  const report = generateJsonReport(results);
  fs.writeFileSync(filePath, report, 'utf-8');
}
