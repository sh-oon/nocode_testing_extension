import { useState } from 'react';
import type { DiffKind, DomDiffChange, DomDiffResult } from '@like-cake/diff-engine';

interface DomDiffPanelProps {
  result?: DomDiffResult;
}

export function DomDiffPanel({ result }: DomDiffPanelProps) {
  const [filter, setFilter] = useState<DiffKind | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-gray-500">
        <DomIcon />
        <p className="mt-2 text-sm">No DOM snapshots to compare</p>
      </div>
    );
  }

  const filteredDiffs = result.differences.filter((diff) => {
    const matchesFilter = filter === 'all' || diff.kind === filter;
    const matchesSearch =
      searchQuery === '' ||
      diff.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      diff.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <SummaryCard
          label="Added"
          value={result.summary.added}
          color="green"
        />
        <SummaryCard
          label="Removed"
          value={result.summary.removed}
          color="red"
        />
        <SummaryCard
          label="Modified"
          value={result.summary.modified}
          color="yellow"
        />
        <SummaryCard
          label="Moved"
          value={result.summary.moved}
          color="blue"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          {(['all', 'added', 'deleted', 'modified', 'moved'] as const).map((filterOption) => (
            <button
              key={filterOption}
              type="button"
              onClick={() => setFilter(filterOption)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                filter === filterOption
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by path or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* Diff List */}
      {filteredDiffs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {result.differences.length === 0 ? (
            <>
              <CheckIcon />
              <p className="mt-2 text-sm">No DOM differences found</p>
            </>
          ) : (
            <p className="text-sm">No matches for current filter</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDiffs.map((diff, index) => (
            <DomDiffItem
              key={index}
              diff={diff}
            />
          ))}
        </div>
      )}
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
  color: 'green' | 'red' | 'yellow' | 'blue';
}) {
  const colorClasses = {
    green: 'bg-green-900/30 text-green-300 border-green-800/50',
    red: 'bg-red-900/30 text-red-300 border-red-800/50',
    yellow: 'bg-yellow-900/30 text-yellow-300 border-yellow-800/50',
    blue: 'bg-blue-900/30 text-blue-300 border-blue-800/50',
  };

  return (
    <div className={`px-3 py-2 rounded border text-center ${colorClasses[color]}`}>
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}

function DomDiffItem({ diff }: { diff: DomDiffChange }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const kindColors: Record<DiffKind, string> = {
    added: 'border-green-800/50 bg-green-900/10',
    deleted: 'border-red-800/50 bg-red-900/10',
    modified: 'border-yellow-800/50 bg-yellow-900/10',
    moved: 'border-blue-800/50 bg-blue-900/10',
    array: 'border-purple-800/50 bg-purple-900/10',
  };

  const changeTypeIcon = {
    element: '🏷️',
    attribute: '📝',
    text: '📄',
    structure: '🏗️',
  };

  return (
    <div className={`border rounded overflow-hidden ${kindColors[diff.kind]}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800/30 transition-colors text-left"
      >
        <ChevronIcon isOpen={isExpanded} />
        <DiffKindBadge kind={diff.kind} />
        <span className="text-xs">{changeTypeIcon[diff.changeType]}</span>
        {diff.tagName && (
          <code className="text-xs bg-gray-800 px-1 py-0.5 rounded text-purple-300">
            &lt;{diff.tagName}&gt;
          </code>
        )}
        <span className="text-sm text-gray-300 truncate flex-1">{diff.path}</span>
      </button>

      {isExpanded && (
        <div className="px-3 py-2 border-t border-gray-700/50 text-sm">
          <p className="text-gray-400 mb-2">{diff.description}</p>

          {diff.attributeName && (
            <div className="mb-2">
              <span className="text-xs text-gray-500">Attribute: </span>
              <code className="text-xs text-blue-300">{diff.attributeName}</code>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {diff.oldValue !== undefined && (
              <div className="bg-red-900/20 p-2 rounded">
                <span className="text-red-400 text-xs block mb-1">Baseline</span>
                <pre className="text-red-200 text-xs overflow-auto max-h-32">
                  {typeof diff.oldValue === 'string'
                    ? diff.oldValue
                    : JSON.stringify(diff.oldValue, null, 2)}
                </pre>
              </div>
            )}
            {diff.newValue !== undefined && (
              <div className="bg-green-900/20 p-2 rounded">
                <span className="text-green-400 text-xs block mb-1">Actual</span>
                <pre className="text-green-200 text-xs overflow-auto max-h-32">
                  {typeof diff.newValue === 'string'
                    ? diff.newValue
                    : JSON.stringify(diff.newValue, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DiffKindBadge({ kind }: { kind: DiffKind }) {
  const colors: Record<DiffKind, string> = {
    added: 'bg-green-800 text-green-200',
    deleted: 'bg-red-800 text-red-200',
    modified: 'bg-yellow-800 text-yellow-200',
    moved: 'bg-blue-800 text-blue-200',
    array: 'bg-purple-800 text-purple-200',
  };

  return (
    <span className={`px-1.5 py-0.5 text-[9px] font-medium uppercase rounded ${colors[kind]}`}>
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

function DomIcon() {
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
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-12 h-12 mx-auto text-green-500"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}
