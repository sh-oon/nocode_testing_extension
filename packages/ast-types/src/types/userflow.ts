/**
 * User Flow types for combining multiple scenarios into a flow
 * Supports conditional branching and variable passing between scenarios
 */

// ============================================================================
// Variable System Types
// ============================================================================

/**
 * Supported variable value types
 */
export type FlowVariableValue = string | number | boolean | null | FlowVariableObject | FlowVariableArray;

export interface FlowVariableObject {
  [key: string]: FlowVariableValue;
}

export type FlowVariableArray = FlowVariableValue[];

/**
 * Condition operators for flow branching
 */
export type ConditionOperator =
  | 'eq' // equals
  | 'ne' // not equals
  | 'gt' // greater than
  | 'gte' // greater than or equal
  | 'lt' // less than
  | 'lte' // less than or equal
  | 'contains' // string contains
  | 'startsWith' // string starts with
  | 'endsWith' // string ends with
  | 'matches' // regex match
  | 'exists' // value exists (not null/undefined)
  | 'isEmpty'; // value is empty (null, undefined, '', [], {})

/**
 * Single condition for flow branching
 */
export interface FlowCondition {
  /** Left operand - can be {{varName}} or literal */
  left: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Right operand - optional for unary operators like exists/isEmpty */
  right?: string;
}

/**
 * Variable extraction source types
 */
export type ExtractionSource = 'lastApiResponse' | 'element' | 'url' | 'localStorage' | 'cookie';

/**
 * Variable extraction definition
 */
export interface VariableExtraction {
  /** Name of the variable to create/update */
  variableName: string;
  /** Source to extract from */
  source: ExtractionSource;
  /** JSONPath for API response extraction (e.g., $.data.user.id) */
  jsonPath?: string;
  /** CSS selector for element extraction */
  selector?: string;
  /** Attribute name for element extraction (default: textContent) */
  attribute?: string;
  /** Regex pattern for URL/string extraction */
  pattern?: string;
  /** Capture group index for regex pattern (default: 1) */
  captureGroup?: number;
  /** Default value if extraction fails */
  defaultValue?: FlowVariableValue;
}

/**
 * Variable assignment definition
 */
export interface VariableAssignment {
  /** Variable name */
  name: string;
  /** Value to assign (can use {{var}} interpolation) */
  value: string;
  /** Type hint for value parsing */
  type: 'string' | 'number' | 'boolean' | 'json';
}

// ============================================================================
// Flow Types
// ============================================================================

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
  /** Flow nodes (scenarios, start, end, condition, variable nodes) */
  nodes: FlowNode[];
  /** Connections between nodes */
  edges: FlowEdge[];
  /** Variables shared across all scenarios */
  variables?: Record<string, FlowVariableValue>;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Node types in a flow
 */
export type FlowNodeType =
  | 'scenario' // Execute a scenario
  | 'start' // Flow entry point
  | 'end' // Flow exit point
  | 'condition' // IF/ELSE branching
  | 'setVariable' // Set variable values
  | 'extractVariable'; // Extract variables from context

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

// ============================================================================
// New Node Types for Conditional Branching and Variables
// ============================================================================

/**
 * Data for a condition node
 */
export interface ConditionNodeData {
  /** Display label */
  label: string;
  /** Condition to evaluate */
  condition: FlowCondition;
  /** Execution status */
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  /** Last evaluation result */
  lastResult?: boolean;
}

/**
 * Condition node for IF/ELSE branching
 * Has two output handles: 'true' and 'false'
 */
export interface ConditionFlowNode extends BaseFlowNode {
  type: 'condition';
  data: ConditionNodeData;
}

/**
 * Data for a set variable node
 */
export interface SetVariableNodeData {
  /** Display label */
  label: string;
  /** Variables to set */
  variables: VariableAssignment[];
  /** Execution status */
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
}

/**
 * Set variable node for assigning values
 */
export interface SetVariableFlowNode extends BaseFlowNode {
  type: 'setVariable';
  data: SetVariableNodeData;
}

/**
 * Data for an extract variable node
 */
export interface ExtractVariableNodeData {
  /** Display label */
  label: string;
  /** Extractions to perform */
  extractions: VariableExtraction[];
  /** Execution status */
  status?: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
}

/**
 * Extract variable node for capturing values from context
 */
export interface ExtractVariableFlowNode extends BaseFlowNode {
  type: 'extractVariable';
  data: ExtractVariableNodeData;
}

/**
 * Discriminated union of all flow node types
 */
export type FlowNode =
  | ScenarioFlowNode
  | StartFlowNode
  | EndFlowNode
  | ConditionFlowNode
  | SetVariableFlowNode
  | ExtractVariableFlowNode;

/**
 * Edge connecting two nodes
 * For condition nodes, sourceHandle specifies the branch (true/false)
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
  /** Source handle ID - for condition nodes: 'true' or 'false' */
  sourceHandle?: 'true' | 'false' | string;
  /** Target handle ID */
  targetHandle?: string;
  /** Edge type for styling */
  type?: 'default' | 'smoothstep' | 'step' | 'straight';
  /** Whether this edge is animated */
  animated?: boolean;
}

/**
 * Input for creating a new user flow
 */
export interface UserFlowInput {
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables?: Record<string, FlowVariableValue>;
}

/**
 * Input for updating an existing user flow
 */
export interface UserFlowUpdateInput {
  name?: string;
  description?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  variables?: Record<string, FlowVariableValue>;
}

/**
 * Execution result for a single node
 */
export interface FlowNodeResult {
  /** Node ID */
  nodeId: string;
  /** Node type */
  nodeType: FlowNodeType;
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
  /** Condition evaluation result (for condition nodes) */
  conditionResult?: {
    /** The evaluated result (true/false) */
    result: boolean;
    /** The evaluated left value */
    leftValue: FlowVariableValue;
    /** The evaluated right value */
    rightValue?: FlowVariableValue;
  };
  /** Variable operation result (for setVariable/extractVariable nodes) */
  variableResult?: {
    /** Variables that were set/extracted */
    variables: Record<string, FlowVariableValue>;
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
