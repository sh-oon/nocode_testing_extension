import { useEffect, useState } from 'react';
import { checkBackendConnection } from '../../shared/api';
import { FlowBuilder } from './FlowBuilder';
import { ScenarioWizard } from './ScenarioWizard';
import { SettingsPanel } from './SettingsPanel';
import { ConnectionDot, ErrorBoundary, SettingsIcon, TabToggle } from '@like-cake/ui-components';

type AppMode = 'scenario' | 'flow';

const APP_TABS: Array<{ value: AppMode; label: string }> = [
  { value: 'scenario', label: '시나리오' },
  { value: 'flow', label: '플로우' },
];

export function App() {
  const [mode, setMode] = useState<AppMode>('scenario');
  const [isConnected, setIsConnected] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    checkBackendConnection().then((result) => {
      setIsConnected(result.connected);
    });
  }, []);

  return (
    <ErrorBoundary>
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-bold text-gray-900 tracking-tight">Like Cake</h1>
          <ConnectionDot connected={isConnected} />
          <TabToggle value={mode} onChange={setMode} tabs={APP_TABS} />
        </div>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="설정"
        >
          <SettingsIcon />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {mode === 'scenario' ? (
          <ScenarioWizard isConnected={isConnected} />
        ) : (
          <FlowBuilder isConnected={isConnected} />
        )}
      </div>

      {/* Settings */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConnectionChange={(connected: boolean) => setIsConnected(connected)}
      />
    </div>
    </ErrorBoundary>
  );
}
