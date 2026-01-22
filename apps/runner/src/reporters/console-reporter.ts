import type { ScenarioExecutionResult } from '../types';

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
}

/**
 * Get status icon and color
 */
function getStatusDisplay(status: 'passed' | 'failed' | 'skipped'): {
  icon: string;
  color: string;
} {
  switch (status) {
    case 'passed':
      return { icon: '✓', color: colors.green };
    case 'failed':
      return { icon: '✗', color: colors.red };
    case 'skipped':
      return { icon: '○', color: colors.yellow };
  }
}

/**
 * Report scenario execution result to console
 */
export function reportToConsole(result: ScenarioExecutionResult): void {
  const { summary, stepResults, scenarioId, scenarioName } = result;

  // Header
  console.log('\n');
  console.log(`${colors.bold}Scenario: ${scenarioName || scenarioId}${colors.reset}`);
  console.log(colors.gray + '─'.repeat(60) + colors.reset);

  // Step results
  for (const step of stepResults) {
    const { icon, color } = getStatusDisplay(step.status);
    const duration = `${colors.gray}(${formatDuration(step.duration)})${colors.reset}`;

    console.log(
      `  ${color}${icon}${colors.reset} Step ${step.index + 1}: ${step.stepId} ${duration}`
    );

    if (step.error) {
      console.log(`    ${colors.red}Error: ${step.error.message}${colors.reset}`);
    }

    if (step.screenshotPath) {
      console.log(`    ${colors.gray}Screenshot: ${step.screenshotPath}${colors.reset}`);
    }
  }

  // Summary
  console.log(colors.gray + '─'.repeat(60) + colors.reset);

  const statusColor = summary.success ? colors.green : colors.red;
  const statusText = summary.success ? 'PASSED' : 'FAILED';

  console.log(
    `${statusColor}${colors.bold}${statusText}${colors.reset} ` +
      `| Total: ${summary.totalSteps} ` +
      `| ${colors.green}Passed: ${summary.passed}${colors.reset} ` +
      `| ${colors.red}Failed: ${summary.failed}${colors.reset} ` +
      `| ${colors.yellow}Skipped: ${summary.skipped}${colors.reset} ` +
      `| Duration: ${formatDuration(summary.duration)}`
  );

  console.log('\n');
}

/**
 * Report multiple scenario results to console
 */
export function reportAllToConsole(results: ScenarioExecutionResult[]): void {
  console.log('\n');
  console.log(`${colors.bold}${colors.blue}═══ Test Results ═══${colors.reset}`);

  for (const result of results) {
    reportToConsole(result);
  }

  // Overall summary
  const totalPassed = results.filter((r) => r.summary.success).length;
  const totalFailed = results.filter((r) => !r.summary.success).length;
  const totalDuration = results.reduce((sum, r) => sum + r.summary.duration, 0);

  console.log(colors.bold + '═'.repeat(60) + colors.reset);
  console.log(
    `${colors.bold}Overall:${colors.reset} ` +
      `${colors.green}${totalPassed} passed${colors.reset}, ` +
      `${colors.red}${totalFailed} failed${colors.reset} ` +
      `| Total duration: ${formatDuration(totalDuration)}`
  );
  console.log('\n');
}
