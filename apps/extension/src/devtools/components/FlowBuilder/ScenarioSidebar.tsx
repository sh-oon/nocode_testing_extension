import type { DragEvent, MouseEvent } from 'react';

export interface SidebarScenario {
  id: string;
  name: string;
  stepCount: number;
}

interface ScenarioSidebarProps {
  scenarios: SidebarScenario[];
  isLoading: boolean;
  onRefresh: () => void;
  onScenarioEdit?: (scenarioId: string) => void;
}

export function ScenarioSidebar({
  scenarios,
  isLoading,
  onRefresh,
  onScenarioEdit,
}: ScenarioSidebarProps) {
  const onDragStart = (event: DragEvent<HTMLDivElement>, scenario: SidebarScenario) => {
    event.dataTransfer.setData('application/reactflow', 'scenario');
    event.dataTransfer.setData('scenario', JSON.stringify(scenario));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleEditClick = (event: MouseEvent, scenarioId: string) => {
    event.stopPropagation();
    event.preventDefault();
    onScenarioEdit?.(scenarioId);
  };

  return (
    <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300">Scenarios</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1 text-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          aria-label="Refresh scenarios"
        >
          <RefreshIcon spinning={isLoading} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading && scenarios.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
        ) : scenarios.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            No scenarios found.
            <br />
            Record some scenarios first.
          </div>
        ) : (
          scenarios.map((scenario) => (
            <div
              key={scenario.id}
              draggable
              onDragStart={(e) => onDragStart(e, scenario)}
              className="group p-3 bg-gray-700 rounded-lg border border-gray-600 cursor-grab hover:bg-gray-600 hover:border-gray-500 transition-colors active:cursor-grabbing"
            >
              <div className="flex items-start gap-2">
                <ScenarioIcon />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium truncate">
                    {scenario.name || 'Unnamed'}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{scenario.stepCount} steps</div>
                </div>
                {onScenarioEdit && (
                  <button
                    type="button"
                    onClick={(e) => handleEditClick(e, scenario.id)}
                    className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Edit scenario"
                    title="Edit scenario"
                  >
                    <EditIcon />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-500">
        Drag to canvas / Click edit to rename
      </div>
    </div>
  );
}

function ScenarioIcon() {
  return (
    <svg
      className="w-4 h-4 text-primary-400 flex-shrink-0 mt-0.5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
      />
    </svg>
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

function EditIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}
