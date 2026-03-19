import { useCallback, useEffect, useState } from 'react';
import { getApiClient, type StoredExecutionResultItem } from '../../../shared/api';

interface ExecutionHistoryPanelProps {
  scenarioId: string;
  onClose: () => void;
}

export function ExecutionHistoryPanel({ scenarioId, onClose }: ExecutionHistoryPanelProps) {
  const [results, setResults] = useState<StoredExecutionResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const client = await getApiClient();
      const response = await client.getExecutionHistory(scenarioId, { limit: 20 });
      if (response.success && response.data) {
        setResults(response.data.items);
        setTotal(response.data.total);
      }
    } finally {
      setIsLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">실행 히스토리</h3>
            <span className="text-xs text-gray-400">{total}개 기록</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="text-sm text-gray-400 text-center py-12">로딩 중...</div>
          ) : results.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-12">실행 기록이 없습니다</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {results.map((result) => (
                <HistoryItem
                  key={result.id}
                  result={result}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryItem({ result }: { result: StoredExecutionResultItem }) {
  const isPassed = result.status === 'passed';
  const date = new Date(result.executedAt);

  return (
    <div className="px-5 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isPassed ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className={`text-sm font-medium ${isPassed ? 'text-green-700' : 'text-red-700'}`}>
            {isPassed ? 'Passed' : 'Failed'}
          </span>
        </div>
        <span className="text-[10px] text-gray-400">
          {date.toLocaleDateString('ko-KR')}{' '}
          {date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>
          Steps: <span className="text-green-600">{result.passed}</span>/
          <span className="text-gray-700">{result.totalSteps}</span>
        </span>
        {result.failed > 0 && <span className="text-red-500">{result.failed} failed</span>}
        {result.skipped > 0 && <span className="text-gray-400">{result.skipped} skipped</span>}
        <span>{(result.duration / 1000).toFixed(1)}s</span>
      </div>
    </div>
  );
}
