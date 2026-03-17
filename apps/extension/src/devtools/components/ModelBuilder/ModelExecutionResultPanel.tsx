import { useState } from 'react';
import type { ModelExecutionResult } from '../../../shared/api';

interface ModelExecutionResultPanelProps {
  result: ModelExecutionResult;
}

export function ModelExecutionResultPanel({ result }: ModelExecutionResultPanelProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const statusColor = result.status === 'passed'
    ? 'green' : result.status === 'partial' ? 'yellow' : 'red';

  return (
    <div className="space-y-3">
      {/* Summary Bar */}
      <div className={`px-4 py-3 rounded-md bg-${statusColor}-900/30 border border-${statusColor}-800/50`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-semibold text-${statusColor}-300`}>
            {result.status === 'passed' ? 'All Passed' : result.status === 'partial' ? 'Partial Pass' : 'Failed'}
          </span>
          <span className="text-xs text-gray-400">
            {(result.summary.duration / 1000).toFixed(1)}s
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <SummaryCell label="Total" value={result.summary.totalScenarios} />
          <SummaryCell label="Passed" value={result.summary.passedScenarios} color="text-green-400" />
          <SummaryCell label="Failed" value={result.summary.failedScenarios} color="text-red-400" />
          <SummaryCell label="Skipped" value={result.summary.skippedScenarios} color="text-gray-400" />
        </div>
        <div className="mt-2 text-[10px] text-gray-500">
          Steps: {result.summary.passedSteps}/{result.summary.totalSteps} passed
        </div>
      </div>

      {/* Scenario Results */}
      <div className="space-y-1">
        {result.scenarioResults.map((sr, idx) => {
          const isExpanded = expandedIdx === idx;
          const badge = sr.status === 'passed'
            ? 'bg-green-600/30 text-green-300'
            : sr.status === 'failed'
              ? 'bg-red-600/30 text-red-300'
              : 'bg-gray-600/30 text-gray-400';

          return (
            <div key={sr.scenarioId} className="border border-gray-600 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                className="w-full px-3 py-2 bg-gray-700 flex items-center justify-between hover:bg-gray-650 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${badge}`}>
                    {sr.status}
                  </span>
                  <span className="text-sm text-white">{sr.scenarioName}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{sr.summary.totalSteps} steps</span>
                  <span>{(sr.duration / 1000).toFixed(1)}s</span>
                  <ChevronIcon expanded={isExpanded} />
                </div>
              </button>

              {isExpanded && sr.stepResults.length > 0 && (
                <div className="px-3 py-2 space-y-1 border-t border-gray-600 max-h-48 overflow-y-auto">
                  {sr.stepResults.map((step) => (
                    <div
                      key={step.index}
                      className="flex items-center justify-between text-xs py-0.5"
                    >
                      <div className="flex items-center gap-2">
                        <StatusDot status={step.status} />
                        <span className="text-gray-300 font-mono">
                          [{step.index}]
                        </span>
                        <span className="text-gray-400">{step.stepId}</span>
                      </div>
                      <span className="text-gray-500">{step.duration}ms</span>
                    </div>
                  ))}

                  {/* Show errors */}
                  {sr.stepResults
                    .filter((s) => s.error)
                    .map((s) => (
                      <div key={`err-${s.index}`} className="mt-1 px-2 py-1 bg-red-950/50 rounded text-[10px] text-red-300 font-mono">
                        [{s.index}] {s.error?.message}
                      </div>
                    ))}
                </div>
              )}

              {isExpanded && sr.stepResults.length === 0 && sr.status === 'skipped' && (
                <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-600">
                  이전 시나리오 실패로 건너뜀
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryCell({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'passed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-gray-500';
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} />;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
