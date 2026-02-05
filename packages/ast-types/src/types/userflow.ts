/**
 * User Flow types for combining multiple scenarios into a flow
 */

/**
 * Complete user flow combining multiple scenarios
 */
export interface UserFlow {
  /** Unique flow identifier */
  id: string;
  /** Human-readable flow name */
  name: string;
  /** Detailed description */
  description?: string;
  /** Flow nodes (scenarios, start, end) */
  nodes: FlowNode[];
  /** Connections between nodes */
  edges: FlowEdge[];
  /** Variables shared across all scenarios */
  variables?: Record<string, string | number | boolean>;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Node types in a flow
 */
export type FlowNodeType = 'scenario' | 'start' | 'end';

/**
 * Position in the flow canvas
 */
export interface FlowPosition {
  x: number;
  y: number;
}

/**
 * Data for a scenario node
 */
export interface ScenarioNodeData {
  /** Reference to scenario ID */
  scenarioId: string;
  /** Scenario name (for display) */
  scenarioName: string;
  /** Number of steps in the scenario */
  stepCount: number;
  /** Execution status */
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
}

/**
 * Data for start/end nodes
 */
export interface ControlNodeData {
  label: string;
}

/**
 * Base flow node structure
 */
export interface BaseFlowNode {
  /** Unique node ID within the flow */
  id: string;
  /** Node position on canvas */
  position: FlowPosition;
}

/**
 * Scenario node in the flow
 */
export interface ScenarioFlowNode extends BaseFlowNode {
  type: 'scenario';
  data: ScenarioNodeData;
}

/**
 * Start node in the flow
 */
export interface StartFlowNode extends BaseFlowNode {
  type: 'start';
  data: ControlNodeData;
}

/**
 * End node in the flow
 */
export interface EndFlowNode extends BaseFlowNode {
  type: 'end';
  data: ControlNodeData;
}

/**
 * Discriminated union of all flow node types
 */
export type FlowNode = ScenarioFlowNode | StartFlowNode | EndFlowNode;

/**
 * Edge connecting two nodes
 */
export interface FlowEdge {
  /** Unique edge ID */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Optional label */
  label?: string;
}

/**
 * Input for creating a new user flow
 */
export interface UserFlowInput {
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables?: Record<string, string | number | boolean>;
}

/**
 * Input for updating an existing user flow
 */
export interface UserFlowUpdateInput {
  name?: string;
  description?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  variables?: Record<string, string | number | boolean>;
}

/**
 * Execution result for a single node
 */
export interface FlowNodeResult {
  /** Node ID */
  nodeId: string;
  /** Execution status */
  status: 'passed' | 'failed' | 'skipped';
  /** Duration in milliseconds */
  duration: number;
  /** Scenario execution result (for scenario nodes) */
  scenarioResult?: {
    scenarioId: string;
    passed: number;
    failed: number;
    skipped: number;
    totalSteps: number;
  };
  /** Error information if failed */
  error?: {
    message: string;
    stack?: string;
  };
}

/**
 * Execution result for an entire flow
 */
export interface FlowExecutionResult {
  /** Flow ID */
  flowId: string;
  /** Overall status */
  status: 'passed' | 'failed' | 'skipped';
  /** Node results in execution order */
  nodeResults: FlowNodeResult[];
  /** Summary statistics */
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
  /** Execution timestamps */
  startedAt: number;
  endedAt: number;
}
