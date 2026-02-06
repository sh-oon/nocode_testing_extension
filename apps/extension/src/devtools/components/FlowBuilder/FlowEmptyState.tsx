/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FlowEmptyStateProps {
  onOpenList: () => void;
  onCreateNew: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function FlowEmptyState({ onOpenList, onCreateNew }: FlowEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full select-none"
      data-test-id="flow-empty-state"
    >
      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-700/60 mb-6">
        <FlowIcon />
      </div>

      {/* Heading */}
      <h2 className="text-xl font-semibold text-gray-100 mb-2">
        테스트 플로우 빌더
      </h2>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-8 max-w-xs text-center leading-relaxed">
        시나리오를 연결하여 E2E 테스트 플로우를 구성하세요.
        조건 분기와 변수를 활용할 수 있습니다.
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenList}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          data-test-id="flow-empty-open-list"
        >
          <FolderOpenIcon />
          기존 플로우 열기
        </button>

        <button
          type="button"
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-test-id="flow-empty-create-new"
        >
          <PlusIcon />
          새 플로우 만들기
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function FlowIcon() {
  return (
    <svg
      className="w-8 h-8 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {/* A simple flow/nodes diagram icon */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4zM7 10v2a2 2 0 002 2h4M17 10v-2a2 2 0 00-2-2h-4"
      />
    </svg>
  );
}

function FolderOpenIcon() {
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
        d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function PlusIcon() {
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
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}
