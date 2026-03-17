import { useCallback, useEffect, useRef, useState } from 'react';
import type { Scenario, Step, StepResult } from '@like-cake/ast-types';
import type { EventCatalogEntry } from '@like-cake/mbt-catalog';
import { getEventById, convertBoundEventToStep } from '@like-cake/mbt-catalog';
import type { ElementBinding, BoundEvent } from '@like-cake/mbt-catalog';
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

export interface PendingStepDraft {
  eventId: string;
  catalogEntry: EventCatalogEntry;
  params: Record<string, unknown>;
  selectorCandidates: SelectorCandidate[];
  selectedSelector: string | null;
  elementInfo: Record<string, unknown> | null;
}

export interface WizardPlaybackState {
  state: PlayerState;
  currentStepIndex: number;
  stepResults: StepResult[];
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
  const tabIdRef = useRef<number | undefined>(undefined);

  // Resolve tab ID
  useEffect(() => {
    if (typeof chrome.devtools?.inspectedWindow?.tabId === 'number') {
      tabIdRef.current = chrome.devtools.inspectedWindow.tabId;
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        tabIdRef.current = tab?.id;
      });
    }
  }, []);

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
        case 'PLAYBACK_STEP_COMPLETE':
          if (message.result) {
            setPlaybackState((prev) => ({
              ...prev,
              stepResults: [...prev.stepResults, message.result as StepResult],
            }));
          }
          break;
        case 'PLAYBACK_COMPLETED':
          setPlaybackState((prev) => ({ ...prev, state: 'completed' }));
          break;
        case 'PLAYBACK_ERROR':
          setPlaybackState((prev) => ({ ...prev, state: 'error' }));
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const startDraftFromCatalog = useCallback((eventId: string) => {
    const entry = getEventById(eventId);
    if (!entry) return;

    const defaultParams: Record<string, unknown> = {};
    for (const p of entry.params) {
      if (p.defaultValue !== undefined) defaultParams[p.name] = p.defaultValue;
    }

    const newDraft: PendingStepDraft = {
      eventId,
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
      chrome.runtime.sendMessage({ type: 'START_ELEMENT_INSPECT', tabId: tabIdRef.current });
    }
  }, []);

  const cancelDraft = useCallback(() => {
    if (isInspecting) {
      chrome.runtime.sendMessage({ type: 'STOP_ELEMENT_INSPECT', tabId: tabIdRef.current });
      setIsInspecting(false);
    }
    setDraft(null);
  }, [isInspecting]);

  const selectSelector = useCallback((selector: string) => {
    setDraft((prev) => prev ? { ...prev, selectedSelector: selector } : prev);
  }, []);

  const updateParams = useCallback((params: Record<string, unknown>) => {
    setDraft((prev) => prev ? { ...prev, params } : prev);
  }, []);

  const confirmStep = useCallback(() => {
    if (!draft) return;

    const step = buildStepFromDraft(draft);
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

  const playScenario = useCallback(() => {
    if (steps.length === 0) return;

    const firstNavigate = steps.find((s) => s.type === 'navigate');
    const scenario: Scenario = {
      id: `wizard-${Date.now()}`,
      name: scenarioName || 'Wizard Scenario',
      meta: {
        recordedAt: new Date().toISOString(),
        url: firstNavigate?.type === 'navigate' ? firstNavigate.url : '',
        viewport: { width: 1440, height: 900 },
        astSchemaVersion: '1.0.0',
      },
      steps,
    };

    setPlaybackState({ state: 'playing', currentStepIndex: -1, stepResults: [] });
    chrome.runtime.sendMessage({
      type: 'START_PLAYBACK',
      tabId: tabIdRef.current,
      scenario,
    });
  }, [steps, scenarioName]);

  const saveToBackend = useCallback(async () => {
    if (steps.length === 0) return;

    setIsSaving(true);
    try {
      const client = await getApiClient();
      const firstNavigate = steps.find((s) => s.type === 'navigate');
      const response = await client.createScenario({
        name: scenarioName || `Wizard Scenario ${new Date().toLocaleString()}`,
        url: firstNavigate?.type === 'navigate' ? firstNavigate.url : '',
        steps,
        viewport: { width: 1440, height: 900 },
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
    cancelDraft,
    selectSelector,
    updateParams,
    confirmStep,
    removeStep,
    moveStep,
    playScenario,
    saveToBackend,
    reset,
  };
}

/** Build a Step from the wizard draft using existing convertBoundEventToStep */
function buildStepFromDraft(draft: PendingStepDraft): Step | null {
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
    eventId: draft.eventId,
    elementBindingId: needsElement ? tempBindingId : null,
    params: draft.params,
  };

  const result = convertBoundEventToStep(boundEvent, needsElement ? [tempBinding] : []);
  return result.ok ? result.step : null;
}
