import type { Scenario } from '@like-cake/ast-types';
import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { reportAllToConsole, writeJsonReport, writeJunitReport } from './reporters';
import { ScenarioRunner } from './runner';
import type { RunnerOptions } from './types';

const program = new Command();

program
  .name('like-cake-runner')
  .description('Puppeteer-based test runner for E2E test scenarios')
  .version('1.0.0');

/**
 * Run command - execute test scenarios
 */
program
  .command('run')
  .description('Run one or more test scenarios')
  .argument('<scenario...>', 'Scenario file path(s) or scenario ID(s)')
  .option('-u, --api-url <url>', 'Backend API URL for fetching scenarios by ID')
  .option('-b, --base-url <url>', 'Base URL for relative navigations')
  .option('--headless', 'Run in headless mode (default)', true)
  .option('--no-headless', 'Run in headed mode')
  .option('-t, --timeout <ms>', 'Default step timeout in milliseconds', '30000')
  .option('--slow-mo <ms>', 'Slow motion delay between actions', '0')
  .option('--screenshot-dir <path>', 'Directory to save screenshots')
  .option('--snapshot-dir <path>', 'Directory to save DOM snapshots')
  .option('--screenshot-on-failure', 'Capture screenshots on step failure', true)
  .option('--no-screenshot-on-failure', 'Disable screenshots on failure')
  .option('--continue-on-failure', 'Continue execution after step failure', false)
  .option('-o, --output <format>', 'Output format: console, json, junit', 'console')
  .option('--output-file <path>', 'Output file path for json/junit formats')
  .option('--viewport <size>', 'Viewport size (e.g., 1440x900)')
  .option('--user-agent <ua>', 'Custom user agent string')
  .action(async (scenarioPaths: string[], options: Record<string, unknown>) => {
    try {
      // Parse options
      const runnerOptions: RunnerOptions = {
        headless: options.headless as boolean,
        defaultTimeout: Number(options.timeout),
        slowMo: Number(options.slowMo),
        screenshotDir: options.screenshotDir as string | undefined,
        snapshotDir: options.snapshotDir as string | undefined,
        screenshotOnFailure: options.screenshotOnFailure as boolean,
        baseUrl: options.baseUrl as string | undefined,
        continueOnFailure: options.continueOnFailure as boolean,
        userAgent: options.userAgent as string | undefined,
      };

      // Parse viewport
      if (options.viewport) {
        const [width, height] = (options.viewport as string).split('x').map(Number);
        if (width && height) {
          runnerOptions.viewport = { width, height };
        }
      }

      // Load scenarios
      const scenarios: Scenario[] = [];
      for (const scenarioPath of scenarioPaths) {
        const scenario = await loadScenario(scenarioPath, options.apiUrl as string | undefined);
        scenarios.push(scenario);
      }

      // Create runner and execute
      const runner = new ScenarioRunner(runnerOptions);

      try {
        const results = await runner.runAll(scenarios);

        // Output results
        const outputFormat = options.output as string;
        const outputFile = options.outputFile as string | undefined;

        if (outputFormat === 'json') {
          if (outputFile) {
            writeJsonReport(results, outputFile);
            console.log(`JSON report written to: ${outputFile}`);
          } else {
            console.log(JSON.stringify(results, null, 2));
          }
        } else if (outputFormat === 'junit') {
          if (outputFile) {
            writeJunitReport(results, outputFile);
            console.log(`JUnit report written to: ${outputFile}`);
          } else {
            console.error('JUnit format requires --output-file option');
            process.exit(1);
          }
        } else {
          reportAllToConsole(results);
        }

        // Exit with appropriate code
        const hasFailures = results.some((r) => !r.summary.success);
        process.exit(hasFailures ? 1 : 0);
      } finally {
        await runner.close();
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

/**
 * Validate command - validate scenario files
 */
program
  .command('validate')
  .description('Validate scenario file(s) without running')
  .argument('<scenario...>', 'Scenario file path(s)')
  .action(async (scenarioPaths: string[]) => {
    let hasErrors = false;

    for (const scenarioPath of scenarioPaths) {
      try {
        const scenario = await loadScenarioFromFile(scenarioPath);
        console.log(`✓ ${scenarioPath}: Valid (${scenario.steps.length} steps)`);
      } catch (error) {
        console.error(
          `✗ ${scenarioPath}: ${error instanceof Error ? error.message : String(error)}`
        );
        hasErrors = true;
      }
    }

    process.exit(hasErrors ? 1 : 0);
  });

/**
 * Load scenario from file or API
 */
async function loadScenario(scenarioPath: string, apiUrl?: string): Promise<Scenario> {
  // Check if it's a file path
  if (fs.existsSync(scenarioPath)) {
    return loadScenarioFromFile(scenarioPath);
  }

  // Check if it's a scenario ID and API URL is provided
  if (apiUrl && scenarioPath.startsWith('scenario-')) {
    return loadScenarioFromApi(scenarioPath, apiUrl);
  }

  throw new Error(
    `Scenario not found: ${scenarioPath}. Provide a valid file path or use --api-url with scenario ID.`
  );
}

/**
 * Load scenario from file
 */
async function loadScenarioFromFile(filePath: string): Promise<Scenario> {
  const absolutePath = path.resolve(filePath);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const data = JSON.parse(content);

  // Basic validation
  if (!data.id) {
    throw new Error('Scenario must have an id');
  }
  if (!data.meta || !data.steps) {
    throw new Error('Scenario must have meta and steps');
  }

  return data as Scenario;
}

/**
 * Load scenario from backend API
 */
async function loadScenarioFromApi(scenarioId: string, apiUrl: string): Promise<Scenario> {
  const url = `${apiUrl}/api/scenarios/${scenarioId}/export`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch scenario from API: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as {
    success: boolean;
    data?: {
      id: string;
      meta?: {
        name?: string;
        description?: string;
        url?: string;
        viewport?: { width: number; height: number };
        recordedAt?: string;
        astSchemaVersion?: string;
      };
      steps?: unknown[];
      setup?: unknown[];
      teardown?: unknown[];
      variables?: Record<string, string | number | boolean>;
    };
    error?: string;
  };

  if (!json.success || !json.data) {
    throw new Error(json.error || 'Failed to load scenario from API');
  }

  // Transform exported format to Scenario format
  const data = json.data;
  return {
    id: data.id,
    name: data.meta?.name,
    description: data.meta?.description,
    meta: {
      url: data.meta?.url ?? 'unknown',
      viewport: data.meta?.viewport ?? { width: 1440, height: 900 },
      recordedAt: data.meta?.recordedAt ?? new Date().toISOString(),
      astSchemaVersion: data.meta?.astSchemaVersion ?? '1.0.0',
    },
    steps: (data.steps || []) as Scenario['steps'],
    setup: data.setup as Scenario['setup'],
    teardown: data.teardown as Scenario['teardown'],
    variables: data.variables,
  };
}

program.parse();
