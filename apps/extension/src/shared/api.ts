import type { FlowEdge, FlowNode, FlowNodeResult } from '@like-cake/ast-types';
import type { RawEvent } from '@like-cake/event-collector';
import { getSettings } from './storage';

/**
 * API Response wrapper
 */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Session data from Backend
 */
export interface BackendSession {
  id: string;
  name: string;
  url: string;
  status: 'recording' | 'stopped' | 'completed';
  startedAt: number;
  endedAt?: number;
}

/**
 * Scenario data from Backend (list view)
 */
export interface BackendScenario {
  id: string;
  name: string;
  steps: Array<{ type: string }>;
}

/**
 * Scenario detail from Backend (full data)
 */
export interface BackendScenarioDetail {
  id: string;
  sessionId?: string;
  name?: string;
  description?: string;
  url: string;
  viewport: { width: number; height: number };
  steps: Array<{ type: string; [key: string]: unknown }>;
  setup?: Array<{ type: string; [key: string]: unknown }>;
  teardown?: Array<{ type: string; [key: string]: unknown }>;
  variables?: Record<string, string | number | boolean>;
  tags?: string[];
  recordedAt: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Execution result from Backend
 */
export interface ExecutionResult {
  scenarioId: string;
  scenarioName?: string;
  stepResults: Array<{
    stepId: string;
    index: number;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    error?: { message: string; stack?: string };
  }>;
  summary: {
    totalSteps: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    success: boolean;
  };
  startedAt: number;
  endedAt: number;
}

/**
 * User flow data from Backend
 */
export interface BackendUserFlow {
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
 * Flow execution result from Backend
 */
export interface FlowExecutionResult {
  flowId: string;
  status: 'passed' | 'failed' | 'skipped';
  nodeResults: FlowNodeResult[];
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
}

/**
 * Backend API Client
 */
export class BackendApiClient {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Check if Backend is reachable
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create a new recording session
   */
  async createSession(params: {
    url: string;
    name?: string;
    viewport?: { width: number; height: number };
  }): Promise<ApiResponse<BackendSession>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create session',
      };
    }
  }

  /**
   * Send events to Backend (batch)
   */
  async sendEvents(sessionId: string, events: RawEvent[]): Promise<ApiResponse<{ count: number }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/events/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send events',
      };
    }
  }

  /**
   * Stop recording session
   */
  async stopSession(sessionId: string): Promise<ApiResponse<BackendSession>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop session',
      };
    }
  }

  /**
   * Create scenario from session
   */
  async createScenarioFromSession(
    sessionId: string,
    name?: string
  ): Promise<ApiResponse<BackendScenario>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scenarios/from-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name }),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create scenario',
      };
    }
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<ApiResponse<BackendSession>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get session',
      };
    }
  }

  /**
   * Create scenario directly
   */
  async createScenario(params: {
    name?: string;
    url: string;
    steps: unknown[];
    viewport?: { width: number; height: number };
  }): Promise<ApiResponse<BackendScenario>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create scenario',
      };
    }
  }

  /**
   * Execute scenario via Puppeteer
   */
  async executeScenario(
    scenarioId: string,
    options?: { headless?: boolean; timeout?: number }
  ): Promise<ApiResponse<ExecutionResult>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scenarios/${scenarioId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute scenario',
      };
    }
  }

  /**
   * List scenarios
   */
  async listScenarios(): Promise<ApiResponse<{ items: BackendScenario[] }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scenarios`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list scenarios',
      };
    }
  }

  /**
   * Get scenario by ID
   */
  async getScenario(scenarioId: string): Promise<ApiResponse<BackendScenarioDetail>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scenarios/${scenarioId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get scenario',
      };
    }
  }

  /**
   * Update scenario
   */
  async updateScenario(
    scenarioId: string,
    params: {
      name?: string;
      description?: string;
      tags?: string[];
      steps?: Array<{ type: string; [key: string]: unknown }>;
    }
  ): Promise<ApiResponse<BackendScenarioDetail>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scenarios/${scenarioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update scenario',
      };
    }
  }

  /**
   * Delete scenario
   */
  async deleteScenario(scenarioId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/scenarios/${scenarioId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete scenario',
      };
    }
  }

  // ============ User Flow API ============

  /**
   * List user flows
   */
  async listUserFlows(): Promise<ApiResponse<{ items: BackendUserFlow[] }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/userflows`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list user flows',
      };
    }
  }

  /**
   * Create a new user flow
   */
  async createUserFlow(params: {
    name: string;
    description?: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    variables?: Record<string, string | number | boolean>;
  }): Promise<ApiResponse<BackendUserFlow>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/userflows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user flow',
      };
    }
  }

  /**
   * Get user flow by ID
   */
  async getUserFlow(flowId: string): Promise<ApiResponse<BackendUserFlow>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/userflows/${flowId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user flow',
      };
    }
  }

  /**
   * Update user flow
   */
  async updateUserFlow(
    flowId: string,
    params: {
      name?: string;
      description?: string;
      nodes?: FlowNode[];
      edges?: FlowEdge[];
      variables?: Record<string, string | number | boolean>;
    }
  ): Promise<ApiResponse<BackendUserFlow>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/userflows/${flowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update user flow',
      };
    }
  }

  /**
   * Delete user flow
   */
  async deleteUserFlow(flowId: string): Promise<ApiResponse<{ deleted: boolean }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/userflows/${flowId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete user flow',
      };
    }
  }

  /**
   * Execute user flow
   */
  async executeUserFlow(
    flowId: string,
    options?: { headless?: boolean; timeout?: number }
  ): Promise<ApiResponse<FlowExecutionResult>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/userflows/${flowId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options || {}),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute user flow',
      };
    }
  }
}

// Singleton instance
let apiClient: BackendApiClient | null = null;

/**
 * Get or create API client instance
 */
export async function getApiClient(): Promise<BackendApiClient> {
  const settings = await getSettings();
  const url = settings.backendUrl || 'http://localhost:4000';

  if (!apiClient || apiClient.baseUrl !== url) {
    apiClient = new BackendApiClient(url);
  }

  return apiClient;
}

/**
 * Check Backend connection status
 */
export async function checkBackendConnection(): Promise<{
  connected: boolean;
  url: string;
}> {
  const settings = await getSettings();
  const url = settings.backendUrl || 'http://localhost:4000';
  const client = new BackendApiClient(url);
  const connected = await client.healthCheck();

  return { connected, url };
}

// Re-export getSettings for convenience
export { getSettings };
