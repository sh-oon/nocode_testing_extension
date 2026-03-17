import { useCallback, useEffect, useState } from 'react';
import type { Scenario } from '@like-cake/ast-types';
import type { ScenarioToModelResult } from '@like-cake/mbt-catalog';
import { convertScenarioToModel } from '@like-cake/mbt-catalog';
import { getApiClient } from '../../../shared/api';

interface ImportRecordingModalProps {
  isConnected: boolean;
  onImport: (result: ScenarioToModelResult) => void;
  onClose: () => void;
}

interface ScenarioEntry {
  id: string;
  name: string;
  stepCount: number;
}

export function ImportRecordingModal({ isConnected, onImport, onClose }: ImportRecordingModalProps) {
  const [scenarios, setScenarios] = useState<ScenarioEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ScenarioToModelResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load scenarios from backend
  useEffect(() => {
    if (!isConnected) return;

    setIsLoading(true);
    getApiClient()
      .then((client) => client.listScenarios())
      .then((response) => {
        if (response.success && response.data) {
          const items = response.data.items || [];
          setScenarios(
            items.map((s: { id: string; name?: string; steps?: unknown[] }) => ({
              id: s.id,
              name: s.name || 'Unnamed',
              stepCount: s.steps?.length || 0,
            }))
          );
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setIsLoading(false));
  }, [isConnected]);

  const handleSelect = useCallback(
    async (scenarioId: string) => {
      setSelectedId(scenarioId);
      setPreview(null);
      setError(null);

      try {
        const client = await getApiClient();
        const response = await client.getScenario(scenarioId);
        if (!response.success || !response.data) {
          setError('Failed to load scenario');
          return;
        }

        const data = response.data;
        const scenario = {
          id: data.id,
          name: data.name,
          meta: {
            url: data.url || '',
            viewport: data.viewport || { width: 1440, height: 900 },
            astSchemaVersion: '1.0.0',
          },
          steps: data.steps,
        } as unknown as Scenario;
        const result = convertScenarioToModel(scenario, {
          modelName: scenario.name,
        });
        setPreview(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Conversion failed');
      }
    },
    []
  );

  const handleFileImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const scenario = JSON.parse(text) as Scenario;
        const result = convertScenarioToModel(scenario, {
          modelName: scenario.name ?? file.name.replace('.json', ''),
        });
        setPreview(result);
        setSelectedId('file');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid file');
      }
    };
    input.click();
  }, []);

  const handleConfirm = useCallback(() => {
    if (preview) onImport(preview);
  }, [preview, onImport]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div className="bg-gray-800 rounded-lg shadow-xl w-[520px] max-h-[75vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">녹화 가져오기</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* File import */}
          <button
            type="button"
            onClick={handleFileImport}
            className="w-full px-4 py-3 border border-dashed border-gray-600 rounded-md text-sm text-gray-400 hover:border-orange-500 hover:text-orange-300 transition-colors"
          >
            JSON 파일에서 가져오기
          </button>

          {/* Backend scenarios */}
          {isConnected && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                서버 시나리오
              </div>

              {isLoading && <div className="text-sm text-gray-500 text-center py-4">로딩 중...</div>}

              {!isLoading && scenarios.length === 0 && (
                <div className="text-sm text-gray-500 text-center py-4">시나리오 없음</div>
              )}

              <div className="space-y-1 max-h-40 overflow-y-auto">
                {scenarios.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelect(s.id)}
                    className={`w-full px-3 py-2 text-left rounded-md transition-colors ${
                      selectedId === s.id
                        ? 'bg-orange-600/20 border border-orange-600/30'
                        : 'hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-sm text-white">{s.name}</div>
                    <div className="text-[10px] text-gray-500">{s.stepCount} steps</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-3 py-2 bg-red-900/50 border border-red-800 rounded-md text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                변환 미리보기
              </div>
              <div className="grid grid-cols-3 gap-2">
                <PreviewCard label="상태" value={preview.model.states.length} />
                <PreviewCard label="전이" value={preview.model.transitions.length} />
                <PreviewCard label="바인딩" value={preview.model.elementBindings.length} />
              </div>

              {preview.unmappedSteps.length > 0 && (
                <div className="px-3 py-2 bg-yellow-900/30 border border-yellow-800/50 rounded-md">
                  <div className="text-xs font-medium text-yellow-400 mb-1">
                    미변환 스텝 ({preview.unmappedSteps.length})
                  </div>
                  {preview.unmappedSteps.map((u) => (
                    <div key={u.index} className="text-[10px] text-yellow-300/70">
                      [{u.index}] {u.step.type}: {u.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
            onClick={handleConfirm}
            disabled={!preview}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            모델로 가져오기
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-3 py-2 bg-gray-700 rounded-md text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
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
