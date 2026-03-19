import type { Message } from '../../shared/messages';
import {
  deleteBaseline,
  getBaselines,
  type ScenarioBaseline,
  saveBaseline,
} from '../../shared/storage';

// --- Message handlers ---

export function handleGetBaselines(
  _message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean | undefined {
  getBaselines().then((baselines) => sendResponse({ baselines }));
  return true; // Keep channel open for async
}

export function handleSaveBaseline(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean | undefined {
  const msg = message as { baseline: ScenarioBaseline };
  saveBaseline(msg.baseline).then(() => sendResponse({ success: true }));
  return true;
}

export function handleDeleteBaseline(
  message: Message,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
): boolean | undefined {
  const msg = message as { id: string };
  deleteBaseline(msg.id).then(() => sendResponse({ success: true }));
  return true;
}
