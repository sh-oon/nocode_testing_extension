import type { CapturedApiCall } from '@like-cake/api-interceptor';
import type { Step } from '@like-cake/ast-types';
import type { FullSnapshot } from '@like-cake/dom-serializer';
import type { RawEvent } from '@like-cake/event-collector';

/**
 * Labeled snapshot for session storage
 */
export interface LabeledSnapshot {
  snapshot: FullSnapshot;
  label?: string;
}

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
  apiCalls: CapturedApiCall[];
  snapshots: LabeledSnapshot[];
  // Backend integration
  backendSessionId?: string;
  uploadedEventCount?: number;
}

/**
 * Baseline data for comparison testing
 */
export interface ScenarioBaseline {
  /** Unique baseline ID */
  id: string;
  /** Associated scenario ID */
  scenarioId: string;
  /** Human-readable name */
  name: string;
  /** When baseline was captured */
  capturedAt: number;
  /** URL where baseline was captured */
  url: string;
  /** Captured API calls during recording */
  apiCalls: CapturedApiCall[];
  /** DOM snapshots captured */
  snapshots: LabeledSnapshot[];
  /** Final screenshot (base64) */
  finalScreenshot?: string;
  /** Metadata */
  meta?: {
    viewport?: { width: number; height: number };
    userAgent?: string;
  };
}

/**
 * Playback session state
 */
export interface PlaybackSession {
  /** Session ID */
  id: string;
  /** Scenario being played */
  scenarioId: string;
  /** Baseline being compared against (if any) */
  baselineId?: string;
  /** Current playback state */
  state: 'idle' | 'playing' | 'paused' | 'stopped' | 'completed' | 'error';
  /** Current step index */
  currentStepIndex: number;
  /** Total steps count */
  totalSteps: number;
  /** Start time */
  startTime?: number;
  /** API calls captured during playback */
  apiCalls: CapturedApiCall[];
  /** Snapshots captured during playback */
  snapshots: LabeledSnapshot[];
  /** Error message if state is error */
  error?: string;
}

/**
 * Storage keys
 */
const STORAGE_KEYS = {
  CURRENT_SESSION: 'currentSession',
  SESSIONS_HISTORY: 'sessionsHistory',
  SETTINGS: 'settings',
  BASELINES: 'baselines',
  PLAYBACK_SESSION: 'playbackSession',
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
  // API capture settings
  captureApiCalls: boolean;
  captureApiRequestBody: boolean;
  captureApiResponseBody: boolean;
  apiMaxBodySize: number;
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
  captureApiCalls: true,
  captureApiRequestBody: true,
  captureApiResponseBody: true,
  apiMaxBodySize: 1024 * 1024, // 1MB
  backendUrl: 'http://localhost:4000',
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
    apiCalls: [],
    snapshots: [],
  };
}

// ============================================
// Baseline Storage Functions
// ============================================

/**
 * Generate unique baseline ID
 */
export function generateBaselineId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `baseline-${timestamp}-${random}`;
}

/**
 * Get all baselines
 */
export async function getBaselines(): Promise<ScenarioBaseline[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.BASELINES);
  return result[STORAGE_KEYS.BASELINES] || [];
}

/**
 * Get baseline by ID
 */
export async function getBaselineById(id: string): Promise<ScenarioBaseline | null> {
  const baselines = await getBaselines();
  return baselines.find((b) => b.id === id) || null;
}

/**
 * Get baselines for a specific scenario
 */
export async function getBaselinesForScenario(scenarioId: string): Promise<ScenarioBaseline[]> {
  const baselines = await getBaselines();
  return baselines.filter((b) => b.scenarioId === scenarioId);
}

/**
 * Save a new baseline
 */
export async function saveBaseline(baseline: ScenarioBaseline): Promise<void> {
  const baselines = await getBaselines();
  const existingIndex = baselines.findIndex((b) => b.id === baseline.id);

  if (existingIndex >= 0) {
    baselines[existingIndex] = baseline;
  } else {
    baselines.push(baseline);
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.BASELINES]: baselines });
}

/**
 * Create baseline from recording session
 */
export function createBaselineFromSession(
  session: RecordingSession,
  scenarioId: string,
  name?: string
): ScenarioBaseline {
  return {
    id: generateBaselineId(),
    scenarioId,
    name: name || `Baseline ${new Date().toLocaleString()}`,
    capturedAt: Date.now(),
    url: session.url,
    apiCalls: session.apiCalls,
    snapshots: session.snapshots,
    meta: {
      viewport: { width: 1280, height: 720 }, // Default, should be from actual recording
    },
  };
}

/**
 * Delete a baseline
 */
export async function deleteBaseline(id: string): Promise<void> {
  const baselines = await getBaselines();
  const filtered = baselines.filter((b) => b.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEYS.BASELINES]: filtered });
}

/**
 * Clear all baselines for a scenario
 */
export async function clearBaselinesForScenario(scenarioId: string): Promise<void> {
  const baselines = await getBaselines();
  const filtered = baselines.filter((b) => b.scenarioId !== scenarioId);
  await chrome.storage.local.set({ [STORAGE_KEYS.BASELINES]: filtered });
}

// ============================================
// Playback Session Functions
// ============================================

/**
 * Generate unique playback session ID
 */
export function generatePlaybackSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `playback-${timestamp}-${random}`;
}

/**
 * Get current playback session
 */
export async function getPlaybackSession(): Promise<PlaybackSession | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PLAYBACK_SESSION);
  return result[STORAGE_KEYS.PLAYBACK_SESSION] || null;
}

/**
 * Save playback session
 */
export async function savePlaybackSession(session: PlaybackSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.PLAYBACK_SESSION]: session });
}

/**
 * Clear playback session
 */
export async function clearPlaybackSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.PLAYBACK_SESSION);
}

/**
 * Create a new playback session
 */
export function createPlaybackSession(
  scenarioId: string,
  totalSteps: number,
  baselineId?: string
): PlaybackSession {
  return {
    id: generatePlaybackSessionId(),
    scenarioId,
    baselineId,
    state: 'idle',
    currentStepIndex: -1,
    totalSteps,
    apiCalls: [],
    snapshots: [],
  };
}

/**
 * Update playback session state
 */
export async function updatePlaybackState(
  state: PlaybackSession['state'],
  stepIndex?: number,
  error?: string
): Promise<void> {
  const session = await getPlaybackSession();
  if (session) {
    session.state = state;
    if (stepIndex !== undefined) {
      session.currentStepIndex = stepIndex;
    }
    if (error) {
      session.error = error;
    }
    if (state === 'playing' && !session.startTime) {
      session.startTime = Date.now();
    }
    await savePlaybackSession(session);
  }
}
