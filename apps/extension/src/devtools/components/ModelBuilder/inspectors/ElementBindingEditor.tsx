import { useState } from 'react';
import type { ElementBinding, ElementSelectionMethod } from '@like-cake/mbt-catalog';
import { nanoid } from '../../../utils/nanoid';
import { selectorToString } from '../utils';

interface ElementBindingEditorProps {
  binding?: ElementBinding;
  onSave: (binding: Partial<ElementBinding> & Pick<ElementBinding, 'id' | 'label' | 'selector' | 'pageUrl' | 'selectionMethod' | 'candidates' | 'createdAt'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function ElementBindingEditor({
  binding,
  onSave,
  onDelete,
  onClose,
}: ElementBindingEditorProps) {
  const [label, setLabel] = useState(binding?.label || '');
  const [selector, setSelector] = useState(
    binding ? selectorToString(binding.selector) : ''
  );
  const [pageUrl, setPageUrl] = useState(binding?.pageUrl || '');
  const [selectionMethod, setSelectionMethod] = useState<ElementSelectionMethod>(
    binding?.selectionMethod || 'manual'
  );

  const isNew = !binding;

  const handleSave = () => {
    if (!label.trim() || !selector.trim()) return;

    onSave({
      id: binding?.id || nanoid(8),
      label: label.trim(),
      selector: selector.trim(),
      pageUrl,
      selectionMethod,
      candidates: binding?.candidates || [],
      createdAt: binding?.createdAt || Date.now(),
      accessibility: binding?.accessibility,
      elementHtml: binding?.elementHtml,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[420px] max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            {isNew ? '요소 바인딩 추가' : '요소 바인딩 편집'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              라벨 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="예: 로그인 버튼"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Selector <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
              placeholder="CSS selector 또는 XPath"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Page URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">페이지 URL</label>
            <input
              type="text"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Selection Method */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">선택 방식</label>
            <select
              value={selectionMethod}
              onChange={(e) => setSelectionMethod(e.target.value as ElementSelectionMethod)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="manual">Manual</option>
              <option value="cdpInspect">CDP Inspect</option>
              <option value="recording">Recording</option>
            </select>
          </div>

          {/* Accessibility Info (read-only if present) */}
          {binding?.accessibility && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">접근성 정보</label>
              <div className="px-3 py-2 bg-gray-900 rounded-md text-xs text-gray-400 space-y-1">
                {binding.accessibility.role && (
                  <div>Role: <span className="text-gray-300">{binding.accessibility.role}</span></div>
                )}
                {binding.accessibility.name && (
                  <div>Name: <span className="text-gray-300">{binding.accessibility.name}</span></div>
                )}
                <div>
                  Focusable: <span className="text-gray-300">{binding.accessibility.focusable ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Candidates (read-only if present) */}
          {binding?.candidates && binding.candidates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Candidates ({binding.candidates.length})
              </label>
              <div className="space-y-1">
                {binding.candidates.map((c, i) => (
                  <div key={i} className="px-2.5 py-1.5 bg-gray-900 rounded text-xs font-mono text-gray-400 truncate">
                    {c.selector}
                    {c.score !== undefined && (
                      <span className="ml-2 text-gray-500">({c.score})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-md transition-colors"
            >
              삭제
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!label.trim() || !selector.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isNew ? 'Add' : 'Save'}
            </button>
          </div>
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
