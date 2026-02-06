import { useState, useCallback } from 'react';
import type { VariableExtraction, ExtractionSource } from '@like-cake/ast-types';
import { JsonTreeViewer } from '../../JsonTreeViewer';
import { getValuePreview } from '../../JsonTreeViewer/PathBuilder';

interface ExtractionEditorProps {
  extractions?: VariableExtraction[];
  label?: string;
  /** Sample API response data for the tree viewer */
  sampleResponse?: unknown;
  onChange: (data: { label: string; extractions: VariableExtraction[] }) => void;
  onClose: () => void;
}

const sourceOptions: Array<{ value: ExtractionSource; label: string; description: string }> = [
  { value: 'lastApiResponse', label: 'API Response', description: 'Extract from last API response' },
  { value: 'element', label: 'DOM Element', description: 'Extract from page element' },
  { value: 'url', label: 'URL', description: 'Extract from current URL' },
  { value: 'localStorage', label: 'Local Storage', description: 'Extract from localStorage' },
  { value: 'cookie', label: 'Cookie', description: 'Extract from cookies' },
];

// Sample data shown when no real API response is available
const SAMPLE_API_RESPONSE = {
  data: {
    user: {
      id: 12345,
      name: 'John Doe',
      email: 'john@example.com',
      roles: ['admin', 'editor'],
    },
    token: 'eyJhbGciOiJIUzI1NiIs...',
    expiresAt: 1699999999,
  },
  status: 'success',
  message: 'OK',
};

export function ExtractionEditor({
  extractions: initialExtractions,
  label,
  sampleResponse,
  onChange,
  onClose,
}: ExtractionEditorProps) {
  const [nodeLabel, setNodeLabel] = useState(label || 'Extract Variables');
  const [extractions, setExtractions] = useState<VariableExtraction[]>(
    initialExtractions?.length
      ? initialExtractions
      : [{ variableName: '', source: 'lastApiResponse', jsonPath: '$.data' }]
  );
  // Track which extraction is currently using the tree viewer
  const [activeTreeIndex, setActiveTreeIndex] = useState<number | null>(null);
  // Test result for JSONPath validation
  const [testResult, setTestResult] = useState<{ index: number; value: string } | null>(null);

  const addExtraction = () => {
    setExtractions([
      ...extractions,
      { variableName: '', source: 'lastApiResponse', jsonPath: '$.data' },
    ]);
  };

  const removeExtraction = (index: number) => {
    setExtractions(extractions.filter((_, i) => i !== index));
    if (activeTreeIndex === index) setActiveTreeIndex(null);
  };

  const updateExtraction = (index: number, updates: Partial<VariableExtraction>) => {
    setExtractions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const handleTreeSelect = useCallback(
    (jsonPath: string, value: unknown) => {
      if (activeTreeIndex !== null) {
        setExtractions(prev => {
          const updated = [...prev];
          updated[activeTreeIndex] = { ...updated[activeTreeIndex], jsonPath };
          return updated;
        });
        setTestResult({ index: activeTreeIndex, value: getValuePreview(value) });
      }
    },
    [activeTreeIndex]
  );

  const handleTestPath = (index: number) => {
    const extraction = extractions[index];
    if (!extraction.jsonPath) return;

    const responseData = sampleResponse || SAMPLE_API_RESPONSE;
    try {
      // Simple JSONPath evaluation for preview ($ root + dot notation)
      const result = evaluateSimpleJsonPath(responseData, extraction.jsonPath);
      setTestResult({ index, value: getValuePreview(result) });
    } catch {
      setTestResult({ index, value: '(error: invalid path)' });
    }
  };

  const handleSave = () => {
    const validExtractions = extractions.filter((e) => e.variableName.trim() !== '');
    onChange({
      label: nodeLabel,
      extractions: validExtractions,
    });
    onClose();
  };

  const responseData = sampleResponse || SAMPLE_API_RESPONSE;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="extraction-editor-title">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[640px] max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 id="extraction-editor-title" className="text-lg font-semibold text-white">Edit Extractions</h3>
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
        <div className="p-4 space-y-4 overflow-y-auto max-h-[75vh]">
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
              placeholder="Extract Variables"
            />
          </div>

          {/* Extractions List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Extractions
              </label>
              <button
                type="button"
                onClick={addExtraction}
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Extraction
              </button>
            </div>

            {extractions.map((extraction, index) => (
              <div key={index} className="p-3 bg-gray-900 rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Extraction #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeExtraction(index)}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                    disabled={extractions.length === 1}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Variable Name */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Variable Name</label>
                  <input
                    type="text"
                    value={extraction.variableName}
                    onChange={(e) => updateExtraction(index, { variableName: e.target.value })}
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="userId"
                  />
                </div>

                {/* Source */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Source</label>
                  <select
                    value={extraction.source}
                    onChange={(e) => updateExtraction(index, { source: e.target.value as ExtractionSource })}
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {sourceOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} - {opt.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Source-specific fields */}
                {extraction.source === 'lastApiResponse' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-400 mb-1">
                          JSONPath
                          <span className="text-gray-500 ml-1">(e.g., $.data.user.id)</span>
                        </label>
                        <input
                          type="text"
                          value={extraction.jsonPath || ''}
                          onChange={(e) => updateExtraction(index, { jsonPath: e.target.value })}
                          className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                          placeholder="$.data.user.id"
                        />
                      </div>
                      <div className="flex gap-1 pt-4">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveTreeIndex(activeTreeIndex === index ? null : index)
                          }
                          className={`px-2 py-1.5 text-xs rounded transition-colors ${
                            activeTreeIndex === index
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'
                          }`}
                          title="Pick from tree"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTestPath(index)}
                          className="px-2 py-1.5 text-xs bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                          title="Test path"
                        >
                          Test
                        </button>
                      </div>
                    </div>

                    {/* Test result */}
                    {testResult && testResult.index === index && (
                      <div className="px-2 py-1.5 bg-gray-800 rounded text-xs">
                        <span className="text-gray-500">Result: </span>
                        <span className="text-green-400 font-mono">{testResult.value}</span>
                      </div>
                    )}

                    {/* JSON Tree Viewer (shown when active for this extraction) */}
                    {activeTreeIndex === index && (
                      <JsonTreeViewer
                        data={responseData}
                        onSelect={handleTreeSelect}
                        selectedPath={extraction.jsonPath}
                        maxHeight="250px"
                      />
                    )}
                  </div>
                )}

                {extraction.source === 'element' && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">CSS Selector</label>
                      <input
                        type="text"
                        value={extraction.selector || ''}
                        onChange={(e) => updateExtraction(index, { selector: e.target.value })}
                        className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="#userId"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Attribute
                        <span className="text-gray-500 ml-1">(default: textContent)</span>
                      </label>
                      <input
                        type="text"
                        value={extraction.attribute || ''}
                        onChange={(e) => updateExtraction(index, { attribute: e.target.value })}
                        className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="data-value"
                      />
                    </div>
                  </>
                )}

                {extraction.source === 'url' && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Regex Pattern
                      <span className="text-gray-500 ml-1">(with capture group)</span>
                    </label>
                    <input
                      type="text"
                      value={extraction.pattern || ''}
                      onChange={(e) => updateExtraction(index, { pattern: e.target.value })}
                      className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="/users/(\d+)"
                    />
                  </div>
                )}

                {/* Default Value */}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Default Value
                    <span className="text-gray-500 ml-1">(if extraction fails)</span>
                  </label>
                  <input
                    type="text"
                    value={String(extraction.defaultValue ?? '')}
                    onChange={(e) => updateExtraction(index, { defaultValue: e.target.value || undefined })}
                    className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="(optional)"
                  />
                </div>
              </div>
            ))}
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

/**
 * Simple JSONPath evaluator for preview purposes
 * Supports $ (root), dot notation, and bracket notation for arrays
 */
function evaluateSimpleJsonPath(data: unknown, path: string): unknown {
  if (!path.startsWith('$')) return undefined;

  // Remove leading $
  const segments = path
    .slice(1)
    .split(/\.|\[/)
    .filter(Boolean)
    .map((s) => {
      // Remove trailing ] from bracket notation
      const cleaned = s.replace(/\]$/, '').replace(/^['"]|['"]$/g, '');
      const num = Number(cleaned);
      return Number.isInteger(num) && cleaned === String(num) ? num : cleaned;
    });

  let current: unknown = data;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof segment === 'number' && Array.isArray(current)) {
      current = current[segment];
    } else if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, unknown>)[String(segment)];
    } else {
      return undefined;
    }
  }

  return current;
}
