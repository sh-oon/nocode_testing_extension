import type { Message } from '../../shared/messages';
import {
  activeTabId,
  ensureContentScriptInjected,
  notifyPanels,
} from '../state';

// --- Message handlers ---

export function handleStartElementInspect(
  _message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
  tabId?: number,
): boolean | void {
  const inspectTabId = tabId ?? sender.tab?.id ?? activeTabId;
  const sendInspect = async (targetTabId: number) => {
    await ensureContentScriptInjected(targetTabId);
    chrome.tabs.sendMessage(targetTabId, { type: 'START_ELEMENT_INSPECT' })
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: String(error) }));
  };

  if (inspectTabId) {
    sendInspect(inspectTabId);
  } else {
    // Fallback: query active tab
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        sendInspect(tab.id);
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
  }
  return true;
}

export function handleStopElementInspect(
  _message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
  tabId?: number,
): boolean | void {
  const stopInspectTabId = tabId ?? sender.tab?.id ?? activeTabId;
  if (stopInspectTabId) {
    chrome.tabs.sendMessage(stopInspectTabId, { type: 'STOP_ELEMENT_INSPECT' }).catch(() => {});
  }
  sendResponse({ success: true });
}

export function handleElementInspected(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): boolean | void {
  notifyPanels(message);
  sendResponse({ success: true });
}
