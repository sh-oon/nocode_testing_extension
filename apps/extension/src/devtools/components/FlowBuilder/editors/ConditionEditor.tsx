import { useState } from 'react';
import type { FlowCondition } from '@like-cake/ast-types';
import {
  getPresetById,
  getPresetsByCategory,
  resolvePresetFromCondition,
} from '@like-cake/variable-store';

interface ConditionEditorProps {
  condition?: FlowCondition;
  label?: string;
  onChange: (data: { label: string; condition: FlowCondition }) => void;
  onClose: () => void;
}

export function ConditionEditor({ condition, label, onChange, onClose }: ConditionEditorProps) {
  const [nodeLabel, setNodeLabel] = useState(label || 'Condition');
  const [left, setLeft] = useState(condition?.left || '{{variableName}}');

  // Resolve the initial preset from existing condition
  const initialPresetId = condition ? resolvePresetFromCondition(condition) : 'eq';
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId);

  // For customRegex, keep the raw regex; for others, keep the right operand
  const initialPreset = getPresetById(initialPresetId);
  const [right, setRight] = useState(() => {
    if (!condition?.right) return '';
    // If it's a validation preset with regex, right operand was the regex → show empty
    if (initialPreset?.regex) return '';
    return condition.right;
  });
  const [customRegex, setCustomRegex] = useState(() => {
    if (initialPresetId === 'customRegex' && condition?.right) return condition.right;
    return '';
  });

  const [regexError, setRegexError] = useState<string | null>(null);

  const preset = getPresetById(selectedPresetId);
  const isUnary = preset?.unary;
  const hasFixedRegex = !!preset?.regex;
  const isCustomRegex = selectedPresetId === 'customRegex';

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
  };

  const handleSave = () => {
    let rightValue: string | undefined;

    if (isUnary) {
      rightValue = undefined;
    } else if (hasFixedRegex) {
      rightValue = preset?.regex;
    } else if (isCustomRegex) {
      try {
        new RegExp(customRegex);
      } catch (e) {
        setRegexError(e instanceof Error ? e.message : 'Invalid regular expression');
        return;
      }
      rightValue = customRegex;
    } else {
      rightValue = right;
    }

    onChange({
      label: nodeLabel,
      condition: {
        left,
        operator: preset?.operator || 'eq',
        ...(rightValue != null ? { right: rightValue } : {}),
      },
    });
    onClose();
  };

  const comparisonPresets = getPresetsByCategory('comparison');
  const stringPresets = getPresetsByCategory('string');
  const validationPresets = getPresetsByCategory('validation');

  // Build preview text
  const previewText = (() => {
    if (isUnary) return `${left} ${preset?.label.toLowerCase()}`;
    if (hasFixedRegex) return `${left} ${preset?.label.toLowerCase()}`;
    if (isCustomRegex) return `${left} matches /${customRegex}/`;
    return `${left} ${preset?.label.toLowerCase() || '?'} ${right}`;
  })();

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="condition-editor-title"
    >
      <div className="bg-white rounded-lg shadow-xl w-[480px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3
            id="condition-editor-title"
            className="text-lg font-semibold text-gray-900"
          >
            Edit Condition
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-900 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Node Label</label>
            <input
              type="text"
              value={nodeLabel}
              onChange={(e) => setNodeLabel(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Condition"
            />
          </div>

          {/* Left operand */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Left Operand
              <span className="text-gray-500 font-normal ml-2">Use {'{{var}}'} for variables</span>
            </label>
            <input
              type="text"
              value={left}
              onChange={(e) => setLeft(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="{{userId}}"
            />
          </div>

          {/* Match Type (Preset selector with categories) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Match Type</label>
            <select
              value={selectedPresetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <optgroup label="Comparison">
                {comparisonPresets.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.label} - {p.description}
                  </option>
                ))}
              </optgroup>
              <optgroup label="String">
                {stringPresets.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.label} - {p.description}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Validation">
                {validationPresets.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >
                    {p.label} - {p.description}
                  </option>
                ))}
              </optgroup>
            </select>
            {preset && <p className="mt-1 text-xs text-gray-400">{preset.description}</p>}
          </div>

          {/* Right operand - only for binary non-regex presets */}
          {!isUnary && !hasFixedRegex && !isCustomRegex && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Right Operand
                <span className="text-gray-400 font-normal ml-2">Value or {'{{var}}'}</span>
              </label>
              <input
                type="text"
                value={right}
                onChange={(e) => setRight(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="100"
              />
            </div>
          )}

          {/* Custom regex input */}
          {isCustomRegex && (
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Regex Pattern
                <span className="text-gray-400 font-normal ml-2">Without delimiters</span>
              </label>
              <input
                type="text"
                value={customRegex}
                onChange={(e) => {
                  setCustomRegex(e.target.value);
                  setRegexError(null);
                }}
                className={`w-full px-3 py-2 bg-white border rounded-md text-gray-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${regexError ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="^[A-Z]{2,4}-\d+$"
              />
              {regexError && <p className="mt-1 text-xs text-red-400">{regexError}</p>}
            </div>
          )}

          {/* Preview */}
          <div className="p-3 bg-gray-50 rounded-md">
            <div className="text-xs text-gray-400 mb-1">Preview:</div>
            <div className="text-sm text-amber-400 font-mono">{previewText}</div>
            {hasFixedRegex && (
              <div className="text-xs text-gray-400 mt-1">
                Pattern: <span className="text-gray-500 font-mono">{preset?.regex}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
