import type { ValidationIssue } from '@like-cake/mbt-catalog';

interface ModelValidationPanelProps {
  issues: ValidationIssue[];
  onClose: () => void;
}

export function ModelValidationPanel({ issues, onClose }: ModelValidationPanelProps) {
  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[480px] max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white">모델 유효성 검사</h3>
            <div className="flex gap-2">
              {errors.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-600/30 text-red-300 rounded-full">
                  {errors.length} errors
                </span>
              )}
              {warnings.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-yellow-600/30 text-yellow-300 rounded-full">
                  {warnings.length} warnings
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {issues.length === 0 && (
            <div className="text-sm text-green-400 text-center py-8">
              유효성 검사 통과 — 문제 없음
            </div>
          )}

          {issues.map((issue, idx) => (
            <div
              key={idx}
              className={`px-3 py-2 rounded-md border ${
                issue.type === 'error'
                  ? 'bg-red-900/20 border-red-800/50'
                  : 'bg-yellow-900/20 border-yellow-800/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                    issue.type === 'error'
                      ? 'bg-red-600/30 text-red-300'
                      : 'bg-yellow-600/30 text-yellow-300'
                  }`}
                >
                  {issue.type === 'error' ? 'ERROR' : 'WARN'}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">{issue.code}</span>
              </div>
              <div className="text-sm text-gray-300 mt-1">{issue.message}</div>
              {issue.context && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {issue.context.stateId && `State: ${issue.context.stateId}`}
                  {issue.context.transitionId && `Transition: ${issue.context.transitionId}`}
                  {issue.context.bindingId && ` | Binding: ${issue.context.bindingId}`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
