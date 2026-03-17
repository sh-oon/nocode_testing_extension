import { useCallback, useState } from 'react';
import type { TestModel, ScenarioGenerationResult, TraversalStrategy, ValidationIssue } from '@like-cake/mbt-catalog';
import { generateScenariosFromModel, validateTestModel, countIssues } from '@like-cake/mbt-catalog';
import type { ModelExecutionResult } from '../../../shared/api';
import { getApiClient } from '../../../shared/api';
import { ModelExecutionResultPanel } from './ModelExecutionResultPanel';

interface GenerateScenariosModalProps {
  model: TestModel;
  isConnected: boolean;
  onClose: () => void;
}

export function GenerateScenariosModal({ model, isConnected, onClose }: GenerateScenariosModalProps) {
  const [strategy, setStrategy] = useState<TraversalStrategy>('shortest');
  const [maxPaths, setMaxPaths] = useState(10);
  const [result, setResult] = useState<ScenarioGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ModelExecutionResult | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ count: number } | null>(null);

  // Validation state
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  const handleGenerate = useCallback(() => {
    // Run validation before generation
    const issues = validateTestModel(model);
    setValidationIssues(issues);

    const { errors: errorCount } = countIssues(issues);
    if (errorCount > 0) {
      setError(`모델에 ${errorCount}개의 에러가 있습니다. 수정 후 다시 시도하세요.`);
      setResult(null);
      return;
    }
    try {
      setError(null);
      setExecutionResult(null);
      setSaveResult(null);
      const generationResult = generateScenariosFromModel(model, {
        strategy,
        maxPaths: maxPaths || undefined,
      });
      setResult(generationResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    }
  }, [model, strategy, maxPaths]);

  const handleExportAll = useCallback(() => {
    if (!result) return;

    const blob = new Blob([JSON.stringify(result.scenarios, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${model.name}-scenarios-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, model.name]);

  const handleExecuteAll = useCallback(async () => {
    if (!result || !isConnected) return;

    setIsExecuting(true);
    setExecutionResult(null);
    setError(null);

    try {
      const client = await getApiClient();
      const response = await client.executeModel({
        modelId: model.id,
        modelName: model.name,
        scenarios: result.scenarios.map((s) => ({
          id: s.id,
          name: s.name,
          meta: s.meta,
          steps: s.steps,
          variables: s.variables,
        })),
        options: {
          headless: false,
          baseUrl: model.baseUrl || undefined,
          continueOnFailure: true,
        },
      });

      if (response.success && response.data) {
        setExecutionResult(response.data);
      } else {
        setError(response.error || 'Execution failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  }, [result, isConnected, model]);

  const handleSaveToBackend = useCallback(async () => {
    if (!result || !isConnected) return;

    setIsSaving(true);
    setError(null);

    try {
      const client = await getApiClient();
      const response = await client.saveModelScenarios({
        modelName: model.name,
        baseUrl: model.baseUrl,
        scenarios: result.scenarios.map((s) => ({
          id: s.id,
          name: s.name || `[${model.name}] Scenario`,
          meta: s.meta,
          steps: s.steps,
          variables: s.variables,
        })),
      });

      if (response.success && response.data) {
        setSaveResult({ count: response.data.count });
      } else {
        setError(response.error || 'Save failed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [result, isConnected, model]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">시나리오 생성</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Options */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">전략:</label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as TraversalStrategy)}
              className="px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-orange-500"
            >
              <option value="shortest">Shortest Paths</option>
              <option value="simple">Simple Paths</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Max Paths:</label>
            <input
              type="number"
              value={maxPaths}
              onChange={(e) => setMaxPaths(Number(e.target.value))}
              min={0}
              className="w-16 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            className="ml-auto px-4 py-1.5 text-sm font-medium bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors"
          >
            Generate
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="px-3 py-2 bg-red-900/50 border border-red-800 rounded-md text-sm text-red-200 mb-4">
              {error}
            </div>
          )}

          {/* Validation Issues */}
          {validationIssues.length > 0 && !result && (
            <div className="space-y-1 mb-4">
              {validationIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`px-3 py-1.5 rounded-md text-xs ${
                    issue.type === 'error'
                      ? 'bg-red-900/20 border border-red-800/50 text-red-300'
                      : 'bg-yellow-900/20 border border-yellow-800/50 text-yellow-300'
                  }`}
                >
                  <span className="font-mono mr-1">[{issue.code}]</span>
                  {issue.message}
                </div>
              ))}
            </div>
          )}

          {!result && !error && validationIssues.length === 0 && (
            <div className="text-sm text-gray-500 text-center py-12">
              전략과 옵션을 설정한 후 Generate를 클릭하세요
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Summary + Actions */}
              <div className="px-3 py-2 bg-gray-700 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-300">
                    <span className="font-medium text-white">{result.scenarios.length}</span> 시나리오 생성
                    <span className="text-gray-500 ml-2">({result.pathCount} paths found)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportAll}
                    className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    Export JSON
                  </button>
                </div>

                {/* Action buttons */}
                {isConnected && result.scenarios.length > 0 && (
                  <div className="flex gap-2 pt-2 border-t border-gray-600">
                    <button
                      type="button"
                      onClick={handleExecuteAll}
                      disabled={isExecuting}
                      className="flex-1 px-3 py-1.5 text-sm font-medium bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-md transition-colors"
                    >
                      {isExecuting ? 'Executing...' : 'Execute All'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveToBackend}
                      disabled={isSaving}
                      className="flex-1 px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-md transition-colors"
                    >
                      {isSaving ? 'Saving...' : 'Save to Backend'}
                    </button>
                  </div>
                )}

                {/* Save success message */}
                {saveResult && (
                  <div className="mt-2 px-2 py-1.5 bg-green-900/30 border border-green-800/50 rounded text-xs text-green-300">
                    {saveResult.count}개 시나리오 저장 완료 — FlowBuilder에서 조합 가능합니다
                  </div>
                )}
              </div>

              {/* Execution Results */}
              {executionResult && (
                <ModelExecutionResultPanel result={executionResult} />
              )}

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="px-3 py-2 bg-yellow-900/30 border border-yellow-800/50 rounded-md">
                  <div className="text-xs font-medium text-yellow-400 mb-1">Warnings</div>
                  {result.warnings.map((w, i) => (
                    <div key={i} className="text-xs text-yellow-300/70">{w}</div>
                  ))}
                </div>
              )}

              {/* Conversion Errors */}
              {result.errors.length > 0 && (
                <div className="px-3 py-2 bg-red-900/30 border border-red-800/50 rounded-md">
                  <div className="text-xs font-medium text-red-400 mb-1">Conversion Errors</div>
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-xs text-red-300/70">
                      {e.catalogEntryId}: {e.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Scenario List */}
              {!executionResult && (
                <div className="space-y-2">
                  {result.scenarios.map((scenario, idx) => (
                    <div
                      key={scenario.id}
                      className="px-3 py-2 bg-gray-700 rounded-md border border-gray-600"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">
                          Scenario {idx + 1}
                        </span>
                        <span className="text-xs text-gray-400">
                          {scenario.steps.length} steps
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500 font-mono truncate">
                        {scenario.steps.map((s) => s.type).join(' → ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
