import type { Step } from '@like-cake/ast-types';
import type { RawEvent } from '@like-cake/event-collector';

/**
 * Recording session data stored in chrome.storage
 */
export interface RecordingSession {
  id: string;
  isRecording: boolean;
  isPaused: boolean;
  startTime: number;
  url: string;
  events: RawEvent[];
  steps: Step[];
  // Backend integration
  backendSessionId?: string;
  uploadedEventCount?: number;
}

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  CURRENT_SESSION: 'currentSession',
  SESSIONS_HISTORY: 'sessionsHistory',
  SETTINGS: 'settings',
} as const;

/**
 * Extension settings
 */
export interface ExtensionSettings {
  // Event capture settings
  captureClicks: boolean;
  captureInputs: boolean;
  captureKeyboard: boolean;
  captureScroll: boolean;
  captureNavigation: boolean;
  // Backend settings
  backendUrl: string;
  autoUpload: boolean;
  // Legacy
  autoSave: boolean;
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: ExtensionSettings = {
  captureClicks: true,
  captureInputs: true,
  captureKeyboard: true,
  captureScroll: true,
  captureNavigation: true,
  backendUrl: 'http://localhost:3001',
  autoUpload: true,
  autoSave: false,
};

/**
 * Get current recording session
 */
export async function getCurrentSession(): Promise<RecordingSession | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.CURRENT_SESSION);
  return result[STORAGE_KEYS.CURRENT_SESSION] || null;
}

/**
 * Save current recording session
 */
export async function saveCurrentSession(session: RecordingSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CURRENT_SESSION]: session });
}

/**
 * Clear current recording session
 */
export async function clearCurrentSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.CURRENT_SESSION);
}

/**
 * Add event to current session
 */
export async function addEventToSession(event: RawEvent): Promise<void> {
  const session = await getCurrentSession();
  if (session) {
    session.events.push(event);
    await saveCurrentSession(session);
  }
}

/**
 * Get extension settings
 */
export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  return { ...DEFAULT_SETTINGS, ...result[STORAGE_KEYS.SETTINGS] };
}

/**
 * Save extension settings
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.sync.set({
    [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },
  });
}

/**
 * Generate unique session ID
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `session-${timestamp}-${random}`;
}

/**
 * Create a new recording session
 */
export function createSession(url: string): RecordingSession {
  return {
    id: generateSessionId(),
    isRecording: true,
    isPaused: false,
    startTime: Date.now(),
    url,
    events: [],
    steps: [],
  };
}
