import { useState } from 'react';
import type { VariableAssignment } from '@like-cake/ast-types';

interface VariableEditorProps {
  variables?: VariableAssignment[];
  label?: string;
  onChange: (data: { label: string; variables: VariableAssignment[] }) => void;
  onClose: () => void;
}

type VariableType = 'string' | 'number' | 'boolean' | 'json';

const typeOptions: Array<{ value: VariableType; label: string }> = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'json', label: 'JSON' },
];

export function VariableEditor({ variables: initialVariables, label, onChange, onClose }: VariableEditorProps) {
  const [nodeLabel, setNodeLabel] = useState(label || 'Set Variables');
  const [variables, setVariables] = useState<VariableAssignment[]>(
    initialVariables?.length ? initialVariables : [{ name: '', value: '', type: 'string' }]
  );

  const addVariable = () => {
    setVariables([...variables, { name: '', value: '', type: 'string' }]);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof VariableAssignment, value: string) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    setVariables(updated);
  };

  const handleSave = () => {
    // Filter out empty variables
    const validVariables = variables.filter((v) => v.name.trim() !== '');
    onChange({
      label: nodeLabel,
      variables: validVariables,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[560px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Edit Variables</h3>
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
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Node Label
            </label>
            <input
              type="text"
              value={nodeLabel}
              onChange={(e) => setNodeLabel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Set Variables"
            />
          </div>

          {/* Variables List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Variables
              </label>
              <button
                type="button"
                onClick={addVariable}
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Variable
              </button>
            </div>

            {variables.map((variable, index) => (
              <div key={index} className="flex gap-2 items-start p-3 bg-gray-900 rounded-md">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={variable.name}
                      onChange={(e) => updateVariable(index, 'name', e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="variableName"
                    />
                    <select
                      value={variable.type}
                      onChange={(e) => updateVariable(index, 'type', e.target.value)}
                      className="w-24 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {typeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={variable.value}
                    onChange={(e) => updateVariable(index, 'value', e.target.value)}
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder={variable.type === 'json' ? '{"key": "value"}' : 'Value or {{otherVar}}'}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeVariable(index)}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                  disabled={variables.length === 1}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Help text */}
          <div className="text-xs text-gray-500">
            Use {"{{variableName}}"} syntax to reference other variables in values.
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
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 rounded-md transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
