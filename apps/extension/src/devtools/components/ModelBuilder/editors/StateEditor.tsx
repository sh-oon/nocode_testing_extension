import { useState } from 'react';
import type { BoundVerification, ElementBinding } from '@like-cake/mbt-catalog';
import { getVerificationById } from '@like-cake/mbt-catalog';
import { CatalogParamForm } from '../pickers/CatalogParamForm';
import { selectorToString } from '../utils';
import { VerificationCatalogPicker } from '../pickers/VerificationCatalogPicker';

interface StateEditorProps {
  name: string;
  verifications: BoundVerification[];
  elementBindings: ElementBinding[];
  onChange: (data: { name: string; verifications: BoundVerification[] }) => void;
  onClose: () => void;
}

export function StateEditor({
  name: initialName,
  verifications: initialVerifications,
  elementBindings,
  onChange,
  onClose,
}: StateEditorProps) {
  const [name, setName] = useState(initialName);
  const [verifications, setVerifications] = useState<BoundVerification[]>(initialVerifications);
  const [showPicker, setShowPicker] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleAddVerification = (verificationId: string) => {
    const entry = getVerificationById(verificationId);
    if (!entry) return;

    const defaultParams: Record<string, unknown> = {};
    for (const p of entry.params) {
      if (p.defaultValue !== undefined) {
        defaultParams[p.name] = p.defaultValue;
      }
    }

    const newVerification: BoundVerification = {
      verificationId,
      elementBindingId: null,
      params: defaultParams,
      critical: true,
    };

    setVerifications((prev) => [...prev, newVerification]);
    setShowPicker(false);
    setExpandedIdx(verifications.length);
  };

  const handleRemoveVerification = (idx: number) => {
    setVerifications((prev) => prev.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  };

  const handleUpdateVerification = (idx: number, updates: Partial<BoundVerification>) => {
    setVerifications((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, ...updates } : v))
    );
  };

  const handleSave = () => {
    onChange({ name, verifications });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
        <div className="bg-gray-800 rounded-lg shadow-xl w-[520px] max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">상태 편집</h3>
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
            {/* State Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">상태 이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="상태 이름"
              />
            </div>

            {/* Verifications */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">
                  검증 ({verifications.length})
                </label>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  + 검증 추가
                </button>
              </div>

              {verifications.length === 0 && (
                <div className="text-xs text-gray-500 py-3 text-center border border-dashed border-gray-600 rounded-md">
                  검증을 추가하세요
                </div>
              )}

              <div className="space-y-2">
                {verifications.map((v, idx) => {
                  const entry = getVerificationById(v.verificationId);
                  const isExpanded = expandedIdx === idx;

                  return (
                    <div
                      key={`${v.verificationId}-${idx}`}
                      className="border border-gray-600 rounded-md overflow-hidden"
                    >
                      {/* Verification header */}
                      <div
                        className="px-3 py-2 bg-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-650"
                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                        onKeyDown={(e) => e.key === 'Enter' && setExpandedIdx(isExpanded ? null : idx)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">{entry?.label || v.verificationId}</span>
                          {v.critical && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-600/30 text-red-300 rounded">
                              critical
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveVerification(idx);
                            }}
                            className="text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <TrashIcon />
                          </button>
                          <ChevronIcon expanded={isExpanded} />
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && entry && (
                        <div className="px-3 py-3 space-y-3 border-t border-gray-600">
                          <p className="text-xs text-gray-400">{entry.description}</p>

                          {/* Params */}
                          {entry.params.length > 0 && (
                            <CatalogParamForm
                              params={entry.params}
                              values={v.params}
                              onChange={(params) => handleUpdateVerification(idx, { params })}
                            />
                          )}

                          {/* Element Binding */}
                          {entry.elementRequirement !== 'none' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-300 mb-1">
                                요소 바인딩
                                {entry.elementRequirement === 'required' && (
                                  <span className="text-red-400 ml-0.5">*</span>
                                )}
                              </label>
                              <select
                                value={v.elementBindingId || ''}
                                onChange={(e) =>
                                  handleUpdateVerification(idx, {
                                    elementBindingId: e.target.value || null,
                                  })
                                }
                                className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-orange-500"
                              >
                                <option value="">선택 안 함</option>
                                {elementBindings.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.label} ({selectorToString(b.selector)})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Critical toggle */}
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={v.critical}
                              onChange={(e) =>
                                handleUpdateVerification(idx, { critical: e.target.checked })
                              }
                              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-800"
                            />
                            <span className="text-xs text-gray-300">Critical (실패 시 테스트 중단)</span>
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
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
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-md transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <VerificationCatalogPicker
          onSelect={handleAddVerification}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
