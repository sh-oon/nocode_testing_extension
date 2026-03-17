interface ModelEmptyStateProps {
  onOpenList: () => void;
  onCreateNew: () => void;
}

export function ModelEmptyState({ onOpenList, onCreateNew }: ModelEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full select-none"
      data-test-id="model-empty-state"
    >
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-700/60 mb-6">
        <ModelIcon />
      </div>

      <h2 className="text-xl font-semibold text-gray-100 mb-2">
        MBT 모델 빌더
      </h2>

      <p className="text-sm text-gray-400 mb-8 max-w-xs text-center leading-relaxed">
        상태 머신 기반 테스트 모델을 설계하세요.
        카탈로그에서 이벤트와 검증을 선택하여 테스트 시나리오를 자동 생성합니다.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenList}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
          data-test-id="model-empty-open-list"
        >
          <FolderOpenIcon />
          기존 모델 열기
        </button>

        <button
          type="button"
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
          data-test-id="model-empty-create-new"
        >
          <PlusIcon />
          새 모델 만들기
        </button>
      </div>
    </div>
  );
}

function ModelIcon() {
  return (
    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="6" r="3" strokeWidth={1.5} />
      <circle cx="18" cy="6" r="3" strokeWidth={1.5} />
      <circle cx="12" cy="18" r="3" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeWidth={1.5} d="M8.5 7.5L10.5 16M15.5 7.5L13.5 16" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}
