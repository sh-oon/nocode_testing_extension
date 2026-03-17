import { useState } from 'react';
import type { FlowCondition } from '@like-cake/ast-types';
import type { BoundEvent, ElementBinding } from '@like-cake/mbt-catalog';
import { getEventById } from '@like-cake/mbt-catalog';
import { CatalogParamForm } from '../pickers/CatalogParamForm';
import { EventCatalogPicker } from '../pickers/EventCatalogPicker';
import { selectorToString } from '../utils';

interface TransitionEditorProps {
  event: BoundEvent;
  guard?: FlowCondition;
  elementBindings: ElementBinding[];
  onChange: (data: { event: BoundEvent; guard?: FlowCondition }) => void;
  onClose: () => void;
}

export function TransitionEditor({
  event: initialEvent,
  guard: initialGuard,
  elementBindings,
  onChange,
  onClose,
}: TransitionEditorProps) {
  const [event, setEvent] = useState<BoundEvent>(initialEvent);
  const [guard, setGuard] = useState<FlowCondition | undefined>(initialGuard);
  const [showPicker, setShowPicker] = useState(false);
  const [showGuard, setShowGuard] = useState(!!initialGuard);

  const entry = getEventById(event.eventId);

  const handleSelectEvent = (eventId: string) => {
    const newEntry = getEventById(eventId);
    const defaultParams: Record<string, unknown> = {};
    if (newEntry) {
      for (const p of newEntry.params) {
        if (p.defaultValue !== undefined) {
          defaultParams[p.name] = p.defaultValue;
        }
      }
    }

    setEvent({
      eventId,
      elementBindingId: null,
      params: defaultParams,
    });
    setShowPicker(false);
  };

  const handleSave = () => {
    onChange({
      event,
      guard: showGuard ? guard : undefined,
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
        <div className="bg-gray-800 rounded-lg shadow-xl w-[480px] max-h-[80vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">전이 편집</h3>
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
            {/* Event Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-gray-300">이벤트</label>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                >
                  변경
                </button>
              </div>

              {entry ? (
                <div className="px-3 py-2 bg-gray-700 rounded-md border border-gray-600">
                  <div className="text-sm font-medium text-white">{entry.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{entry.description}</div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="w-full px-3 py-3 text-sm text-gray-500 bg-gray-700 border border-dashed border-gray-600 rounded-md hover:border-orange-500 transition-colors"
                >
                  이벤트를 선택하세요
                </button>
              )}
            </div>

            {/* Event Params */}
            {entry && entry.params.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">파라미터</label>
                <CatalogParamForm
                  params={entry.params}
                  values={event.params}
                  onChange={(params) => setEvent((prev) => ({ ...prev, params }))}
                />
              </div>
            )}

            {/* Element Binding */}
            {entry && entry.elementRequirement !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  요소 바인딩
                  {entry.elementRequirement === 'required' && (
                    <span className="text-red-400 ml-0.5">*</span>
                  )}
                </label>
                <select
                  value={event.elementBindingId || ''}
                  onChange={(e) =>
                    setEvent((prev) => ({
                      ...prev,
                      elementBindingId: e.target.value || null,
                    }))
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

            {/* Guard Condition */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={showGuard}
                  onChange={(e) => {
                    setShowGuard(e.target.checked);
                    if (!e.target.checked) setGuard(undefined);
                    else setGuard({ left: '{{var}}', operator: 'eq', right: 'value' });
                  }}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-gray-800"
                />
                <span className="text-sm font-medium text-gray-300">Guard 조건</span>
              </label>

              {showGuard && guard && (
                <div className="space-y-2 pl-6">
                  <input
                    type="text"
                    value={guard.left}
                    onChange={(e) => setGuard((g) => g ? { ...g, left: e.target.value } : g)}
                    placeholder="Left operand ({{var}})"
                    className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                  <select
                    value={guard.operator}
                    onChange={(e) => setGuard((g) => g ? { ...g, operator: e.target.value as FlowCondition['operator'] } : g)}
                    className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="eq">Equal (==)</option>
                    <option value="neq">Not Equal (!=)</option>
                    <option value="gt">Greater (&gt;)</option>
                    <option value="gte">Greater or Equal (&gt;=)</option>
                    <option value="lt">Less (&lt;)</option>
                    <option value="lte">Less or Equal (&lt;=)</option>
                    <option value="contains">Contains</option>
                    <option value="matches">Matches (regex)</option>
                  </select>
                  <input
                    type="text"
                    value={guard.right || ''}
                    onChange={(e) => setGuard((g) => g ? { ...g, right: e.target.value } : g)}
                    placeholder="Right operand"
                    className="w-full px-2.5 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded-md text-white font-mono focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}
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
        <EventCatalogPicker
          onSelect={handleSelectEvent}
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
