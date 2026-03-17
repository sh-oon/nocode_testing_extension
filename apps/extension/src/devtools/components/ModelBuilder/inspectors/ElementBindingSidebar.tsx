import { useState } from 'react';
import type { ElementBinding } from '@like-cake/mbt-catalog';
import { selectorToString } from '../utils';
import { ElementBindingEditor } from './ElementBindingEditor';

interface ElementBindingSidebarProps {
  bindings: ElementBinding[];
  onAdd: (binding: ElementBinding) => void;
  onUpdate: (bindingId: string, updates: Partial<ElementBinding>) => void;
  onRemove: (bindingId: string) => void;
}

export function ElementBindingSidebar({
  bindings,
  onAdd,
  onUpdate,
  onRemove,
}: ElementBindingSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const editingBinding = editingId ? bindings.find((b) => b.id === editingId) : null;

  return (
    <>
      <div className="w-56 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Element Bindings
          </div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            + Add
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {bindings.length === 0 && (
            <div className="text-xs text-gray-500 text-center py-4">
              No element bindings yet
            </div>
          )}

          {bindings.map((binding) => (
            <button
              key={binding.id}
              type="button"
              onClick={() => setEditingId(binding.id)}
              className="w-full px-2.5 py-2 text-left rounded-md hover:bg-gray-700 transition-colors group"
            >
              <div className="text-sm text-white group-hover:text-orange-300 truncate">
                {binding.label}
              </div>
              <div className="text-[10px] text-gray-500 font-mono truncate mt-0.5">
                {selectorToString(binding.selector)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {editingBinding && (
        <ElementBindingEditor
          binding={editingBinding}
          onSave={(updates) => {
            onUpdate(editingBinding.id, updates);
            setEditingId(null);
          }}
          onDelete={() => {
            onRemove(editingBinding.id);
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
        />
      )}

      {isCreating && (
        <ElementBindingEditor
          onSave={(newBinding) => {
            onAdd(newBinding as ElementBinding);
            setIsCreating(false);
          }}
          onClose={() => setIsCreating(false)}
        />
      )}
    </>
  );
}
