import { useCallback, useEffect, useState } from 'react';
import { getApiClient, type BackendScenarioDetail } from '../../shared/api';

interface ScenarioDetailPanelProps {
  scenarioId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (scenario: BackendScenarioDetail) => void;
  onDelete?: (scenarioId: string) => void;
}

export function ScenarioDetailPanel({
  scenarioId,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
}: ScenarioDetailPanelProps) {
  const [scenario, setScenario] = useState<BackendScenarioDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');

  // Load scenario details
  useEffect(() => {
    if (!isOpen || !scenarioId) return;

    const loadScenario = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const client = await getApiClient();
        const response = await client.getScenario(scenarioId);

        if (response.success && response.data) {
          setScenario(response.data);
          setName(response.data.name || '');
          setDescription(response.data.description || '');
          setTags(response.data.tags?.join(', ') || '');
        } else {
          setError(response.error || 'Failed to load scenario');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadScenario();
  }, [isOpen, scenarioId]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!scenarioId) return;

    setIsSaving(true);
    setError(null);

    try {
      const client = await getApiClient();
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const response = await client.updateScenario(scenarioId, {
        name: name || undefined,
        description: description || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
      });

      if (response.success && response.data) {
        setScenario(response.data);
        onUpdate?.(response.data);
      } else {
        setError(response.error || 'Failed to save scenario');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }, [scenarioId, name, description, tags, onUpdate]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!scenarioId) return;
    if (!confirm('Are you sure you want to delete this scenario?')) return;

    setIsSaving(true);
    setError(null);

    try {
      const client = await getApiClient();
      const response = await client.deleteScenario(scenarioId);

      if (response.success) {
        onDelete?.(scenarioId);
        onClose();
      } else {
        setError(response.error || 'Failed to delete scenario');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  }, [scenarioId, onDelete, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Scenario Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
              <span className="ml-2 text-gray-400">Loading...</span>
            </div>
          ) : error ? (
            <div className="bg-red-900/50 border border-red-800 rounded-md p-3 text-red-200 text-sm">
              {error}
            </div>
          ) : scenario ? (
            <div className="space-y-4">
              {/* ID (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">ID</label>
                <div className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-300 text-sm font-mono">
                  {scenario.id}
                </div>
              </div>

              {/* Name */}
              <div>
                <label htmlFor="scenario-name" className="block text-sm font-medium text-gray-400 mb-1">
                  Name
                </label>
                <input
                  id="scenario-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter scenario name"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="scenario-description" className="block text-sm font-medium text-gray-400 mb-1">
                  Description
                </label>
                <textarea
                  id="scenario-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description"
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500 resize-none"
                />
              </div>

              {/* Tags */}
              <div>
                <label htmlFor="scenario-tags" className="block text-sm font-medium text-gray-400 mb-1">
                  Tags
                </label>
                <input
                  id="scenario-tags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:border-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">Separate tags with commas</p>
              </div>

              {/* Meta info */}
              <div className="pt-4 border-t border-gray-700 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">URL:</span>
                  <span className="text-gray-300 truncate max-w-[250px]" title={scenario.url}>
                    {scenario.url}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Steps:</span>
                  <span className="text-gray-300">{scenario.steps?.length || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Viewport:</span>
                  <span className="text-gray-300">
                    {scenario.viewport?.width} x {scenario.viewport?.height}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Created:</span>
                  <span className="text-gray-300">
                    {new Date(scenario.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Updated:</span>
                  <span className="text-gray-300">
                    {new Date(scenario.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isLoading || isSaving}
            className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-md transition-colors disabled:opacity-50"
          >
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading || isSaving}
              className="px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 text-white text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
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

function LoadingSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin text-primary-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
