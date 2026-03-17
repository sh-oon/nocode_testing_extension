import { useMemo, useState } from 'react';
import {
  EVENT_CATALOG,
  type EventCatalogEntry,
  type EventCategory,
} from '@like-cake/mbt-catalog';

interface EventCatalogPickerProps {
  onSelect: (eventId: string) => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  mouse: 'Mouse',
  keyboard: 'Keyboard',
  form: 'Form',
  navigation: 'Navigation',
  timing: 'Timing',
};

const CATEGORY_ORDER: EventCategory[] = ['mouse', 'keyboard', 'form', 'navigation', 'timing'];

const ELEMENT_ICONS: Record<string, string> = {
  required: '[ ]',
  optional: '[?]',
  none: '',
};

export function EventCatalogPicker({ onSelect, onClose }: EventCatalogPickerProps) {
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    const filtered = search
      ? EVENT_CATALOG.filter(
          (e) =>
            e.label.toLowerCase().includes(search.toLowerCase()) ||
            e.description.toLowerCase().includes(search.toLowerCase()) ||
            e.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
        )
      : EVENT_CATALOG;

    const groups = new Map<EventCategory, EventCatalogEntry[]>();
    for (const category of CATEGORY_ORDER) {
      const items = filtered.filter((e) => e.category === category);
      if (items.length > 0) {
        groups.set(category, items);
      }
    }
    return groups;
  }, [search]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[420px] max-h-[70vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">이벤트 선택</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-700">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이벤트 검색..."
            className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
            autoFocus
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {grouped.size === 0 && (
            <div className="text-sm text-gray-500 text-center py-8">검색 결과 없음</div>
          )}

          {[...grouped.entries()].map(([category, items]) => (
            <div key={category} className="mb-3">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">
                {CATEGORY_LABELS[category]}
              </div>
              {items.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelect(entry.id)}
                  className="w-full px-3 py-2 text-left rounded-md hover:bg-gray-700 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white group-hover:text-orange-300">
                      {entry.label}
                    </span>
                    {entry.elementRequirement !== 'none' && (
                      <span className="text-[10px] font-mono text-gray-500">
                        {ELEMENT_ICONS[entry.elementRequirement]}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{entry.description}</div>
                </button>
              ))}
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
