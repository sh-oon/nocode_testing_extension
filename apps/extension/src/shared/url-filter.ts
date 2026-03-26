/**
 * URL filter module for controlling which sites can be recorded.
 * Manages system-level blocked patterns and user-configurable allow/block lists.
 */

// === Types ===

export interface UrlFilterConfig {
  readonly blockedPatterns: readonly string[];
  readonly allowedPatterns: readonly string[];
}

// === Constants ===

/** System URLs that are always blocked (Chrome internals, extension pages, etc.) */
const SYSTEM_BLOCKED_PATTERNS: readonly string[] = [
  'chrome://*',
  'chrome-extension://*',
  'about:*',
  'edge://*',
  'devtools://*',
  'chrome-search://*',
  'chrome-untrusted://*',
];

const STORAGE_KEY = 'urlFilterConfig';

const DEFAULT_CONFIG: UrlFilterConfig = {
  blockedPatterns: [],
  allowedPatterns: [],
};

// === Pattern Matching ===

/**
 * Convert a Chrome match-pattern-like glob to a RegExp.
 * Supports: `*` (any chars), `?` (single char).
 * Example: `*://*.bank.com/*` → matches any bank.com URL.
 */
export const patternToRegExp = (pattern: string): RegExp => {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
};

/**
 * Check if a URL matches any pattern in the list.
 */
const matchesAny = (url: string, patterns: readonly string[]): boolean =>
  patterns.some((pattern) => patternToRegExp(pattern).test(url));

// === Public API ===

/**
 * Determine if a URL is recordable based on system and user filter rules.
 *
 * Priority:
 * 1. System blocked patterns → always blocked
 * 2. User blocked patterns → blocked
 * 3. User allowed patterns (if non-empty) → only allowed URLs pass
 * 4. If no allowed patterns → all non-blocked URLs are allowed
 */
export const isUrlRecordable = (
  url: string,
  config: UrlFilterConfig = DEFAULT_CONFIG,
): boolean => {
  // System blocked — always reject
  if (matchesAny(url, SYSTEM_BLOCKED_PATTERNS)) {
    return false;
  }

  // User blocked patterns
  if (config.blockedPatterns.length > 0 && matchesAny(url, config.blockedPatterns)) {
    return false;
  }

  // User allowed patterns (whitelist mode)
  if (config.allowedPatterns.length > 0) {
    return matchesAny(url, config.allowedPatterns);
  }

  // No restrictions — allow
  return true;
};

/**
 * Load URL filter config from chrome.storage.sync.
 */
export const loadUrlFilterConfig = async (): Promise<UrlFilterConfig> => {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    if (stored && typeof stored === 'object') {
      return {
        blockedPatterns: Array.isArray(stored.blockedPatterns) ? stored.blockedPatterns : [],
        allowedPatterns: Array.isArray(stored.allowedPatterns) ? stored.allowedPatterns : [],
      };
    }
  } catch {
    // Storage unavailable — use defaults
  }
  return DEFAULT_CONFIG;
};

/**
 * Save URL filter config to chrome.storage.sync.
 */
export const saveUrlFilterConfig = async (config: UrlFilterConfig): Promise<void> => {
  await chrome.storage.sync.set({ [STORAGE_KEY]: config });
};
