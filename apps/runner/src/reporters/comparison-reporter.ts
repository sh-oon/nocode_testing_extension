import type { ComparisonResult } from '../comparison-runner';

/**
 * Comparison report in JSON format
 */
export interface ComparisonJsonReport {
  /** Report generation timestamp */
  generatedAt: string;
  /** Overall summary */
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: string;
  };
  /** Individual comparison results */
  results: Array<{
    scenarioId: string;
    passed: boolean;
    execution: {
      passed: boolean;
      duration: number;
      stepsTotal: number;
      stepsPassed: number;
      stepsFailed: number;
    };
    api: {
      compared: boolean;
      passed: boolean;
      matched: number;
      different: number;
      missing: number;
      extra: number;
    };
    dom: {
      compared: boolean;
      passed: boolean;
      snapshotsCompared: number;
      totalDiffs: number;
    };
    visual: {
      compared: boolean;
      passed: boolean;
      screenshotsCompared: number;
      maxDiffPercentage: number;
    };
  }>;
}

/**
 * Generate JSON report from comparison results
 */
export function generateComparisonJsonReport(
  results: ComparisonResult[]
): ComparisonJsonReport {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const passRate = results.length > 0 ? ((passed / results.length) * 100).toFixed(1) : '0';

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      passed,
      failed,
      passRate: `${passRate}%`,
    },
    results: results.map((result) => {
      const apiComparison = result.apiComparison;
      const apiMatched = apiComparison?.summary?.matched ?? 0;
      const apiDifferent = apiComparison?.summary?.different ?? 0;
      const apiMissing = apiComparison?.summary?.missing ?? 0;
      const apiExtra = apiComparison?.summary?.extra ?? 0;

      const domComparisons = result.domComparisons;
      const totalDomDiffs = domComparisons.reduce(
        (sum, c) => sum + c.result.differences.length,
        0
      );

      const visualComparisons = result.visualComparisons;
      const maxDiffPercentage =
        visualComparisons.length > 0
          ? Math.max(...visualComparisons.map((c) => c.result.diffPercentage))
          : 0;

      return {
        scenarioId: result.scenarioId,
        passed: result.passed,
        execution: {
          passed: result.playbackResult.success,
          duration: result.playbackResult.endTime - result.playbackResult.startTime,
          stepsTotal: result.playbackResult.summary.totalSteps,
          stepsPassed: result.playbackResult.summary.passed,
          stepsFailed: result.playbackResult.summary.failed,
        },
        api: {
          compared: !!apiComparison,
          passed: !apiComparison || apiComparison.passed,
          matched: apiMatched,
          different: apiDifferent,
          missing: apiMissing,
          extra: apiExtra,
        },
        dom: {
          compared: domComparisons.length > 0,
          passed: domComparisons.every((c) => c.result.passed),
          snapshotsCompared: domComparisons.length,
          totalDiffs: totalDomDiffs,
        },
        visual: {
          compared: visualComparisons.length > 0,
          passed: visualComparisons.every((c) => c.result.passed),
          screenshotsCompared: visualComparisons.length,
          maxDiffPercentage,
        },
      };
    }),
  };
}

/**
 * Report comparison results to console
 */
export function reportComparisonToConsole(result: ComparisonResult): void {
  const status = result.passed ? '✅ PASSED' : '❌ FAILED';
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scenario: ${result.scenarioId}`);
  console.log(`Status: ${status}`);
  console.log(`${'='.repeat(60)}`);

  // Execution summary
  const exec = result.playbackResult;
  console.log('\n📋 Execution:');
  console.log(`   Steps: ${exec.summary.passed}/${exec.summary.totalSteps} passed`);
  console.log(`   Duration: ${exec.endTime - exec.startTime}ms`);

  // API comparison
  if (result.apiComparison) {
    const api = result.apiComparison;
    const apiStatus = api.passed ? '✅' : '❌';
    console.log(`\n🔌 API Comparison: ${apiStatus}`);
    console.log(`   Matched: ${api.summary.matched}`);
    console.log(`   Different: ${api.summary.different}`);
    console.log(`   Missing: ${api.summary.missing}`);
    console.log(`   Extra: ${api.summary.extra}`);
  }

  // DOM comparison
  if (result.domComparisons.length > 0) {
    const allDomPassed = result.domComparisons.every((c) => c.result.passed);
    const domStatus = allDomPassed ? '✅' : '❌';
    console.log(`\n🌳 DOM Comparison: ${domStatus}`);
    for (const comp of result.domComparisons) {
      const s = comp.result.passed ? '✅' : '❌';
      console.log(`   ${s} ${comp.label}: ${comp.result.differences.length} differences`);
    }
  }

  // Visual comparison
  if (result.visualComparisons.length > 0) {
    const allVisualPassed = result.visualComparisons.every((c) => c.result.passed);
    const visualStatus = allVisualPassed ? '✅' : '❌';
    console.log(`\n🖼️  Visual Comparison: ${visualStatus}`);
    for (const comp of result.visualComparisons) {
      const s = comp.result.passed ? '✅' : '❌';
      console.log(`   ${s} ${comp.label}: ${comp.result.diffPercentage.toFixed(2)}% different`);
    }
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

/**
 * Report all comparison results to console
 */
export function reportAllComparisonsToConsole(results: ComparisonResult[]): void {
  console.log('\n' + '═'.repeat(60));
  console.log('COMPARISON TEST RESULTS');
  console.log('═'.repeat(60));

  for (const result of results) {
    reportComparisonToConsole(result);
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pass Rate: ${results.length > 0 ? ((passed / results.length) * 100).toFixed(1) : 0}%`);
  console.log('═'.repeat(60) + '\n');
}

/**
 * Write comparison report to JSON file
 */
export async function writeComparisonJsonReport(
  results: ComparisonResult[],
  outputPath: string
): Promise<void> {
  const fs = await import('node:fs/promises');
  const report = generateComparisonJsonReport(results);
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
}
