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
 * Scenario data from Backend
 */
export interface BackendScenario {
  id: string;
  name: string;
  steps: Array<{ type: string }>;
}

/**
 * Backend API Client
 */
export class BackendApiClient {
  private baseUrl: string;

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
  async sendEvents(
    sessionId: string,
    events: RawEvent[]
  ): Promise<ApiResponse<{ count: number }>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/sessions/${sessionId}/events/batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events }),
        }
      );
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
      const response = await fetch(
        `${this.baseUrl}/api/sessions/${sessionId}/stop`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
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
}

// Singleton instance
let apiClient: BackendApiClient | null = null;

/**
 * Get or create API client instance
 */
export async function getApiClient(): Promise<BackendApiClient> {
  const settings = await getSettings();
  const url = settings.backendUrl || 'http://localhost:3001';

  if (!apiClient || apiClient['baseUrl'] !== url) {
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
  const url = settings.backendUrl || 'http://localhost:3001';
  const client = new BackendApiClient(url);
  const connected = await client.healthCheck();

  return { connected, url };
}
