import type { Step } from '@like-cake/ast-types';
import { mergeTypeSteps, transformEventsToSteps } from '@like-cake/event-collector';
import { nanoid } from 'nanoid';
import { getDb } from '../db';
import type {
  CreateScenarioInput,
  ListResponse,
  PaginationParams,
  StoredExecutionResult,
  StoredScenario,
  UpdateScenarioInput,
} from '../types';
import { sessionService } from './session.service';

/**
 * Scenario service for managing test scenarios
 */
export class ScenarioService {
  /**
   * Create a new scenario
   */
  create(input: CreateScenarioInput): StoredScenario {
    const db = getDb();
    const id = `scenario-${nanoid(12)}`;
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO scenarios (
        id, session_id, name, description, url, viewport_width, viewport_height,
        steps, setup, teardown, variables, tags, recorded_at, ast_schema_version,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.sessionId || null,
      input.name || null,
      input.description || null,
      input.url,
      input.viewport?.width || 1440,
      input.viewport?.height || 900,
      JSON.stringify(input.steps),
      input.setup ? JSON.stringify(input.setup) : null,
      input.teardown ? JSON.stringify(input.teardown) : null,
      input.variables ? JSON.stringify(input.variables) : null,
      input.tags ? JSON.stringify(input.tags) : null,
      now,
      '1.0.0',
      now,
      now
    );

    return {
      id,
      sessionId: input.sessionId,
      name: input.name,
      description: input.description,
      url: input.url,
      viewport: {
        width: input.viewport?.width || 1440,
        height: input.viewport?.height || 900,
      },
      steps: input.steps,
      setup: input.setup,
      teardown: input.teardown,
      variables: input.variables,
      tags: input.tags,
      recordedAt: now,
      astSchemaVersion: '1.0.0',
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Create scenario from a recording session
   */
  createFromSession(sessionId: string, name?: string): StoredScenario | null {
    const session = sessionService.getWithEvents(sessionId);
    if (!session) return null;

    // Transform events to steps
    const rawSteps = transformEventsToSteps(session.events);
    const steps = mergeTypeSteps(rawSteps);

    return this.create({
      sessionId,
      name: name || session.name || `Recording ${new Date().toISOString()}`,
      url: session.url,
      viewport: session.viewport,
      steps,
    });
  }

  /**
   * Get scenario by ID
   */
  getById(id: string): StoredScenario | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, session_id, name, description, url, viewport_width, viewport_height,
             steps, setup, teardown, variables, tags, recorded_at, ast_schema_version,
             created_at, updated_at
      FROM scenarios WHERE id = ?
    `);

    const row = stmt.get(id) as ScenarioRow | undefined;
    if (!row) return null;

    return this.mapRowToScenario(row);
  }

  /**
   * List all scenarios with pagination
   */
  list(params: PaginationParams = {}): ListResponse<StoredScenario> {
    const db = getDb();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const countStmt = db.prepare('SELECT COUNT(*) as count FROM scenarios');
    const { count: total } = countStmt.get() as { count: number };

    const stmt = db.prepare(`
      SELECT id, session_id, name, description, url, viewport_width, viewport_height,
             steps, setup, teardown, variables, tags, recorded_at, ast_schema_version,
             created_at, updated_at
      FROM scenarios
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(limit, offset) as ScenarioRow[];

    return {
      items: rows.map(this.mapRowToScenario),
      total,
      page,
      limit,
      hasMore: offset + rows.length < total,
    };
  }

  /**
   * Update scenario
   */
  update(id: string, input: UpdateScenarioInput): StoredScenario | null {
    const db = getDb();
    const now = Date.now();

    const updates: string[] = ['updated_at = ?'];
    const values: (string | number | null)[] = [now];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }
    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.steps !== undefined) {
      updates.push('steps = ?');
      values.push(JSON.stringify(input.steps));
    }
    if (input.setup !== undefined) {
      updates.push('setup = ?');
      values.push(input.setup ? JSON.stringify(input.setup) : null);
    }
    if (input.teardown !== undefined) {
      updates.push('teardown = ?');
      values.push(input.teardown ? JSON.stringify(input.teardown) : null);
    }
    if (input.variables !== undefined) {
      updates.push('variables = ?');
      values.push(input.variables ? JSON.stringify(input.variables) : null);
    }
    if (input.tags !== undefined) {
      updates.push('tags = ?');
      values.push(input.tags ? JSON.stringify(input.tags) : null);
    }

    values.push(id);

    const stmt = db.prepare(`
      UPDATE scenarios SET ${updates.join(', ')} WHERE id = ?
    `);

    const result = stmt.run(...values);
    if (result.changes === 0) return null;

    return this.getById(id);
  }

  /**
   * Delete scenario and all related execution results
   */
  delete(id: string): boolean {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM scenarios WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Export scenario as JSON (for runner or download)
   */
  export(id: string): object | null {
    const scenario = this.getById(id);
    if (!scenario) return null;

    return {
      id: scenario.id,
      meta: {
        name: scenario.name,
        description: scenario.description,
        recordedAt: new Date(scenario.recordedAt).toISOString(),
        url: scenario.url,
        viewport: scenario.viewport,
        astSchemaVersion: scenario.astSchemaVersion,
      },
      steps: scenario.steps,
      setup: scenario.setup,
      teardown: scenario.teardown,
      variables: scenario.variables,
    };
  }

  /**
   * Import scenario from JSON
   */
  import(data: ImportScenarioData): StoredScenario {
    return this.create({
      name: data.meta?.name,
      description: data.meta?.description,
      url: data.meta?.url || 'unknown',
      viewport: data.meta?.viewport,
      steps: data.steps || [],
      setup: data.setup,
      teardown: data.teardown,
      variables: data.variables,
      tags: data.meta?.tags,
    });
  }

  /**
   * Add execution result
   */
  addExecutionResult(
    scenarioId: string,
    result: Omit<StoredExecutionResult, 'id' | 'scenarioId' | 'createdAt'>
  ): StoredExecutionResult {
    const db = getDb();
    const id = `result-${nanoid(12)}`;
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO execution_results (
        id, scenario_id, status, total_steps, passed, failed, skipped,
        duration, step_results, environment, executed_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      scenarioId,
      result.status,
      result.totalSteps,
      result.passed,
      result.failed,
      result.skipped,
      result.duration,
      JSON.stringify(result.stepResults),
      result.environment ? JSON.stringify(result.environment) : null,
      result.executedAt,
      now
    );

    return {
      id,
      scenarioId,
      ...result,
      createdAt: now,
    };
  }

  /**
   * Get execution results for a scenario
   */
  getExecutionResults(
    scenarioId: string,
    params: PaginationParams = {}
  ): ListResponse<StoredExecutionResult> {
    const db = getDb();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const countStmt = db.prepare(
      'SELECT COUNT(*) as count FROM execution_results WHERE scenario_id = ?'
    );
    const { count: total } = countStmt.get(scenarioId) as { count: number };

    const stmt = db.prepare(`
      SELECT id, scenario_id, status, total_steps, passed, failed, skipped,
             duration, step_results, environment, executed_at, created_at
      FROM execution_results
      WHERE scenario_id = ?
      ORDER BY executed_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(scenarioId, limit, offset) as ExecutionResultRow[];

    return {
      items: rows.map(this.mapRowToExecutionResult),
      total,
      page,
      limit,
      hasMore: offset + rows.length < total,
    };
  }

  private mapRowToScenario(row: ScenarioRow): StoredScenario {
    return {
      id: row.id,
      sessionId: row.session_id || undefined,
      name: row.name || undefined,
      description: row.description || undefined,
      url: row.url,
      viewport: {
        width: row.viewport_width,
        height: row.viewport_height,
      },
      steps: JSON.parse(row.steps) as Step[],
      setup: row.setup ? (JSON.parse(row.setup) as Step[]) : undefined,
      teardown: row.teardown ? (JSON.parse(row.teardown) as Step[]) : undefined,
      variables: row.variables
        ? (JSON.parse(row.variables) as Record<string, string | number | boolean>)
        : undefined,
      tags: row.tags ? (JSON.parse(row.tags) as string[]) : undefined,
      recordedAt: row.recorded_at,
      astSchemaVersion: row.ast_schema_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToExecutionResult(row: ExecutionResultRow): StoredExecutionResult {
    return {
      id: row.id,
      scenarioId: row.scenario_id,
      status: row.status as StoredExecutionResult['status'],
      totalSteps: row.total_steps,
      passed: row.passed,
      failed: row.failed,
      skipped: row.skipped,
      duration: row.duration,
      stepResults: JSON.parse(row.step_results),
      environment: row.environment ? JSON.parse(row.environment) : undefined,
      executedAt: row.executed_at,
      createdAt: row.created_at,
    };
  }
}

// Internal row types
interface ScenarioRow {
  id: string;
  session_id: string | null;
  name: string | null;
  description: string | null;
  url: string;
  viewport_width: number;
  viewport_height: number;
  steps: string;
  setup: string | null;
  teardown: string | null;
  variables: string | null;
  tags: string | null;
  recorded_at: number;
  ast_schema_version: string;
  created_at: number;
  updated_at: number;
}

interface ExecutionResultRow {
  id: string;
  scenario_id: string;
  status: string;
  total_steps: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  step_results: string;
  environment: string | null;
  executed_at: number;
  created_at: number;
}

interface ImportScenarioData {
  meta?: {
    name?: string;
    description?: string;
    url?: string;
    viewport?: { width: number; height: number };
    tags?: string[];
  };
  steps?: Step[];
  setup?: Step[];
  teardown?: Step[];
  variables?: Record<string, string | number | boolean>;
}

// Export singleton instance
export const scenarioService = new ScenarioService();
