import { useCallback, useEffect, useState } from 'react';
import type { FlowNode } from '@like-cake/ast-types';
import { getApiClient, type BackendUserFlow } from '../../../shared/api';
import { ConfirmModal } from '../ConfirmModal';
import { FlowCard } from './FlowCard';
import { FlowSearchBar, type SortOption } from './FlowSearchBar';

interface FlowListPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFlow: (flowId: string) => void;
  onCreateNew: () => void;
  currentFlowId?: string | null;
}

export function FlowListPanel({
  isOpen,
  onClose,
  onSelectFlow,
  onCreateNew,
  currentFlowId,
}: FlowListPanelProps) {
  const [flows, setFlows] = useState<BackendUserFlow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updatedAt');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Fetch flow list when panel opens or search/sort changes
  const loadFlows = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const client = await getApiClient();
      const response = await client.listUserFlows({
        search: searchQuery.trim() || undefined,
        sort: sortBy,
        order: sortBy === 'name' ? 'asc' : 'desc',
      });

      if (response.success && response.data) {
        setFlows(response.data.items || []);
      } else {
        setError(response.error || '플로우 목록을 불러오지 못했습니다.');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, sortBy]);

  useEffect(() => {
    if (isOpen) {
      loadFlows();
    }
  }, [isOpen, loadFlows]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handlers
  const handleDeleteRequest = useCallback(
    (flowId: string) => {
      const flow = flows.find((f) => f.id === flowId);
      if (flow) {
        setDeleteTarget({ id: flow.id, name: flow.name });
      }
    },
    [flows]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      const client = await getApiClient();
      const response = await client.deleteUserFlow(deleteTarget.id);

      if (response.success) {
        setFlows((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      } else {
        console.error('Failed to delete flow:', response.error);
      }
    } catch (err) {
      console.error('Failed to delete flow:', err);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget]);

  const handleDuplicate = useCallback(
    async (flowId: string) => {
      try {
        const client = await getApiClient();
        const response = await client.duplicateUserFlow(flowId);

        if (response.success && response.data) {
          setFlows((prev) => [response.data as BackendUserFlow, ...prev]);
        } else {
          console.error('Failed to duplicate flow:', response.error);
        }
      } catch (err) {
        console.error('Failed to duplicate flow:', err);
      }
    },
    []
  );

  const handleRename = useCallback(
    async (flowId: string, newName: string) => {
      try {
        const client = await getApiClient();
        const response = await client.updateUserFlow(flowId, { name: newName });

        if (response.success && response.data) {
          setFlows((prev) =>
            prev.map((f) =>
              f.id === flowId ? { ...f, name: newName } : f
            )
          );
        } else {
          console.error('Failed to rename flow:', response.error);
        }
      } catch (err) {
        console.error('Failed to rename flow:', err);
      }
    },
    []
  );

  const handleCreateNew = useCallback(() => {
    onCreateNew();
    onClose();
  }, [onCreateNew, onClose]);

  const handleSelectFlow = useCallback(
    (flowId: string) => {
      onSelectFlow(flowId);
      onClose();
    },
    [onSelectFlow, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex" data-test-id="flow-list-panel">
      {/* Overlay backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <aside
        className="relative w-80 max-w-[85vw] bg-gray-800 border-r border-gray-700 shadow-2xl flex flex-col h-full animate-slide-in-left"
        role="dialog"
        aria-label="플로우 목록"
      >
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">플로우 목록</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateNew}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
              data-test-id="flow-create-new-button"
            >
              + 새 플로우
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              aria-label="패널 닫기"
              data-test-id="flow-list-close-button"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        {/* Search and sort */}
        <FlowSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Flow list content */}
        <div className="flex-1 overflow-y-auto" data-test-id="flow-list-content">
          {isLoading ? (
            <div
              className="flex items-center justify-center py-12"
              data-test-id="flow-list-loading"
            >
              <LoadingSpinner />
              <span className="ml-2 text-sm text-gray-400">불러오는 중...</span>
            </div>
          ) : error ? (
            <div
              className="m-4 p-3 bg-red-900/50 border border-red-800 rounded-md text-sm text-red-200"
              data-test-id="flow-list-error"
            >
              <p>{error}</p>
              <button
                type="button"
                onClick={loadFlows}
                className="mt-2 text-xs text-red-300 hover:text-red-100 underline"
              >
                다시 시도
              </button>
            </div>
          ) : flows.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 px-4"
              data-test-id="flow-list-empty"
            >
              {searchQuery.trim() ? (
                <>
                  <EmptySearchIcon />
                  <p className="mt-3 text-sm text-gray-400">
                    "{searchQuery}"에 대한 검색 결과가 없습니다.
                  </p>
                </>
              ) : (
                <>
                  <EmptyIcon />
                  <p className="mt-3 text-sm text-gray-400">
                    아직 생성된 플로우가 없습니다.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className="mt-3 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                    data-test-id="flow-create-empty-button"
                  >
                    첫 플로우 만들기
                  </button>
                </>
              )}
            </div>
          ) : (
            <nav aria-label="플로우 목록">
              <div className="divide-y divide-gray-700/50">
                {flows.map((flow) => (
                  <FlowCard
                    key={flow.id}
                    flow={{
                      id: flow.id,
                      name: flow.name,
                      description: flow.description,
                      nodes: flow.nodes as FlowNode[],
                      updatedAt: flow.updatedAt,
                    }}
                    isActive={flow.id === currentFlowId}
                    onSelect={handleSelectFlow}
                    onDelete={handleDeleteRequest}
                    onDuplicate={handleDuplicate}
                    onRename={handleRename}
                  />
                ))}
              </div>
            </nav>
          )}
        </div>

        {/* Footer with count */}
        {!isLoading && !error && flows.length > 0 && (
          <footer className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
            {`총 ${flows.length}개 플로우`}
          </footer>
        )}
      </aside>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="플로우 삭제"
        message={`"${deleteTarget?.name}" 플로우를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Inline animation style */}
      <style>{`
        @keyframes slide-in-left {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-left {
          animation: slide-in-left 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      className="w-5 h-5"
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
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="w-5 h-5 animate-spin text-blue-400"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function EmptyIcon() {
  return (
    <svg
      className="w-12 h-12 text-gray-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

function EmptySearchIcon() {
  return (
    <svg
      className="w-12 h-12 text-gray-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
