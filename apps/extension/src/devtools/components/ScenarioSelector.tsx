import { useCallback, useEffect, useState } from 'react';
import type { Scenario } from '@like-cake/ast-types';
import { getApiClient, type BackendScenarioDetail } from '../../shared/api';

interface ScenarioSelectorProps {
  isConnected: boolean;
  onSelect: (scenario: Scenario, backendId: string) => void;
}

interface ScenarioListItem {
  id: string;
  name: string;
  stepCount: number;
  url: string;
  createdAt: number;
}

export function ScenarioSelector({ isConnected, onSelect }: ScenarioSelectorProps) {
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingScenario, setIsLoadingScenario] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load scenarios from backend
  const loadScenarios = useCallback(async () => {
    if (!isConnected) return;

    setIsLoading(true);
    setError(null);

    try {
      const client = await getApiClient();
      const response = await client.listScenarios();

      if (response.success && response.data) {
        const items = response.data.items || [];
        setScenarios(
          items.map((s: BackendScenarioDetail | { id: string; name?: string; steps?: unknown[]; url?: string; createdAt?: number }) => ({
            id: s.id,
            name: s.name || 'Unnamed',
            stepCount: Array.isArray(s.steps) ? s.steps.length : 0,
            url: ('url' in s ? s.url : '') || '',
            createdAt: ('createdAt' in s ? s.createdAt : 0) || 0,
          }))
        );
      } else {
        setError(response.error || 'Failed to load scenarios');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  // Load scenarios on mount and when connection changes
  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  // Handle scenario selection
  const handleSelect = useCallback(
    async (scenarioId: string) => {
      setIsLoadingScenario(scenarioId);
      setError(null);

      try {
        const client = await getApiClient();
        const response = await client.getScenario(scenarioId);

        if (response.success && response.data) {
          const data = response.data;
          // Convert to Scenario type
          const scenario: Scenario = {
            id: data.id,
            name: data.name,
            meta: {
              recordedAt: new Date(data.recordedAt).toISOString(),
              url: data.url,
              viewport: data.viewport,
              astSchemaVersion: '1.0.0',
            },
            steps: data.steps as Scenario['steps'],
          };
          onSelect(scenario, data.id);
        } else {
          setError(response.error || 'Failed to load scenario');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoadingScenario(null);
      }
    },
    [onSelect]
  );

  if (!isConnected) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        Connect to backend to load scenarios
      </div>
    );
  }

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-300">Server Scenarios</h4>
        <button
          type="button"
          onClick={loadScenarios}
          disabled={isLoading}
          className="p-1 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          aria-label="Refresh"
        >
          <RefreshIcon spinning={isLoading} />
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 bg-red-900/30 border-b border-red-800 text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Scenario list */}
      <div className="max-h-48 overflow-y-auto">
        {isLoading && scenarios.length === 0 ? (
          <div className="px-3 py-4 text-center text-gray-500 text-sm">Loading...</div>
        ) : scenarios.length === 0 ? (
          <div className="px-3 py-4 text-center text-gray-500 text-sm">
            No scenarios found.
            <br />
            Record some scenarios first.
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                onClick={() => handleSelect(scenario.id)}
                disabled={isLoadingScenario !== null}
                className="w-full px-3 py-2 text-left hover:bg-gray-700/50 disabled:opacity-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">
                      {scenario.name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                      <span>{scenario.stepCount} steps</span>
                      <span className="text-gray-600">•</span>
                      <span className="truncate max-w-[150px]" title={scenario.url}>
                        {scenario.url ? new URL(scenario.url).hostname : 'Unknown'}
                      </span>
                    </div>
                  </div>
                  {isLoadingScenario === scenario.id ? (
                    <LoadingSpinner />
                  ) : (
                    <ChevronIcon />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="w-4 h-4 animate-spin text-primary-400"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
