import type { TrackedMutation } from '@like-cake/event-collector';
import {
  generateApiAssertions,
  getRelevantApiCalls,
  DEFAULT_EXCLUDE_PATTERNS,
} from '@like-cake/event-collector';
import type { DomMutationsStableMessage, IdleDetectedMessage, Message } from '../../shared/messages';
import { saveCurrentSession } from '../../shared/storage';
import {
  notifyPanels,
  pendingDomMutations,
  sessionCache,
  setPendingDomMutations,
} from '../state';

/**
 * Handle DOM mutations stable message from content script.
 * Buffers mutations until idle is detected.
 */
function handleDomMutationsStable(mutations: TrackedMutation[]): void {
  if (!sessionCache?.isRecording) return;

  // Replace (not append) -- each stable event represents the latest state
  setPendingDomMutations(mutations);
  console.log(`[Like Cake] Buffered ${mutations.length} DOM mutations`);
}

/**
 * Handle idle detected message from content script.
 * This is the main orchestrator: inserts wait -> assertApi -> assertElement steps.
 */
function handleIdleDetected(
  idleStartedAt: number,
  idleDuration: number,
  _lastEventType: string,
): void {
  if (!sessionCache?.isRecording) return;

  const autoSteps: import('@like-cake/ast-types').Step[] = [];
  const idleDetectedAt = idleStartedAt + idleDuration;

  // 1. Insert a domStable wait step
  autoSteps.push({
    type: 'wait',
    strategy: 'domStable',
    stabilityThreshold: 1500,
    description: 'Wait for DOM to stabilize after user action',
  });

  // 2. Generate assertApi steps from API calls during the idle window
  const apiCalls = sessionCache.apiCalls ?? [];
  if (apiCalls.length > 0) {
    const relevantCalls = getRelevantApiCalls(apiCalls, {
      lastEventTimestamp: idleStartedAt,
      idleDetectedAt,
    }, {
      excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
    });
    const apiAssertions = generateApiAssertions(relevantCalls, {
      maxAssertions: 2,
    });
    autoSteps.push(...apiAssertions);
  }

  // 3. Generate assertElement steps from buffered DOM mutations
  for (const mutation of pendingDomMutations) {
    const selectorInput: import('@like-cake/ast-types').SelectorInput = {
      strategy: 'css' as const,
      value: mutation.selector,
    };

    if (mutation.type === 'added' && mutation.textContent) {
      autoSteps.push({
        type: 'assertElement',
        selector: selectorInput,
        assertion: { type: 'text', value: mutation.textContent, contains: true },
        description: `Verify element "${mutation.selector}" contains "${mutation.textContent.slice(0, 40)}"`,
      });
    } else if (mutation.type === 'added') {
      autoSteps.push({
        type: 'assertElement',
        selector: selectorInput,
        assertion: { type: 'visible' },
        description: `Verify element "${mutation.selector}" is visible`,
      });
    } else if (mutation.type === 'textChanged' && mutation.textContent) {
      autoSteps.push({
        type: 'assertElement',
        selector: selectorInput,
        assertion: { type: 'text', value: mutation.textContent, contains: true },
        description: `Verify text changed to "${mutation.textContent.slice(0, 40)}"`,
      });
    }
  }

  // Clear the pending buffer
  setPendingDomMutations([]);

  if (autoSteps.length <= 1) {
    // Only the wait step -- nothing meaningful to assert
    console.log('[Like Cake] Idle detected but no meaningful assertions to add');
    return;
  }

  // Append auto-generated steps to session
  sessionCache.steps.push(...autoSteps);

  // Save to storage
  saveCurrentSession(sessionCache);

  // Notify panels of new steps
  notifyPanels({
    type: 'EVENTS_DATA',
    events: sessionCache.events,
    steps: sessionCache.steps,
  });

  console.log(`[Like Cake] Auto-inserted ${autoSteps.length} assertion steps`);
}

// --- Message handlers ---

export function handleIdleDetectedMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  const idleMsg = message as IdleDetectedMessage;
  handleIdleDetected(idleMsg.idleStartedAt, idleMsg.idleDuration, idleMsg.lastEventType);
  sendResponse({ success: true });
}

export function handleDomMutationsStableMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  const domMsg = message as DomMutationsStableMessage;
  handleDomMutationsStable(domMsg.mutations);
  sendResponse({ success: true });
}
