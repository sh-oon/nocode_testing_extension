/**
 * FlowExecutor - Core execution engine for user flows
 *
 * Supports:
 * - Conditional branching (IF/ELSE)
 * - Variable management (set/extract)
 * - Graph-based execution with cycle detection
 * - Parallel-safe node traversal
 */

import type {
  ConditionFlowNode,
  ExtractVariableFlowNode,
  FlowEdge,
  FlowNode,
  FlowNodeResult,
  FlowNodeType,
  FlowVariableValue,
  SetVariableFlowNode,
  VariableAssignment,
  VariableExtraction,
} from '@like-cake/ast-types';
import { VariableStore } from '@like-cake/variable-store';
import type { ExecutionService } from './execution.service';
import type { ScenarioService } from './scenario.service';

export interface FlowExecutorOptions {
  /** Initial variables for the flow */
  initialVariables?: Record<string, FlowVariableValue>;
  /** Scenario service for executing scenarios */
  scenarioService: ScenarioService;
  /** Execution service for running scenarios */
  executionService: ExecutionService;
  /** Runner options */
  runnerOptions?: {
    headless?: boolean;
    defaultTimeout?: number;
    baseUrl?: string;
    viewport?: { width: number; height: number };
  };
  /** Callback for node status updates */
  onNodeStatusChange?: (nodeId: string, status: string, result?: FlowNodeResult) => void;
  /** Maximum execution time in ms (default: 5 minutes) */
  maxExecutionTime?: number;
  /** Continue on failure (default: false) */
  continueOnFailure?: boolean;
}

export interface FlowExecutionContext {
  /** Variable store */
  variables: VariableStore;
  /** Last API response (for extraction) */
  lastApiResponse?: unknown;
  /** Visited nodes (for cycle detection) */
  visitedNodes: Set<string>;
  /** Node results */
  nodeResults: FlowNodeResult[];
  /** Start time */
  startedAt: number;
  /** Whether execution has failed */
  hasFailed: boolean;
}

export class FlowExecutor {
  private nodes: Map<string, FlowNode>;
  private outgoingEdges: Map<string, FlowEdge[]>;
  private options: FlowExecutorOptions;
  private startNodeId: string | null = null;

  constructor(nodes: FlowNode[], edges: FlowEdge[], options: FlowExecutorOptions) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]));
    this.options = options;

    // Build outgoing edges map for quick lookup
    this.outgoingEdges = new Map();
    for (const edge of edges) {
      const existing = this.outgoingEdges.get(edge.source) || [];
      existing.push(edge);
      this.outgoingEdges.set(edge.source, existing);
    }

    // Find start node
    for (const node of nodes) {
      if (node.type === 'start') {
        this.startNodeId = node.id;
        break;
      }
    }
  }

  /**
   * Execute the entire flow
   */
  async execute(): Promise<{
    status: 'passed' | 'failed' | 'skipped';
    nodeResults: FlowNodeResult[];
    variables: Record<string, FlowVariableValue>;
    summary: {
      totalNodes: number;
      passedNodes: number;
      failedNodes: number;
      skippedNodes: number;
      totalSteps: number;
      passedSteps: number;
      failedSteps: number;
      skippedSteps: number;
      duration: number;
    };
    startedAt: number;
    endedAt: number;
  }> {
    const startedAt = Date.now();
    const maxTime = this.options.maxExecutionTime || 5 * 60 * 1000; // 5 minutes default

    // Initialize context
    const context: FlowExecutionContext = {
      variables: new VariableStore({
        initialVariables: this.options.initialVariables,
      }),
      visitedNodes: new Set(),
      nodeResults: [],
      startedAt,
      hasFailed: false,
    };

    // Find start node
    if (!this.startNodeId) {
      return this.buildResult(context, startedAt, 'failed', 'No start node found');
    }

    try {
      // Execute from start node
      await this.executeFromNode(this.startNodeId, context, maxTime);
    } catch (error) {
      console.error('[FlowExecutor] Execution error:', error);
      context.hasFailed = true;
    }

    return this.buildResult(context, startedAt, context.hasFailed ? 'failed' : 'passed');
  }

  /**
   * Execute from a specific node (recursive)
   */
  private async executeFromNode(
    nodeId: string,
    context: FlowExecutionContext,
    maxTime: number
  ): Promise<void> {
    // Check timeout
    if (Date.now() - context.startedAt > maxTime) {
      throw new Error('Flow execution timeout');
    }

    // Check for cycles
    if (context.visitedNodes.has(nodeId)) {
      console.warn(`[FlowExecutor] Cycle detected at node ${nodeId}, skipping`);
      return;
    }

    const node = this.nodes.get(nodeId);
    if (!node) {
      console.warn(`[FlowExecutor] Node ${nodeId} not found`);
      return;
    }

    // Mark as visited
    context.visitedNodes.add(nodeId);

    // Execute the node
    const result = await this.executeNode(node, context);

    if (result) {
      context.nodeResults.push(result);

      // Notify status change
      this.options.onNodeStatusChange?.(nodeId, result.status, result);

      // Check if we should continue after failure
      if (result.status === 'failed' && !this.options.continueOnFailure) {
        context.hasFailed = true;
        return;
      }
    }

    // Determine next node(s) to execute
    const nextNodeIds = this.getNextNodes(node, context, result);

    // Execute next nodes
    for (const nextId of nextNodeIds) {
      await this.executeFromNode(nextId, context, maxTime);
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: FlowNode,
    context: FlowExecutionContext
  ): Promise<FlowNodeResult | null> {
    const startTime = Date.now();

    switch (node.type) {
      case 'start':
        // Start node - no execution needed
        return null;

      case 'end':
        // End node - no execution needed
        return null;

      case 'scenario':
        return this.executeScenarioNode(node, context, startTime);

      case 'condition':
        return this.executeConditionNode(node as ConditionFlowNode, context, startTime);

      case 'setVariable':
        return this.executeSetVariableNode(node as SetVariableFlowNode, context, startTime);

      case 'extractVariable':
        return this.executeExtractVariableNode(node as ExtractVariableFlowNode, context, startTime);

      default:
        console.warn(`[FlowExecutor] Unknown node type: ${(node as FlowNode).type}`);
        return null;
    }
  }

  /**
   * Execute a scenario node
   */
  private async executeScenarioNode(
    node: FlowNode & { type: 'scenario' },
    context: FlowExecutionContext,
    startTime: number
  ): Promise<FlowNodeResult> {
    const { scenarioId } = node.data;

    try {
      // Get scenario
      const scenario = this.options.scenarioService.getById(scenarioId);
      if (!scenario) {
        return {
          nodeId: node.id,
          nodeType: 'scenario' as FlowNodeType,
          status: 'skipped',
          duration: Date.now() - startTime,
          error: { message: `Scenario ${scenarioId} not found` },
        };
      }

      // Execute scenario with flow variables passed as runtime overrides
      const runtimeVariables = this.coerceVariablesForRunner(context.variables.getAll());
      const result = await this.options.executionService.execute(
        scenarioId,
        { ...this.options.runnerOptions },
        undefined,
        runtimeVariables
      );

      // Store last API response for extraction (from API calls observed during scenario)
      if (result.apiCalls && result.apiCalls.length > 0) {
        const lastApiCall = result.apiCalls[result.apiCalls.length - 1];
        if (lastApiCall.response?.body !== undefined) {
          context.lastApiResponse = lastApiCall.response.body;
        }
      }

      const status = result.summary.success ? 'passed' : 'failed';
      if (status === 'failed') {
        context.hasFailed = true;
      }

      return {
        nodeId: node.id,
        nodeType: 'scenario' as FlowNodeType,
        status,
        duration: Date.now() - startTime,
        scenarioResult: {
          scenarioId,
          passed: result.summary.passed,
          failed: result.summary.failed,
          skipped: result.summary.skipped,
          totalSteps: result.summary.totalSteps,
        },
      };
    } catch (error) {
      context.hasFailed = true;
      return {
        nodeId: node.id,
        nodeType: 'scenario' as FlowNodeType,
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  /**
   * Execute a condition node
   */
  private executeConditionNode(
    node: ConditionFlowNode,
    context: FlowExecutionContext,
    startTime: number
  ): FlowNodeResult {
    const { condition } = node.data;

    try {
      const evalResult = context.variables.evaluateCondition(condition);

      return {
        nodeId: node.id,
        nodeType: 'condition' as FlowNodeType,
        status: 'passed',
        duration: Date.now() - startTime,
        conditionResult: {
          result: evalResult.result,
          leftValue: evalResult.leftValue,
          rightValue: evalResult.rightValue,
        },
      };
    } catch (error) {
      return {
        nodeId: node.id,
        nodeType: 'condition' as FlowNodeType,
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Execute a set variable node
   */
  private executeSetVariableNode(
    node: SetVariableFlowNode,
    context: FlowExecutionContext,
    startTime: number
  ): FlowNodeResult {
    const { variables } = node.data;
    const setVariables: Record<string, FlowVariableValue> = {};

    try {
      for (const assignment of variables) {
        const value = this.parseVariableValue(assignment, context.variables);
        context.variables.set(assignment.name, value);
        setVariables[assignment.name] = value;
      }

      return {
        nodeId: node.id,
        nodeType: 'setVariable' as FlowNodeType,
        status: 'passed',
        duration: Date.now() - startTime,
        variableResult: { variables: setVariables },
      };
    } catch (error) {
      return {
        nodeId: node.id,
        nodeType: 'setVariable' as FlowNodeType,
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Execute an extract variable node
   */
  private executeExtractVariableNode(
    node: ExtractVariableFlowNode,
    context: FlowExecutionContext,
    startTime: number
  ): FlowNodeResult {
    const { extractions } = node.data;
    const extractedVariables: Record<string, FlowVariableValue> = {};

    try {
      for (const extraction of extractions) {
        const value = this.extractVariable(extraction, context);
        context.variables.set(extraction.variableName, value);
        extractedVariables[extraction.variableName] = value;
      }

      return {
        nodeId: node.id,
        nodeType: 'extractVariable' as FlowNodeType,
        status: 'passed',
        duration: Date.now() - startTime,
        variableResult: { variables: extractedVariables },
      };
    } catch (error) {
      return {
        nodeId: node.id,
        nodeType: 'extractVariable' as FlowNodeType,
        status: 'failed',
        duration: Date.now() - startTime,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Parse a variable assignment value based on its type
   */
  private parseVariableValue(
    assignment: VariableAssignment,
    variables: VariableStore
  ): FlowVariableValue {
    // First, interpolate any variable references
    const interpolated = variables.interpolate(assignment.value);

    switch (assignment.type) {
      case 'string':
        return interpolated;

      case 'number': {
        const num = Number(interpolated);
        if (Number.isNaN(num)) {
          throw new Error(`Invalid number value: ${interpolated}`);
        }
        return num;
      }

      case 'boolean':
        return interpolated === 'true' || interpolated === '1';

      case 'json':
        try {
          return JSON.parse(interpolated);
        } catch {
          throw new Error(`Invalid JSON value: ${interpolated}`);
        }

      default:
        return interpolated;
    }
  }

  /**
   * Extract a variable from context
   */
  private extractVariable(
    extraction: VariableExtraction,
    context: FlowExecutionContext
  ): FlowVariableValue {
    const { source, jsonPath, defaultValue } = extraction;

    switch (source) {
      case 'lastApiResponse':
        if (!context.lastApiResponse) {
          return defaultValue ?? null;
        }
        if (jsonPath) {
          return context.variables.extractJsonPath(context.lastApiResponse, jsonPath) ?? defaultValue ?? null;
        }
        return context.lastApiResponse as FlowVariableValue;

      case 'url':
        // URL extraction would need to be implemented in the runner context
        // For now, return default or null
        return defaultValue ?? null;

      case 'element':
        // Element extraction would need to be implemented in the runner context
        // This requires browser context which is handled during scenario execution
        return defaultValue ?? null;

      case 'localStorage':
      case 'cookie':
        // These require browser context
        return defaultValue ?? null;

      default:
        return defaultValue ?? null;
    }
  }

  /**
   * Coerce FlowVariableValue map to Runner-compatible primitives.
   * Skips null/undefined, stringifies objects/arrays, passes primitives through.
   */
  private coerceVariablesForRunner(
    vars: Record<string, FlowVariableValue>
  ): Record<string, string | number | boolean> {
    const result: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(vars)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        result[key] = value;
      } else {
        result[key] = JSON.stringify(value);
      }
    }
    return result;
  }

  /**
   * Get next nodes to execute based on current node and result
   */
  private getNextNodes(
    node: FlowNode,
    _context: FlowExecutionContext,
    result: FlowNodeResult | null
  ): string[] {
    const outgoing = this.outgoingEdges.get(node.id) || [];

    // For condition nodes, select based on result
    if (node.type === 'condition' && result?.conditionResult) {
      const branchValue = result.conditionResult.result ? 'true' : 'false';
      const matchingEdge = outgoing.find((e) => e.sourceHandle === branchValue);
      return matchingEdge ? [matchingEdge.target] : [];
    }

    // For other nodes, return all outgoing edges
    return outgoing.map((e) => e.target);
  }

  /**
   * Build the final result
   */
  private buildResult(
    context: FlowExecutionContext,
    startedAt: number,
    status: 'passed' | 'failed' | 'skipped',
    errorMessage?: string
  ) {
    const endedAt = Date.now();

    // Calculate summary
    let totalSteps = 0;
    let passedSteps = 0;
    let failedSteps = 0;
    let skippedSteps = 0;

    for (const result of context.nodeResults) {
      if (result.scenarioResult) {
        totalSteps += result.scenarioResult.totalSteps;
        passedSteps += result.scenarioResult.passed;
        failedSteps += result.scenarioResult.failed;
        skippedSteps += result.scenarioResult.skipped;
      }
    }

    if (errorMessage) {
      // Add error to results if there's a global error
      context.nodeResults.push({
        nodeId: 'flow-error',
        nodeType: 'start' as FlowNodeType,
        status: 'failed',
        duration: 0,
        error: { message: errorMessage },
      });
    }

    return {
      status,
      nodeResults: context.nodeResults,
      variables: context.variables.getAll(),
      summary: {
        totalNodes: context.nodeResults.filter((r) => r.nodeType === 'scenario').length,
        passedNodes: context.nodeResults.filter((r) => r.status === 'passed' && r.nodeType === 'scenario').length,
        failedNodes: context.nodeResults.filter((r) => r.status === 'failed' && r.nodeType === 'scenario').length,
        skippedNodes: context.nodeResults.filter((r) => r.status === 'skipped' && r.nodeType === 'scenario').length,
        totalSteps,
        passedSteps,
        failedSteps,
        skippedSteps,
        duration: endedAt - startedAt,
      },
      startedAt,
      endedAt,
    };
  }
}
