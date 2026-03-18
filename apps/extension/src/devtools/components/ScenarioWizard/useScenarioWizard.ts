import { useCallback, useEffect, useState } from 'react';
import type { Scenario, Step, StepResult } from '@like-cake/ast-types';
import type { EventCatalogEntry, VerificationCatalogEntry } from '@like-cake/mbt-catalog';
import { getEventById, getVerificationById, convertBoundEventToStep, convertBoundVerificationToStep } from '@like-cake/mbt-catalog';
import type { ElementBinding, BoundEvent, BoundVerification } from '@like-cake/mbt-catalog';
import type { PlayerState } from '@like-cake/step-player';
import { getApiClient } from '../../../shared/api';

export interface SelectorCandidate {
  strategy: string;
  selector: string;
  score: number;
  isUnique: boolean;
  isReadable: boolean;
  confidence: number;
}

export type CatalogType = 'event' | 'verification';

export interface PendingStepDraft {
  catalogType: CatalogType;
  catalogId: string;
  catalogEntry: EventCatalogEntry | VerificationCatalogEntry;
  params: Record<string, unknown>;
  selectorCandidates: SelectorCandidate[];
  selectedSelector: string | null;
  elementInfo: Record<string, unknown> | null;
}

export interface WizardPlaybackState {
  state: PlayerState;
  currentStepIndex: number;
  stepResults: StepResult[];
  errorMessage?: string;
  failedStepIndex?: number;
}

export function useScenarioWizard() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [draft, setDraft] = useState<PendingStepDraft | null>(null);
  const [playbackState, setPlaybackState] = useState<WizardPlaybackState>({
    state: 'idle',
    currentStepIndex: -1,
    stepResults: [],
  });
  const [backendScenarioId, setBackendScenarioId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Get current browser viewport
  const getViewport = useCallback(async (): Promise<{ width: number; height: number }> => {
    try {
      const tabId = typeof chrome.devtools?.inspectedWindow?.tabId === 'number'
        ? chrome.devtools.inspectedWindow.tabId
        : undefined;
      if (tabId) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.width && tab.height) return { width: tab.width, height: tab.height };
      }
    } catch { /* fallback */ }
    return { width: window.screen.availWidth || 1440, height: window.screen.availHeight || 900 };
  }, []);

  // Resolve tab ID synchronously if possible (DevTools panel)
  const getTabId = useCallback(async (): Promise<number | undefined> => {
    if (typeof chrome.devtools?.inspectedWindow?.tabId === 'number') {
      return chrome.devtools.inspectedWindow.tabId;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
  }, []);

  // Cleanup inspect mode on unmount
  useEffect(() => {
    return () => {
      getTabId().then((tabId) => {
        chrome.runtime.sendMessage({ type: 'STOP_ELEMENT_INSPECT', tabId }).catch(() => {});
      });
    };
  }, [getTabId]);

  // Listen for messages
  useEffect(() => {
    const handler = (message: { type: string; [key: string]: unknown }) => {
      switch (message.type) {
        case 'ELEMENT_INSPECTED': {
          setIsInspecting(false);
          const info = message.elementInfo as PendingStepDraft['elementInfo'];
          if (!info) break; // ESC pressed

          setDraft((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              elementInfo: info,
              selectorCandidates: (info?.selectorCandidates ?? []) as SelectorCandidate[],
              selectedSelector: ((info?.selectorCandidates as SelectorCandidate[] | undefined)?.[0]?.selector) ?? null,
            };
          });
          break;
        }
        case 'PLAYBACK_STEP_START':
          if (message.stepIndex !== undefined) {
            setPlaybackState((prev) => ({ ...prev, currentStepIndex: message.stepIndex as number }));
          }
          break;
        case 'PLAYBACK_STEP_COMPLETE': {
          if (message.result) {
            const result = message.result as StepResult;
            setPlaybackState((prev) => {
              const newResults = [...prev.stepResults, result];
              // If step failed, mark error state immediately
              if (result.status === 'failed') {
                return {
                  ...prev,
                  stepResults: newResults,
                  state: 'error',
                  failedStepIndex: result.index ?? prev.stepResults.length,
                  errorMessage: result.error?.message || `Step ${(result.index ?? prev.stepResults.length) + 1} 실패`,
                };
              }
              return { ...prev, stepResults: newResults };
            });
          }
          break;
        }
        case 'PLAYBACK_COMPLETED':
          setPlaybackState((prev) => ({ ...prev, state: 'completed' }));
          break;
        case 'PLAYBACK_ERROR': {
          const errMsg = (message.error as string) || '재생 중 오류 발생';
          setPlaybackState((prev) => ({
            ...prev,
            state: 'error',
            errorMessage: errMsg,
          }));
          break;
        }
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const startDraftFromCatalog = useCallback((catalogId: string, catalogType: CatalogType = 'event') => {
    const entry = catalogType === 'event'
      ? getEventById(catalogId)
      : getVerificationById(catalogId);
    if (!entry) return;

    const defaultParams: Record<string, unknown> = {};
    for (const p of entry.params) {
      if (p.defaultValue !== undefined) defaultParams[p.name] = p.defaultValue;
    }

    const newDraft: PendingStepDraft = {
      catalogType,
      catalogId,
      catalogEntry: entry,
      params: defaultParams,
      selectorCandidates: [],
      selectedSelector: null,
      elementInfo: null,
    };

    setDraft(newDraft);

    // If element required, start inspect mode
    if (entry.elementRequirement !== 'none') {
      setIsInspecting(true);
      getTabId().then((tabId) => {
        chrome.runtime.sendMessage({ type: 'START_ELEMENT_INSPECT', tabId });
      });
    }
  }, [getTabId]);

  const switchAction = useCallback((catalogId: string, catalogType: CatalogType = 'event') => {
    const entry = catalogType === 'event'
      ? getEventById(catalogId)
      : getVerificationById(catalogId);
    if (!entry) return;

    const defaultParams: Record<string, unknown> = {};
    for (const p of entry.params) {
      if (p.defaultValue !== undefined) defaultParams[p.name] = p.defaultValue;
    }

    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        catalogType,
        catalogId,
        catalogEntry: entry,
        params: defaultParams,
        ...(entry.elementRequirement === 'none' ? { elementInfo: null, selectorCandidates: [], selectedSelector: null } : {}),
      };
    });
  }, []);

  const cancelDraft = useCallback(() => {
    if (isInspecting) {
      getTabId().then((tabId) => {
        chrome.runtime.sendMessage({ type: 'STOP_ELEMENT_INSPECT', tabId });
      });
      setIsInspecting(false);
    }
    setDraft(null);
  }, [isInspecting, getTabId]);

  const startInspect = useCallback(() => {
    setIsInspecting(true);
    getTabId().then((tabId) => {
      chrome.runtime.sendMessage({ type: 'START_ELEMENT_INSPECT', tabId });
    });
  }, [getTabId]);

  const selectSelector = useCallback((selector: string) => {
    setDraft((prev) => prev ? { ...prev, selectedSelector: selector } : prev);
  }, []);

  const manualSelector = useCallback((selector: string) => {
    setDraft((prev) => prev ? { ...prev, selectedSelector: selector, selectorCandidates: [{ strategy: 'manual', selector, score: 100, isUnique: true, isReadable: true, confidence: 100 }] } : prev);
  }, []);

  const updateParams = useCallback((params: Record<string, unknown>) => {
    setDraft((prev) => prev ? { ...prev, params } : prev);
  }, []);

  const confirmStep = useCallback(() => {
    if (!draft) return;

    const step = draft.catalogType === 'event'
      ? buildEventStepFromDraft(draft)
      : buildVerificationStepFromDraft(draft);
    if (!step) return;

    setSteps((prev) => [...prev, step]);
    setDraft(null);
    setPlaybackState({ state: 'idle', currentStepIndex: -1, stepResults: [] });
    setBackendScenarioId(null);
  }, [draft]);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setPlaybackState({ state: 'idle', currentStepIndex: -1, stepResults: [] });
    setBackendScenarioId(null);
  }, []);

  const moveStep = useCallback((fromIndex: number, toIndex: number) => {
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const playScenario = useCallback(async () => {
    if (steps.length === 0) return;

    const viewport = await getViewport();
    const firstNavigate = steps.find((s) => s.type === 'navigate');
    const scenario: Scenario = {
      id: `wizard-${Date.now()}`,
      name: scenarioName || 'Wizard Scenario',
      meta: {
        recordedAt: new Date().toISOString(),
        url: firstNavigate?.type === 'navigate' ? firstNavigate.url : '',
        viewport,
        astSchemaVersion: '1.0.0',
      },
      steps,
    };

    setPlaybackState({ state: 'playing', currentStepIndex: -1, stepResults: [] });
    const tabId = await getTabId();
    chrome.runtime.sendMessage({
      type: 'START_PLAYBACK',
      tabId,
      scenario,
    });
  }, [steps, scenarioName, getTabId, getViewport]);

  const saveToBackend = useCallback(async () => {
    if (steps.length === 0) return;

    setIsSaving(true);
    try {
      const viewport = await getViewport();
      const client = await getApiClient();
      const firstNavigate = steps.find((s) => s.type === 'navigate');
      const response = await client.createScenario({
        name: scenarioName || `Wizard Scenario ${new Date().toLocaleString()}`,
        url: firstNavigate?.type === 'navigate' ? firstNavigate.url : '',
        steps,
        viewport,
      });

      if (response.success && response.data) {
        setBackendScenarioId(response.data.id);
      }
    } finally {
      setIsSaving(false);
    }
  }, [steps, scenarioName]);

  const reset = useCallback(() => {
    cancelDraft();
    setSteps([]);
    setPlaybackState({ state: 'idle', currentStepIndex: -1, stepResults: [] });
    setBackendScenarioId(null);
  }, [cancelDraft]);

  const canPlay = steps.length > 0 && playbackState.state !== 'playing';
  const canSave = playbackState.state === 'completed' && !backendScenarioId;

  return {
    steps,
    scenarioName,
    setScenarioName,
    isInspecting,
    draft,
    playbackState,
    backendScenarioId,
    isSaving,
    canPlay,
    canSave,

    startDraftFromCatalog,
    switchAction,
    cancelDraft,
    startInspect,
    selectSelector,
    manualSelector,
    updateParams,
    confirmStep,
    removeStep,
    moveStep,
    playScenario,
    saveToBackend,
    reset,
  };
}

/** Build a Step from an event draft */
function buildEventStepFromDraft(draft: PendingStepDraft): Step | null {
  const tempBindingId = '__wizard_temp__';
  const needsElement = draft.catalogEntry.elementRequirement !== 'none';

  const tempBinding: ElementBinding = {
    id: tempBindingId,
    label: 'wizard-element',
    selector: draft.selectedSelector || '',
    candidates: [],
    selectionMethod: 'manual',
    pageUrl: '',
    createdAt: Date.now(),
  };

  const boundEvent: BoundEvent = {
    eventId: draft.catalogId,
    elementBindingId: needsElement ? tempBindingId : null,
    params: draft.params,
  };

  const result = convertBoundEventToStep(boundEvent, needsElement ? [tempBinding] : []);
  return result.ok ? result.step : null;
}

/** Build a Step from a verification draft */
function buildVerificationStepFromDraft(draft: PendingStepDraft): Step | null {
  const tempBindingId = '__wizard_temp__';
  const needsElement = draft.catalogEntry.elementRequirement !== 'none';

  const tempBinding: ElementBinding = {
    id: tempBindingId,
    label: 'wizard-element',
    selector: draft.selectedSelector || '',
    candidates: [],
    selectionMethod: 'manual',
    pageUrl: '',
    createdAt: Date.now(),
  };

  const boundVerification: BoundVerification = {
    verificationId: draft.catalogId,
    elementBindingId: needsElement ? tempBindingId : null,
    params: draft.params,
    critical: true,
  };

  const result = convertBoundVerificationToStep(boundVerification, needsElement ? [tempBinding] : []);
  return result.ok ? result.step : null;
}
