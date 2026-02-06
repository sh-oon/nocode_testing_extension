import { useState } from 'react';
import type { Step } from '@like-cake/ast-types';

interface StepEditorProps {
  step: Step;
  stepIndex: number;
  onSave: (updatedStep: Step) => void;
  onClose: () => void;
}

export function StepEditor({ step, stepIndex, onSave, onClose }: StepEditorProps) {
  const [editedStep, setEditedStep] = useState<Step>({ ...step });

  const updateField = (field: string, value: string) => {
    setEditedStep((prev) => ({ ...prev, [field]: value }) as Step);
  };

  const handleSave = () => {
    onSave(editedStep);
    onClose();
  };

  const isSensitive = editedStep.type === 'type' && editedStep.sensitive === true;
  const maskedValue = editedStep.type === 'type' && /^\*+$/.test(editedStep.value);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[480px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Edit Step #{stepIndex + 1} - <span className="capitalize">{editedStep.type}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Sensitive field banner */}
          {isSensitive && (
            <div className="px-3 py-2 bg-yellow-900/30 border border-yellow-700/50 rounded-md text-sm text-yellow-300">
              This field contains masked sensitive data. Use <code className="px-1 bg-gray-700 rounded font-mono text-xs">${'{variableName}'}</code> syntax to inject runtime variables.
              {maskedValue && (
                <div className="mt-1 text-yellow-400/80 text-xs">
                  Suggested: replace with <code className="px-1 bg-gray-700 rounded font-mono">${'{password}'}</code>
                </div>
              )}
            </div>
          )}

          {/* Step type badge */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
            <span className="inline-block px-2 py-1 bg-gray-700 rounded text-sm text-gray-300">
              {editedStep.type}
            </span>
          </div>

          {/* Type-specific fields */}
          {editedStep.type === 'navigate' && (
            <FieldInput
              label="URL"
              value={editedStep.url}
              onChange={(v) => updateField('url', v)}
              placeholder="https://example.com"
            />
          )}

          {editedStep.type === 'type' && (
            <>
              <FieldDisplay
                label="Selector"
                value={formatSelector(editedStep.selector)}
              />
              <FieldInput
                label="Value"
                value={editedStep.value}
                onChange={(v) => updateField('value', v)}
                placeholder={maskedValue ? '${password}' : 'Text to type'}
                mono
              />
            </>
          )}

          {editedStep.type === 'click' && (
            <FieldDisplay
              label="Selector"
              value={formatSelector(editedStep.selector)}
            />
          )}

          {editedStep.type === 'keypress' && (
            <FieldInput
              label="Key"
              value={editedStep.key}
              onChange={(v) => updateField('key', v)}
              placeholder="Enter"
            />
          )}

          {editedStep.type === 'wait' && (
            <>
              <FieldDisplay label="Strategy" value={editedStep.strategy} />
              {editedStep.strategy === 'time' && editedStep.duration !== undefined && (
                <FieldInput
                  label="Duration (ms)"
                  value={String(editedStep.duration)}
                  onChange={(v) => {
                    const num = Number.parseInt(v, 10);
                    if (!Number.isNaN(num)) {
                      setEditedStep((prev) => ({ ...prev, duration: num }) as Step);
                    }
                  }}
                  placeholder="1000"
                />
              )}
            </>
          )}

          {editedStep.type === 'select' && (
            <>
              <FieldDisplay
                label="Selector"
                value={formatSelector(editedStep.selector)}
              />
              <FieldInput
                label="Values"
                value={Array.isArray(editedStep.values) ? editedStep.values.join(', ') : editedStep.values}
                onChange={(v) => {
                  setEditedStep((prev) => ({
                    ...prev,
                    values: v.includes(',') ? v.split(',').map((s) => s.trim()) : v,
                  }) as Step);
                }}
                placeholder="option1, option2"
              />
            </>
          )}

          {editedStep.type === 'hover' && (
            <FieldDisplay
              label="Selector"
              value={formatSelector(editedStep.selector)}
            />
          )}

          {editedStep.type === 'snapshotDom' && (
            <FieldInput
              label="Label"
              value={editedStep.label}
              onChange={(v) => updateField('label', v)}
              placeholder="Snapshot label"
            />
          )}

          {/* Common optional fields */}
          <FieldInput
            label="Description (optional)"
            value={editedStep.description ?? ''}
            onChange={(v) => updateField('description', v || '')}
            placeholder="Step description"
          />
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
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-md transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${mono ? 'font-mono' : ''}`}
        placeholder={placeholder}
      />
    </div>
  );
}

function FieldDisplay({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <div className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-400 text-sm font-mono truncate">
        {value}
      </div>
    </div>
  );
}

function formatSelector(selector: string | { strategy: string; value: string }): string {
  if (typeof selector === 'string') return selector;
  if (selector.strategy === 'testId') return `[data-testid="${selector.value}"]`;
  return selector.value;
}
