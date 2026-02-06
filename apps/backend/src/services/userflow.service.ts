import type { FlowEdge, FlowNode, FlowNodeResult, FlowVariableValue } from '@like-cake/ast-types';
import { nanoid } from 'nanoid';
import { getDb } from '../db';
import type {
  CreateUserFlowInput,
  ListResponse,
  PaginationParams,
  StoredFlowExecutionResult,
  StoredUserFlow,
  UpdateUserFlowInput,
} from '../types';
import { executionService } from './execution.service';
import { FlowExecutor } from './flow-executor';
import { scenarioService } from './scenario.service';

/**
 * UserFlow service for managing user flows
 */
export class UserFlowService {
  /**
   * Create a new user flow
   */
  create(input: CreateUserFlowInput): StoredUserFlow {
    const db = getDb();
    const id = `flow-${nanoid(12)}`;
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO user_flows (
        id, name, description, nodes, edges, variables, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.name,
      input.description || null,
      JSON.stringify(input.nodes),
      JSON.stringify(input.edges),
      input.variables ? JSON.stringify(input.variables) : null,
      now,
      now
    );

    return {
      id,
      name: input.name,
      description: input.description,
      nodes: input.nodes,
      edges: input.edges,
      variables: input.variables,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get user flow by ID
   */
  getById(id: string): StoredUserFlow | null {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT id, name, description, nodes, edges, variables, created_at, updated_at
      FROM user_flows WHERE id = ?
    `);

    const row = stmt.get(id) as UserFlowRow | undefined;
    if (!row) return null;

    return this.mapRowToUserFlow(row);
  }

  /**
   * List all user flows with pagination
   */
  list(params: PaginationParams = {}): ListResponse<StoredUserFlow> {
    const db = getDb();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const transaction = db.transaction(() => {
      const countStmt = db.prepare('SELECT COUNT(*) as count FROM user_flows');
      const { count: total } = countStmt.get() as { count: number };

      const stmt = db.prepare(`
        SELECT id, name, description, nodes, edges, variables, created_at, updated_at
        FROM user_flows
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);

      const rows = stmt.all(limit, offset) as UserFlowRow[];

      return {
        items: rows.map(this.mapRowToUserFlow),
        total,
        page,
        limit,
        hasMore: offset + rows.length < total,
      };
    });

    return transaction();
  }

  /**
   * Update user flow
   */
  update(id: string, input: UpdateUserFlowInput): StoredUserFlow | null {
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
      values.push(input.description || null);
    }
    if (input.nodes !== undefined) {
      updates.push('nodes = ?');
      values.push(JSON.stringify(input.nodes));
    }
    if (input.edges !== undefined) {
      updates.push('edges = ?');
      values.push(JSON.stringify(input.edges));
    }
    if (input.variables !== undefined) {
      updates.push('variables = ?');
      values.push(input.variables ? JSON.stringify(input.variables) : null);
    }

    values.push(id);

    const transaction = db.transaction(() => {
      const stmt = db.prepare(`
        UPDATE user_flows SET ${updates.join(', ')} WHERE id = ?
      `);

      const result = stmt.run(...values);
      if (result.changes === 0) return null;

      return this.getById(id);
    });

    return transaction();
  }

  /**
   * Delete user flow
   */
  delete(id: string): boolean {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM user_flows WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Flatten flow into execution order using topological sort
   * Returns scenario IDs in the order they should be executed
   */
  flatten(flow: StoredUserFlow): string[] {
    const { nodes, edges } = flow;

    console.log('[UserFlowService.flatten] Input nodes:', JSON.stringify(nodes, null, 2));
    console.log('[UserFlowService.flatten] Input edges:', JSON.stringify(edges, null, 2));

    // Build adjacency list and in-degree map
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    // Initialize
    for (const node of nodes) {
      adjacency.set(node.id, []);
      inDegree.set(node.id, 0);
    }

    // Build graph
    for (const edge of edges) {
      const neighbors = adjacency.get(edge.source);
      if (neighbors) {
        neighbors.push(edge.target);
      }
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }

    // Kahn's algorithm for topological sort
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = nodes.find((n) => n.id === current);

      console.log('[UserFlowService.flatten] Processing node:', current, 'type:', node?.type, 'data:', node?.data);

      // Only add scenario nodes to the result
      if (node?.type === 'scenario') {
        // Handle both typed access and plain object access
        const scenarioId = (node.data as { scenarioId?: string })?.scenarioId;
        console.log('[UserFlowService.flatten] Found scenario node, scenarioId:', scenarioId);
        if (scenarioId) {
          result.push(scenarioId);
        }
      }

      const neighbors = adjacency.get(current) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    console.log('[UserFlowService.flatten] Result scenarioIds:', result);
    return result;
  }

  /**
   * Execute a user flow using the FlowExecutor
   * Supports conditional branching and variable passing
   */
  async execute(
    id: string,
    options: {
      headless?: boolean;
      defaultTimeout?: number;
      baseUrl?: string;
      viewport?: { width: number; height: number };
      onNodeStatusChange?: (nodeId: string, status: string, result?: FlowNodeResult) => void;
      continueOnFailure?: boolean;
    } = {}
  ): Promise<StoredFlowExecutionResult | null> {
    console.log('[UserFlowService.execute] Starting execution for flow:', id);
    const flow = this.getById(id);
    if (!flow) {
      console.log('[UserFlowService.execute] Flow not found:', id);
      return null;
    }

    console.log('[UserFlowService.execute] Flow found:', flow.name, 'with', flow.nodes.length, 'nodes');

    // Check if flow has condition nodes - use new FlowExecutor
    const hasConditionNodes = flow.nodes.some(
      (n) => n.type === 'condition' || n.type === 'setVariable' || n.type === 'extractVariable'
    );

    if (hasConditionNodes) {
      console.log('[UserFlowService.execute] Using FlowExecutor for conditional flow');
      return this.executeWithFlowExecutor(id, flow, options);
    }

    // Fallback to legacy execution for simple flows (backward compatibility)
    console.log('[UserFlowService.execute] Using legacy execution for simple flow');
    return this.executeLegacy(id, flow, options);
  }

  /**
   * Execute flow using the new FlowExecutor (supports conditions and variables)
   */
  private async executeWithFlowExecutor(
    id: string,
    flow: StoredUserFlow,
    options: {
      headless?: boolean;
      defaultTimeout?: number;
      baseUrl?: string;
      viewport?: { width: number; height: number };
      onNodeStatusChange?: (nodeId: string, status: string, result?: FlowNodeResult) => void;
      continueOnFailure?: boolean;
    }
  ): Promise<StoredFlowExecutionResult> {
    const executor = new FlowExecutor(flow.nodes, flow.edges, {
      initialVariables: flow.variables as Record<string, FlowVariableValue> || {},
      scenarioService,
      executionService,
      runnerOptions: {
        headless: options.headless,
        defaultTimeout: options.defaultTimeout,
        baseUrl: options.baseUrl,
        viewport: options.viewport,
      },
      onNodeStatusChange: options.onNodeStatusChange,
      continueOnFailure: options.continueOnFailure,
    });

    const result = await executor.execute();

    // Store the result
    const executionResult = this.addExecutionResult(id, {
      status: result.status,
      totalNodes: result.summary.totalNodes,
      passedNodes: result.summary.passedNodes,
      failedNodes: result.summary.failedNodes,
      skippedNodes: result.summary.skippedNodes,
      totalSteps: result.summary.totalSteps,
      passedSteps: result.summary.passedSteps,
      failedSteps: result.summary.failedSteps,
      skippedSteps: result.summary.skippedSteps,
      duration: result.summary.duration,
      nodeResults: result.nodeResults,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
    });

    return executionResult;
  }

  /**
   * Legacy execution for simple flows (no conditions/variables)
   * Kept for backward compatibility
   */
  private async executeLegacy(
    id: string,
    flow: StoredUserFlow,
    options: {
      headless?: boolean;
      defaultTimeout?: number;
      baseUrl?: string;
      viewport?: { width: number; height: number };
    }
  ): Promise<StoredFlowExecutionResult> {
    const startedAt = Date.now();
    const scenarioIds = this.flatten(flow);
    console.log('[UserFlowService.executeLegacy] Scenario IDs to execute:', scenarioIds);
    const nodeResults: FlowNodeResult[] = [];

    let totalSteps = 0;
    let passedSteps = 0;
    let failedSteps = 0;
    let skippedSteps = 0;
    let hasFailure = false;

    // Execute each scenario in order
    for (const scenarioId of scenarioIds) {
      const scenario = scenarioService.getById(scenarioId);
      if (!scenario) {
        // Scenario not found - skip
        const nodeId = this.findNodeIdByScenarioId(flow.nodes, scenarioId);
        nodeResults.push({
          nodeId: nodeId || scenarioId,
          nodeType: 'scenario',
          status: 'skipped',
          duration: 0,
          error: { message: `Scenario ${scenarioId} not found` },
        });
        continue;
      }

      const nodeId = this.findNodeIdByScenarioId(flow.nodes, scenarioId);
      const nodeStartTime = Date.now();

      try {
        // Execute the scenario
        const result = await executionService.execute(scenarioId, options);
        const status = result.summary.success ? 'passed' : 'failed';

        const nodeResult: FlowNodeResult = {
          nodeId: nodeId || scenarioId,
          nodeType: 'scenario',
          status,
          duration: Date.now() - nodeStartTime,
          scenarioResult: {
            scenarioId,
            passed: result.summary.passed,
            failed: result.summary.failed,
            skipped: result.summary.skipped,
            totalSteps: result.summary.totalSteps,
          },
        };

        nodeResults.push(nodeResult);

        // Aggregate step counts
        totalSteps += result.summary.totalSteps;
        passedSteps += result.summary.passed;
        failedSteps += result.summary.failed;
        skippedSteps += result.summary.skipped;

        if (!result.summary.success) {
          hasFailure = true;
        }
      } catch (error) {
        hasFailure = true;
        nodeResults.push({
          nodeId: nodeId || scenarioId,
          nodeType: 'scenario',
          status: 'failed',
          duration: Date.now() - nodeStartTime,
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
    }

    const endedAt = Date.now();
    const status = hasFailure ? 'failed' : 'passed';

    // Store the result
    const executionResult = this.addExecutionResult(id, {
      status,
      totalNodes: scenarioIds.length,
      passedNodes: nodeResults.filter((r) => r.status === 'passed').length,
      failedNodes: nodeResults.filter((r) => r.status === 'failed').length,
      skippedNodes: nodeResults.filter((r) => r.status === 'skipped').length,
      totalSteps,
      passedSteps,
      failedSteps,
      skippedSteps,
      duration: endedAt - startedAt,
      nodeResults,
      startedAt,
      endedAt,
    });

    return executionResult;
  }

  /**
   * Add execution result for a flow
   */
  addExecutionResult(
    flowId: string,
    result: Omit<StoredFlowExecutionResult, 'id' | 'flowId' | 'createdAt'>
  ): StoredFlowExecutionResult {
    const db = getDb();
    const id = `flowresult-${nanoid(12)}`;
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO flow_execution_results (
        id, flow_id, status, total_nodes, passed_nodes, failed_nodes, skipped_nodes,
        total_steps, passed_steps, failed_steps, skipped_steps,
        duration, node_results, started_at, ended_at, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      flowId,
      result.status,
      result.totalNodes,
      result.passedNodes,
      result.failedNodes,
      result.skippedNodes,
      result.totalSteps,
      result.passedSteps,
      result.failedSteps,
      result.skippedSteps,
      result.duration,
      JSON.stringify(result.nodeResults),
      result.startedAt,
      result.endedAt,
      now
    );

    return {
      id,
      flowId,
      ...result,
      createdAt: now,
    };
  }

  /**
   * Get execution results for a flow
   */
  getExecutionResults(
    flowId: string,
    params: PaginationParams = {}
  ): ListResponse<StoredFlowExecutionResult> {
    const db = getDb();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const transaction = db.transaction(() => {
      const countStmt = db.prepare(
        'SELECT COUNT(*) as count FROM flow_execution_results WHERE flow_id = ?'
      );
      const { count: total } = countStmt.get(flowId) as { count: number };

      const stmt = db.prepare(`
        SELECT id, flow_id, status, total_nodes, passed_nodes, failed_nodes, skipped_nodes,
               total_steps, passed_steps, failed_steps, skipped_steps,
               duration, node_results, started_at, ended_at, created_at
        FROM flow_execution_results
        WHERE flow_id = ?
        ORDER BY started_at DESC
        LIMIT ? OFFSET ?
      `);

      const rows = stmt.all(flowId, limit, offset) as FlowExecutionResultRow[];

      return {
        items: rows.map(this.mapRowToFlowExecutionResult),
        total,
        page,
        limit,
        hasMore: offset + rows.length < total,
      };
    });

    return transaction();
  }

  private parseJsonSafely<T>(data: string, fallback: T): T {
    try {
      return JSON.parse(data) as T;
    } catch {
      console.error('[UserFlowService] Failed to parse JSON:', data.slice(0, 100));
      return fallback;
    }
  }

  private findNodeIdByScenarioId(nodes: FlowNode[], scenarioId: string): string | null {
    const node = nodes.find((n) => n.type === 'scenario' && n.data.scenarioId === scenarioId);
    return node?.id || null;
  }

  private mapRowToUserFlow = (row: UserFlowRow): StoredUserFlow => {
    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      nodes: this.parseJsonSafely<FlowNode[]>(row.nodes, []),
      edges: this.parseJsonSafely<FlowEdge[]>(row.edges, []),
      variables: row.variables
        ? this.parseJsonSafely<Record<string, string | number | boolean>>(row.variables, {})
        : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  };

  private mapRowToFlowExecutionResult = (row: FlowExecutionResultRow): StoredFlowExecutionResult => {
    return {
      id: row.id,
      flowId: row.flow_id,
      status: row.status as StoredFlowExecutionResult['status'],
      totalNodes: row.total_nodes,
      passedNodes: row.passed_nodes,
      failedNodes: row.failed_nodes,
      skippedNodes: row.skipped_nodes,
      totalSteps: row.total_steps,
      passedSteps: row.passed_steps,
      failedSteps: row.failed_steps,
      skippedSteps: row.skipped_steps,
      duration: row.duration,
      nodeResults: this.parseJsonSafely<FlowNodeResult[]>(row.node_results, []),
      startedAt: row.started_at,
      endedAt: row.ended_at,
      createdAt: row.created_at,
    };
  };
}

// Internal row types
interface UserFlowRow {
  id: string;
  name: string;
  description: string | null;
  nodes: string;
  edges: string;
  variables: string | null;
  created_at: number;
  updated_at: number;
}

interface FlowExecutionResultRow {
  id: string;
  flow_id: string;
  status: string;
  total_nodes: number;
  passed_nodes: number;
  failed_nodes: number;
  skipped_nodes: number;
  total_steps: number;
  passed_steps: number;
  failed_steps: number;
  skipped_steps: number;
  duration: number;
  node_results: string;
  started_at: number;
  ended_at: number;
  created_at: number;
}

// Export singleton instance
export const userFlowService = new UserFlowService();
