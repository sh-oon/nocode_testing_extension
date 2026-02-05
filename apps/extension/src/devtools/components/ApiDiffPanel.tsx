import { useState } from 'react';
import type { ApiCallDiffResult, ApiDiffResult, DiffChange } from '@like-cake/diff-engine';

interface ApiDiffPanelProps {
  result?: ApiDiffResult;
}

export function ApiDiffPanel({ result }: ApiDiffPanelProps) {
  const [expandedCalls, setExpandedCalls] = useState<Set<string>>(new Set());

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
        <ApiIcon />
        <p className="mt-2 text-sm">No API calls captured</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedCalls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <div className="p-4">
      {/* Summary */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <SummaryCard
          label="Total"
          value={result.summary.total}
        />
        <SummaryCard
          label="Matched"
          value={result.summary.matched}
          color="green"
        />
        <SummaryCard
          label="Different"
          value={result.summary.different}
          color="red"
        />
        <SummaryCard
          label="Missing"
          value={result.summary.missing}
          color="yellow"
        />
        <SummaryCard
          label="Extra"
          value={result.summary.extra}
          color="blue"
        />
      </div>

      {/* API Call List */}
      <div className="space-y-2">
        {result.calls.map((call) => (
          <ApiCallItem
            key={call.requestId}
            call={call}
            isExpanded={expandedCalls.has(call.requestId)}
            onToggle={() => toggleExpand(call.requestId)}
          />
        ))}

        {/* Missing Calls */}
        {result.missingCalls.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-yellow-400 mb-2">
              Missing API Calls ({result.missingCalls.length})
            </h3>
            <div className="space-y-1">
              {result.missingCalls.map((call) => (
                <div
                  key={call.request.id}
                  className="flex items-center gap-2 px-3 py-2 bg-yellow-900/20 border border-yellow-800/50 rounded text-sm"
                >
                  <MethodBadge method={call.request.method} />
                  <span className="text-yellow-200 truncate">{call.request.url}</span>
                  <span className="text-xs text-yellow-500 ml-auto">Not found in playback</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Extra Calls */}
        {result.extraCalls.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-blue-400 mb-2">
              Extra API Calls ({result.extraCalls.length})
            </h3>
            <div className="space-y-1">
              {result.extraCalls.map((call) => (
                <div
                  key={call.request.id}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-900/20 border border-blue-800/50 rounded text-sm"
                >
                  <MethodBadge method={call.request.method} />
                  <span className="text-blue-200 truncate">{call.request.url}</span>
                  <span className="text-xs text-blue-500 ml-auto">New in playback</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: 'green' | 'red' | 'yellow' | 'blue';
}) {
  const colorClasses = {
    green: 'bg-green-900/30 text-green-300 border-green-800/50',
    red: 'bg-red-900/30 text-red-300 border-red-800/50',
    yellow: 'bg-yellow-900/30 text-yellow-300 border-yellow-800/50',
    blue: 'bg-blue-900/30 text-blue-300 border-blue-800/50',
  };

  return (
    <div
      className={`px-3 py-2 rounded border text-center ${
        color ? colorClasses[color] : 'bg-gray-800 text-gray-300 border-gray-700'
      }`}
    >
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}

function ApiCallItem({
  call,
  isExpanded,
  onToggle,
}: {
  call: ApiCallDiffResult;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasDiffs = call.requestDiffs.length > 0 || call.responseDiffs.length > 0;

  return (
    <div
      className={`border rounded overflow-hidden ${
        call.passed ? 'border-gray-700 bg-gray-800/30' : 'border-red-800/50 bg-red-900/10'
      }`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800/50 transition-colors"
      >
        <ChevronIcon isOpen={isExpanded} />
        <MethodBadge method={call.method} />
        <span className="text-sm text-gray-200 truncate flex-1 text-left">{call.url}</span>
        {call.statusChanged && (
          <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded">
            {call.baselineStatus} → {call.actualStatus}
          </span>
        )}
        {call.passed ? (
          <span className="text-xs text-green-400">✓ Match</span>
        ) : (
          <span className="text-xs text-red-400">
            {call.requestDiffs.length + call.responseDiffs.length} diffs
          </span>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && hasDiffs && (
        <div className="px-3 py-2 border-t border-gray-700/50 space-y-3">
          {call.requestDiffs.length > 0 && (
            <DiffSection
              title="Request Differences"
              diffs={call.requestDiffs}
            />
          )}
          {call.responseDiffs.length > 0 && (
            <DiffSection
              title="Response Differences"
              diffs={call.responseDiffs}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DiffSection({ title, diffs }: { title: string; diffs: DiffChange[] }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-gray-400 mb-1">{title}</h4>
      <div className="space-y-1">
        {diffs.map((diff, index) => (
          <div
            key={index}
            className="text-xs bg-gray-900/50 rounded p-2"
          >
            <div className="flex items-center gap-2">
              <DiffKindBadge kind={diff.kind} />
              <code className="text-gray-300">{diff.path.join('.')}</code>
            </div>
            <p className="text-gray-400 mt-1">{diff.description}</p>
            {(diff.lhs !== undefined || diff.rhs !== undefined) && (
              <div className="mt-1 grid grid-cols-2 gap-2">
                {diff.lhs !== undefined && (
                  <div className="bg-red-900/20 p-1 rounded">
                    <span className="text-red-400 text-[10px] block mb-0.5">Baseline</span>
                    <code className="text-red-200 text-[11px] break-all">
                      {JSON.stringify(diff.lhs, null, 0)}
                    </code>
                  </div>
                )}
                {diff.rhs !== undefined && (
                  <div className="bg-green-900/20 p-1 rounded">
                    <span className="text-green-400 text-[10px] block mb-0.5">Actual</span>
                    <code className="text-green-200 text-[11px] break-all">
                      {JSON.stringify(diff.rhs, null, 0)}
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-green-700 text-green-100',
    POST: 'bg-blue-700 text-blue-100',
    PUT: 'bg-yellow-700 text-yellow-100',
    PATCH: 'bg-orange-700 text-orange-100',
    DELETE: 'bg-red-700 text-red-100',
  };

  return (
    <span
      className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${colors[method] || 'bg-gray-700 text-gray-300'}`}
    >
      {method}
    </span>
  );
}

function DiffKindBadge({ kind }: { kind: string }) {
  const colors: Record<string, string> = {
    added: 'bg-green-800 text-green-200',
    deleted: 'bg-red-800 text-red-200',
    modified: 'bg-yellow-800 text-yellow-200',
    moved: 'bg-blue-800 text-blue-200',
    array: 'bg-purple-800 text-purple-200',
  };

  return (
    <span
      className={`px-1 py-0.5 text-[9px] font-medium uppercase rounded ${colors[kind] || 'bg-gray-700 text-gray-300'}`}
    >
      {kind}
    </span>
  );
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function ApiIcon() {
  return (
    <svg
      className="w-12 h-12"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}
