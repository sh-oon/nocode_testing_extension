import type { FlowEdge, FlowNode, FlowNodeResult, ScenarioResult, Step } from '@like-cake/ast-types';
import type { RawEvent } from '@like-cake/event-collector';

/**
 * Recording session status
 */
export type SessionStatus = 'recording' | 'paused' | 'stopped' | 'completed';

/**
 * Recording session stored in database
 */
export interface Session {
  id: string;
  name?: string;
  url: string;
  startedAt: number;
  endedAt?: number;
  status: SessionStatus;
  viewport: {
    width: number;
    height: number;
  };
  userAgent?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Session creation input
 */
export interface CreateSessionInput {
  url: string;
  name?: string;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string;
}

/**
 * Session update input
 */
export interface UpdateSessionInput {
  name?: string;
  status?: SessionStatus;
  endedAt?: number;
}

/**
 * Session with events (for API response)
 */
export interface SessionWithEvents extends Session {
  events: RawEvent[];
  eventCount: number;
}

/**
 * Raw event stored in database
 */
export interface StoredRawEvent {
  id: string;
  sessionId: string;
  type: string;
  timestamp: number;
  data: string; // JSON stringified RawEvent
  createdAt: number;
}

/**
 * Scenario stored in database
 */
export interface StoredScenario {
  id: string;
  sessionId?: string;
  name?: string;
  description?: string;
  url: string;
  viewport: {
    width: number;
    height: number;
  };
  steps: Step[];
  setup?: Step[];
  teardown?: Step[];
  variables?: Record<string, string | number | boolean>;
  tags?: string[];
  recordedAt: number;
  astSchemaVersion: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Scenario creation input
 */
export interface CreateScenarioInput {
  sessionId?: string;
  name?: string;
  description?: string;
  url: string;
  viewport?: {
    width: number;
    height: number;
  };
  steps: Step[];
  setup?: Step[];
  teardown?: Step[];
  variables?: Record<string, string | number | boolean>;
  tags?: string[];
}

/**
 * Scenario update input
 */
export interface UpdateScenarioInput {
  name?: string;
  description?: string;
  steps?: Step[];
  setup?: Step[];
  teardown?: Step[];
  variables?: Record<string, string | number | boolean>;
  tags?: string[];
}

/**
 * Execution result stored in database
 */
export interface StoredExecutionResult {
  id: string;
  scenarioId: string;
  status: 'passed' | 'failed' | 'skipped';
  totalSteps: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  stepResults: ScenarioResult['stepResults'];
  environment?: {
    os?: string;
    nodeVersion?: string;
    puppeteerVersion?: string;
    chromeVersion?: string;
    headless?: boolean;
    userAgent?: string;
    [key: string]: unknown;
  };
  executedAt: number;
  createdAt: number;
}

/**
 * User flow stored in database
 */
export interface StoredUserFlow {
  id: string;
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables?: Record<string, string | number | boolean>;
  createdAt: number;
  updatedAt: number;
}

/**
 * User flow creation input
 */
export interface CreateUserFlowInput {
  name: string;
  description?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  variables?: Record<string, string | number | boolean>;
}

/**
 * User flow update input
 */
export interface UpdateUserFlowInput {
  name?: string;
  description?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  variables?: Record<string, string | number | boolean>;
}

/**
 * Flow execution result stored in database
 */
export interface StoredFlowExecutionResult {
  id: string;
  flowId: string;
  status: 'passed' | 'failed' | 'skipped';
  totalNodes: number;
  passedNodes: number;
  failedNodes: number;
  skippedNodes: number;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  duration: number;
  nodeResults: FlowNodeResult[];
  startedAt: number;
  endedAt: number;
  createdAt: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * List response with pagination
 */
export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
