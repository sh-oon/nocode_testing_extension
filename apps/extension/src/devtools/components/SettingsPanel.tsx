import { useCallback, useEffect, useState } from 'react';
import { checkBackendConnection } from '../../shared/api';
import { type ExtensionSettings, getSettings, saveSettings } from '../../shared/storage';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChange: (connected: boolean) => void;
}

export function SettingsPanel({ isOpen, onClose, onConnectionChange }: SettingsPanelProps) {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [backendUrl, setBackendUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setBackendUrl(s.backendUrl);
    });
  }, []);

  // Check connection when panel opens
  useEffect(() => {
    if (isOpen) {
      checkConnection();
    }
  }, [isOpen]);

  const checkConnection = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await checkBackendConnection();
      setIsConnected(result.connected);
      onConnectionChange(result.connected);
    } catch {
      setIsConnected(false);
      onConnectionChange(false);
    } finally {
      setIsChecking(false);
    }
  }, [onConnectionChange]);

  const handleSave = useCallback(async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      await saveSettings({
        ...settings,
        backendUrl,
      });
      setSettings({ ...settings, backendUrl });
      await checkConnection();
    } finally {
      setIsSaving(false);
    }
  }, [settings, backendUrl, checkConnection]);

  const handleToggle = useCallback(
    async (key: keyof ExtensionSettings) => {
      if (!settings) return;
      const newValue = !settings[key];
      const updated = { ...settings, [key]: newValue };
      setSettings(updated);
      await saveSettings({ [key]: newValue });
    },
    [settings]
  );

  if (!isOpen || !settings) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Backend Connection */}
          <section>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Backend Connection</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="backend-url" className="block text-xs text-gray-400 mb-1">
                  Backend URL
                </label>
                <div className="flex gap-2">
                  <input
                    id="backend-url"
                    type="url"
                    value={backendUrl}
                    onChange={(e) => setBackendUrl(e.target.value)}
                    placeholder="http://localhost:3001"
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm focus:outline-none focus:border-primary-500"
                  />
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-600 rounded-md text-sm font-medium transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Connection Status */}
              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-sm">
                    {isChecking ? 'Checking...' : isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={checkConnection}
                  disabled={isChecking}
                  className="text-xs text-primary-400 hover:text-primary-300 disabled:text-gray-500"
                >
                  Test Connection
                </button>
              </div>

              {/* Auto Upload Toggle */}
              <ToggleOption
                label="Auto-upload events"
                description="Automatically upload recorded events to Backend"
                checked={settings.autoUpload}
                onChange={() => handleToggle('autoUpload')}
              />
            </div>
          </section>

          {/* Event Capture Settings */}
          <section>
            <h3 className="text-sm font-medium text-gray-300 mb-3">Event Capture</h3>
            <div className="space-y-2">
              <ToggleOption
                label="Clicks"
                description="Capture click and double-click events"
                checked={settings.captureClicks}
                onChange={() => handleToggle('captureClicks')}
              />
              <ToggleOption
                label="Inputs"
                description="Capture text input and form changes"
                checked={settings.captureInputs}
                onChange={() => handleToggle('captureInputs')}
              />
              <ToggleOption
                label="Keyboard"
                description="Capture special key presses (Enter, Tab, etc.)"
                checked={settings.captureKeyboard}
                onChange={() => handleToggle('captureKeyboard')}
              />
              <ToggleOption
                label="Scroll"
                description="Capture scroll events"
                checked={settings.captureScroll}
                onChange={() => handleToggle('captureScroll')}
              />
              <ToggleOption
                label="Navigation"
                description="Capture page navigations"
                checked={settings.captureNavigation}
                onChange={() => handleToggle('captureNavigation')}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

function ToggleOption({ label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <div className="flex items-center justify-between p-2 hover:bg-gray-700/30 rounded-md transition-colors">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          checked ? 'bg-primary-600' : 'bg-gray-600'
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
