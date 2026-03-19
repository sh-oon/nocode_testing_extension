import { useCallback, useEffect, useState } from 'react';
import type { Scenario, Step, StepResult } from '@like-cake/ast-types';
import type {
  BoundEvent,
  BoundVerification,
  ElementBinding,
  EventCatalogEntry,
  VerificationCatalogEntry,
} from '@like-cake/mbt-catalog';
import {
  convertBoundEventToStep,
  convertBoundVerificationToStep,
  getEventById,
  getVerificationById,
} from '@like-cake/mbt-catalog';
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
  insertAtIndex?: number; // undefined = append, number = insert at position
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
  const [isRecording, setIsRecording] = useState(false);
  const [draft, setDraft] = useState<PendingStepDraft | null>(null);
  const [playbackState, setPlaybackState] = useState<WizardPlaybackState>({
    state: 'idle',
    currentStepIndex: -1,
    stepResults: [],
  });
  const [backendScenarioId, setBackendScenarioId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Get current browser viewport
  const getViewport = useCallback(async (): Promise<{ width: number; height: number }> => {
    try {
      const tabId =
        typeof chrome.devtools?.inspectedWindow?.tabId === 'number'
          ? chrome.devtools.inspectedWindow.tabId
          : undefined;
      if (tabId) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.width && tab.height) return { width: tab.width, height: tab.height };
      }
    } catch {
      /* fallback */
    }
    return { width: window.screen.availWidth || 1440, height: window.screen.availHeight || 900 };
  }, []);

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
          if (!info) break;

          setDraft((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              elementInfo: info,
              selectorCandidates: (info?.selectorCandidates ?? []) as SelectorCandidate[],
              selectedSelector:
                (info?.selectorCandidates as SelectorCandidate[] | undefined)?.[0]?.selector ??
                null,
            };
          });
          break;
        }

        // Recording: receive steps from service worker
        case 'EVENTS_DATA': {
          if (isRecording && message.steps) {
            setSteps(message.steps as Step[]);
          }
          break;
        }
        case 'EVENT_CAPTURED': {
          if (isRecording) {
            // Request updated steps
            chrome.runtime.sendMessage({ type: 'GET_EVENTS' }, (response) => {
              if (response?.steps) {
                setSteps(response.steps as Step[]);
              }
            });
          }
          break;
        }

        // Playback messages
        case 'PLAYBACK_STEP_START':
          if (message.stepIndex !== undefined) {
            setPlaybackState((prev) => ({
              ...prev,
              currentStepIndex: message.stepIndex as number,
            }));
          }
          break;
        case 'PLAYBACK_STEP_COMPLETE': {
          if (message.result) {
            const result = message.result as StepResult;
            setPlaybackState((prev) => {
              const newResults = [...prev.stepResults, result];
              if (result.status === 'failed') {
                return {
                  ...prev,
                  stepResults: newResults,
                  state: 'error',
                  failedStepIndex: result.index ?? prev.stepResults.length,
                  errorMessage:
                    result.error?.message ||
                    `Step ${(result.index ?? prev.stepResults.length) + 1} 실패`,
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
          setPlaybackState((prev) => ({ ...prev, state: 'error', errorMessage: errMsg }));
          break;
        }

        case 'RECORDING_STARTED':
          setIsRecording(true);
          break;
        case 'RECORDING_STOPPED':
          setIsRecording(false);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [isRecording]);

  // ── Recording ──

  const startRecording = useCallback(async () => {
    const tabId = await getTabId();
    if (tabId) {
      chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId });
      setIsRecording(true);
      setPlaybackState({ state: 'idle', currentStepIndex: -1, stepResults: [] });
      setBackendScenarioId(null);
    }
  }, [getTabId]);

  const stopRecording = useCallback(() => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    setIsRecording(false);
  }, []);

  // ── Draft management ──

  const startDraftFromCatalog = useCallback(
    (catalogId: string, catalogType: CatalogType = 'event', insertAtIndex?: number) => {
      const entry =
        catalogType === 'event' ? getEventById(catalogId) : getVerificationById(catalogId);
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
        insertAtIndex,
      };

      setDraft(newDraft);

      if (entry.elementRequirement !== 'none') {
        setIsInspecting(true);
        getTabId().then((tabId) => {
          chrome.runtime.sendMessage({ type: 'START_ELEMENT_INSPECT', tabId });
        });
      }
    },
    [getTabId]
  );

  const switchAction = useCallback((catalogId: string, catalogType: CatalogType = 'event') => {
    const entry =
      catalogType === 'event' ? getEventById(catalogId) : getVerificationById(catalogId);
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
        ...(entry.elementRequirement === 'none'
          ? { elementInfo: null, selectorCandidates: [], selectedSelector: null }
          : {}),
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
    setDraft((prev) => (prev ? { ...prev, selectedSelector: selector } : prev));
  }, []);

  const manualSelector = useCallback((selector: string) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            selectedSelector: selector,
            selectorCandidates: [
              {
                strategy: 'manual',
                selector,
                score: 100,
                isUnique: true,
                isReadable: true,
                confidence: 100,
              },
            ],
          }
        : prev
    );
  }, []);

  const updateParams = useCallback((params: Record<string, unknown>) => {
    setDraft((prev) => (prev ? { ...prev, params } : prev));
  }, []);

  const confirmStep = useCallback(() => {
    if (!draft) return;

    const step =
      draft.catalogType === 'event'
        ? buildEventStepFromDraft(draft)
        : buildVerificationStepFromDraft(draft);
    if (!step) return;

    setSteps((prev) => {
      // Edit mode: replace existing step
      if (editingIndex !== null) {
        const next = [...prev];
        next[editingIndex] = step;
        return next;
      }
      // Insert mode: insert at specific position
      if (draft.insertAtIndex !== undefined) {
        const next = [...prev];
        next.splice(draft.insertAtIndex, 0, step);
        return next;
      }
      // Append mode
      return [...prev, step];
    });
    setDraft(null);
    setEditingIndex(null);
    setPlaybackState({ state: 'idle', currentStepIndex: -1, stepResults: [] });
    setBackendScenarioId(null);
  }, [draft, editingIndex]);

  // ── Step management ──

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
    setPlaybackState({ state: 'idle', currentStepIndex: -1, stepResults: [] });
    setBackendScenarioId(null);
  }, []);

  const duplicateStep = useCallback((index: number) => {
    setSteps((prev) => {
      const step = prev[index];
      if (!step) return prev;
      const copy = structuredClone(step);
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
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

  const insertStepAt = useCallback(
    (index: number) => {
      startDraftFromCatalog('visible', 'verification', index);
    },
    [startDraftFromCatalog]
  );

  const editStep = useCallback(
    (index: number) => {
      // Remove the step and open it as a draft for re-editing
      const step = steps[index];
      if (!step) return;

      setEditingIndex(index);

      // Reverse-map: determine catalogType and catalogId from step.type
      const isAssertion = ASSERT_TYPES.has(step.type);
      const catalogType: CatalogType = isAssertion ? 'verification' : 'event';

      // Map step type to catalog ID
      const catalogId = stepTypeToCatalogId(step);
      const entry =
        catalogType === 'event' ? getEventById(catalogId) : getVerificationById(catalogId);
      if (!entry) {
        setEditingIndex(null);
        return;
      }

      // Extract params from step
      const params = extractParamsFromStep(step);

      // Extract selector
      const selector =
        'selector' in step && step.selector
          ? typeof step.selector === 'string'
            ? step.selector
            : ''
          : null;

      setDraft({
        catalogType,
        catalogId,
        catalogEntry: entry,
        params,
        selectorCandidates: selector
          ? [
              {
                strategy: 'manual',
                selector,
                score: 100,
                isUnique: true,
                isReadable: true,
                confidence: 100,
              },
            ]
          : [],
        selectedSelector: selector,
        elementInfo: null,
        insertAtIndex: undefined,
      });
    },
    [steps]
  );

  // ── Playback ──

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
    chrome.runtime.sendMessage({ type: 'START_PLAYBACK', tabId, scenario });
  }, [steps, scenarioName, getTabId, getViewport]);

  // ── Save ──

  const saveToBackend = useCallback(async () => {
    if (steps.length === 0) return;

    setIsSaving(true);
    try {
      const viewport = await getViewport();
      const client = await getApiClient();
      const firstNavigate = steps.find((s) => s.type === 'navigate');
      const response = await client.createScenario({
        name: scenarioName || `Scenario ${new Date().toLocaleString()}`,
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
  }, [steps, scenarioName, getViewport]);

  const reset = useCallback(() => {
    cancelDraft();
    if (isRecording) stopRecording();
    setSteps([]);
    setPlaybackState({ state: 'idle', currentStepIndex: -1, stepResults: [] });
    setBackendScenarioId(null);
  }, [cancelDraft, isRecording, stopRecording]);

  // ── Export ──

  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const buildReportData = useCallback(() => {
    const totalDuration = playbackState.stepResults.reduce((sum, r) => sum + (r.duration ?? 0), 0);
    const passed = playbackState.stepResults.filter((r) => r.status === 'passed').length;
    const failed = playbackState.stepResults.filter((r) => r.status === 'failed').length;
    const skipped = steps.length - playbackState.stepResults.length;

    return {
      scenarioName: scenarioName || 'Wizard Scenario',
      steps,
      stepResults: playbackState.stepResults,
      summary: {
        total: steps.length,
        passed,
        failed,
        skipped,
        duration: totalDuration,
      },
      exportedAt: new Date().toISOString(),
    };
  }, [steps, scenarioName, playbackState]);

  const exportJsonReport = useCallback(() => {
    const report = buildReportData();
    const json = JSON.stringify(report, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(json, `report-${timestamp}.json`, 'application/json');
  }, [buildReportData, downloadFile]);

  const exportHtmlReport = useCallback(() => {
    const report = buildReportData();
    const date = new Date(report.exportedAt).toLocaleString('ko-KR');
    const { summary } = report;
    const isSuccess = summary.failed === 0;

    const stepRows = report.steps
      .map((step, i) => {
        const result = report.stepResults.find((r) => r.index === i);
        const status = result?.status ?? 'skipped';
        const statusLabel = status === 'passed' ? '성공' : status === 'failed' ? '실패' : '건너뜀';
        const statusColor =
          status === 'passed' ? '#16a34a' : status === 'failed' ? '#dc2626' : '#9ca3af';
        const statusBg =
          status === 'passed' ? '#f0fdf4' : status === 'failed' ? '#fef2f2' : '#f9fafb';
        const selectorSummary = 'selector' in step && step.selector ? String(step.selector) : '-';
        const duration = result?.duration != null ? `${result.duration}ms` : '-';
        const errorRow = result?.error
          ? `<tr><td colspan="5" style="padding:6px 12px;background:#fef2f2;color:#b91c1c;font-size:12px;font-family:monospace;border-bottom:1px solid #fee2e2;">${escapeHtml(result.error.message)}</td></tr>`
          : '';
        return `<tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:10px 12px;color:#6b7280;font-size:13px;">${i + 1}</td>
          <td style="padding:10px 12px;font-weight:500;font-size:13px;">${escapeHtml(step.type)}</td>
          <td style="padding:10px 12px;color:#6b7280;font-size:12px;font-family:monospace;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(selectorSummary)}</td>
          <td style="padding:10px 12px;"><span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;color:${statusColor};background:${statusBg};">${statusLabel}</span></td>
          <td style="padding:10px 12px;color:#6b7280;font-size:13px;text-align:right;">${duration}</td>
        </tr>${errorRow}`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(report.scenarioName)} - 실행 리포트</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#f9fafb;color:#111827;line-height:1.5;}
.container{max-width:860px;margin:0 auto;padding:40px 24px;}
.header{margin-bottom:32px;}
.header h1{font-size:22px;font-weight:700;color:#111827;margin-bottom:4px;}
.header .meta{font-size:13px;color:#9ca3af;}
.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:32px;}
.card{background:#fff;border:1px solid #f3f4f6;border-radius:12px;padding:20px;text-align:center;}
.card .value{font-size:28px;font-weight:700;margin-bottom:2px;}
.card .label{font-size:12px;color:#9ca3af;font-weight:500;}
.badge{display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;margin-bottom:24px;}
table{width:100%;background:#fff;border:1px solid #f3f4f6;border-radius:12px;border-collapse:collapse;overflow:hidden;}
thead th{padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #f3f4f6;}
thead th:last-child{text-align:right;}
.footer{margin-top:32px;text-align:center;font-size:11px;color:#d1d5db;}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${escapeHtml(report.scenarioName)}</h1>
    <div class="meta">${date}</div>
  </div>
  <span class="badge" style="color:${isSuccess ? '#16a34a' : '#dc2626'};background:${isSuccess ? '#f0fdf4' : '#fef2f2'};">${isSuccess ? '성공' : '실패'}</span>
  <div class="summary">
    <div class="card"><div class="value">${summary.total}</div><div class="label">전체 스텝</div></div>
    <div class="card"><div class="value" style="color:#16a34a;">${summary.passed}</div><div class="label">성공</div></div>
    <div class="card"><div class="value" style="color:#dc2626;">${summary.failed}</div><div class="label">실패</div></div>
    <div class="card"><div class="value">${formatDuration(summary.duration)}</div><div class="label">소요 시간</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>타입</th><th>셀렉터</th><th>상태</th><th style="text-align:right;">소요 시간</th></tr></thead>
    <tbody>${stepRows}</tbody>
  </table>
  <div class="footer">Like Cake - 실행 리포트</div>
</div>
</body>
</html>`;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadFile(html, `report-${timestamp}.html`, 'text/html');
  }, [buildReportData, downloadFile]);

  const canPlay = steps.length > 0 && playbackState.state !== 'playing' && !isRecording;
  const canSave = playbackState.state === 'completed' && !backendScenarioId;
  const canExport = playbackState.state === 'completed' || playbackState.state === 'error';

  return {
    steps,
    scenarioName,
    setScenarioName,
    isInspecting,
    isRecording,
    draft,
    playbackState,
    backendScenarioId,
    isSaving,
    canPlay,
    canSave,
    canExport,

    startRecording,
    stopRecording,
    startDraftFromCatalog,
    switchAction,
    cancelDraft,
    startInspect,
    selectSelector,
    manualSelector,
    updateParams,
    confirmStep,
    removeStep,
    duplicateStep,
    moveStep,
    insertStepAt,
    editStep,
    editingIndex,
    playScenario,
    saveToBackend,
    exportJsonReport,
    exportHtmlReport,
    reset,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

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
  const result = convertBoundVerificationToStep(
    boundVerification,
    needsElement ? [tempBinding] : []
  );
  return result.ok ? result.step : null;
}

const ASSERT_TYPES = new Set(['assertElement', 'assertApi', 'assertPage', 'assertStyle']);

/** Map step.type back to catalog ID for editing */
function stepTypeToCatalogId(step: Step): string {
  switch (step.type) {
    case 'click':
      return (step as { clickCount?: number }).clickCount &&
        (step as { clickCount?: number }).clickCount! >= 2
        ? 'doubleClick'
        : 'click';
    case 'type':
      return step.value === '' && step.clear ? 'clear' : 'type';
    case 'assertElement':
      return step.assertion.type === 'visible'
        ? 'visible'
        : step.assertion.type === 'hidden'
          ? 'hidden'
          : step.assertion.type === 'exists'
            ? 'exists'
            : step.assertion.type === 'notExists'
              ? 'notExists'
              : step.assertion.type === 'count'
                ? 'count'
                : step.assertion.type === 'text'
                  ? step.assertion.contains
                    ? 'textContains'
                    : step.assertion.value === ''
                      ? 'elementEmpty'
                      : 'textEquals'
                  : step.assertion.type === 'enabled'
                    ? 'inputEnabled'
                    : step.assertion.type === 'value'
                      ? 'inputValue'
                      : step.assertion.type === 'attribute'
                        ? 'attributeValue'
                        : 'visible';
    case 'assertPage':
      return step.assertion.type === 'url'
        ? 'currentUrl'
        : step.assertion.type === 'title'
          ? 'pageTitle'
          : 'documentExists';
    case 'assertStyle':
      return 'cssStyle';
    case 'assertApi':
      return step.waitFor ? 'apiCalled' : 'apiResponse';
    default:
      return step.type;
  }
}

/** Extract params from a Step for re-editing */
function extractParamsFromStep(step: Step): Record<string, unknown> {
  switch (step.type) {
    case 'type':
      return { value: step.value, clear: step.clear, delay: step.delay };
    case 'keypress':
      return { key: step.key, modifiers: step.modifiers?.[0] };
    case 'navigate':
      return { url: step.url, waitUntil: step.waitUntil };
    case 'wait':
      return { duration: step.duration };
    case 'select':
      return { value: Array.isArray(step.values) ? step.values[0] : step.values };
    case 'scroll':
      return { x: step.position?.x ?? 0, y: step.position?.y ?? 0 };
    case 'assertApi':
      return {
        url: step.match.url,
        method: step.match.method,
        ...(step.expect?.status !== undefined ? { status: step.expect.status } : {}),
      };
    case 'assertPage':
      return step.assertion.type === 'url'
        ? { url: step.assertion.value, matchType: step.assertion.matchType }
        : step.assertion.type === 'title'
          ? { title: step.assertion.value }
          : {};
    case 'assertStyle':
      return { property: step.property, value: step.value };
    case 'assertElement': {
      const a = step.assertion;
      if (a.type === 'text') return { value: a.value };
      if (a.type === 'count') return { value: a.value, operator: a.operator };
      if (a.type === 'attribute') return { name: a.name, value: a.value };
      if (a.type === 'value') return { value: a.value };
      return {};
    }
    default:
      return {};
  }
}
