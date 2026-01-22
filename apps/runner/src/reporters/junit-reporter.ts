import * as fs from 'node:fs';
import type { ScenarioExecutionResult } from '../types';

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate JUnit XML report from execution results
 */
export function generateJunitReport(results: ScenarioExecutionResult[]): string {
  const totalTests = results.reduce((sum, r) => sum + r.summary.totalSteps, 0);
  const totalFailures = results.reduce((sum, r) => sum + r.summary.failed, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.summary.skipped, 0);
  const totalTime = results.reduce((sum, r) => sum + r.summary.duration, 0);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<testsuites tests="${totalTests}" failures="${totalFailures}" skipped="${totalSkipped}" time="${(totalTime / 1000).toFixed(3)}">\n`;

  for (const result of results) {
    const suiteName = escapeXml(result.scenarioName || result.scenarioId);
    const suiteTests = result.summary.totalSteps;
    const suiteFailures = result.summary.failed;
    const suiteSkipped = result.summary.skipped;
    const suiteTime = (result.summary.duration / 1000).toFixed(3);

    xml += `  <testsuite name="${suiteName}" tests="${suiteTests}" failures="${suiteFailures}" skipped="${suiteSkipped}" time="${suiteTime}">\n`;

    for (const step of result.stepResults) {
      const testName = escapeXml(step.stepId);
      const testTime = (step.duration / 1000).toFixed(3);
      const className = escapeXml(result.scenarioId);

      xml += `    <testcase name="${testName}" classname="${className}" time="${testTime}"`;

      if (step.status === 'passed') {
        xml += ' />\n';
      } else if (step.status === 'skipped') {
        xml += '>\n';
        xml += '      <skipped />\n';
        xml += '    </testcase>\n';
      } else if (step.status === 'failed') {
        xml += '>\n';
        if (step.error) {
          const message = escapeXml(step.error.message);
          const stackTrace = step.error.stack ? escapeXml(step.error.stack) : '';
          xml += `      <failure message="${message}">${stackTrace}</failure>\n`;
        }
        xml += '    </testcase>\n';
      }
    }

    xml += '  </testsuite>\n';
  }

  xml += '</testsuites>\n';
  return xml;
}

/**
 * Write JUnit report to file
 */
export function writeJunitReport(results: ScenarioExecutionResult[], filePath: string): void {
  const report = generateJunitReport(results);
  fs.writeFileSync(filePath, report, 'utf-8');
}
