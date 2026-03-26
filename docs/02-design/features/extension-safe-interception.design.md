# Design: extension-safe-interception

> CDP 기반 안전한 API 인터셉션 + 조건부 스크립트 주입 + URL 필터링 상세 설계

## Executive Summary

| Perspective | Description |
|-------------|-------------|
| **Problem** | `inject-api.js`의 fetch/XHR monkey-patch와 `inject-navigation.js`의 History 패칭이 모든 페이지에 `document_start`로 무조건 주입되어 CSP 위반, `instanceof` 깨짐, SPA 충돌 발생 |
| **Solution** | Service Worker에서 CDP Network 도메인으로 API 캡처, `chrome.webNavigation`으로 SPA 감지, 녹화 시에만 content script 동적 주입 |
| **Function UX Effect** | 녹화 OFF 시 제로 임팩트, 녹화 ON 시에도 페이지 코드 무수정으로 캡처 |
| **Core Value** | 모든 사이트에서 안전하게 동작하는 익스텐션, Chrome 웹스토어 심사 통과 가능 |

| Item | Detail |
|------|--------|
| Feature | extension-safe-interception |
| Plan | [extension-safe-interception.plan.md](../../01-plan/features/extension-safe-interception.plan.md) |
| Created | 2026-03-26 |
| Status | Design |

---

## 1. Architecture Overview

### 1.1 Before / After 비교

```
[BEFORE] — 항상 주입, 선택적 활성화
─────────────────────────────────────────────
manifest.json
  content_scripts: <all_urls>, document_start
    ↓ (모든 페이지)
  content/index.ts
    ├─ injectNavigationPatchEarly()  ← <script> 태그 삽입
    │    └─ inject-navigation.js (main world)
    └─ injectApiInterceptorEarly()   ← <script> 태그 삽입
         └─ inject-api.js (main world)
              ├─ window.fetch = patched
              └─ window.XMLHttpRequest = patched

[AFTER] — 선택적 주입, 필요 시에만 활성화
─────────────────────────────────────────────
manifest.json
  content_scripts: <all_urls>, document_start
    ↓ (모든 페이지)
  content/index.ts               ← 메시지 핸들러만 (main world 주입 없음)

  background/service-worker.ts
    ├─ 녹화 시작 →
    │    ├─ cdp-network-handler.ts  ← chrome.debugger.attach → Network.enable
    │    └─ navigation-handler.ts   ← chrome.webNavigation 리스너 등록
    ├─ 녹화 중지 →
    │    ├─ chrome.debugger.detach
    │    └─ webNavigation 리스너 해제
    └─ CDP 불가 시 →
         └─ fallback-injector.ts   ← chrome.scripting.executeScript(MAIN)
```

### 1.2 데이터 흐름

```
[CDP Mode — Primary]
  chrome.debugger.attach(tabId)
    → Network.requestWillBeSent  ─┐
    → Network.responseReceived   ─┤→ cdpEventToCapturedApiCall() → sessionCache.apiCalls
    → Network.loadingFinished    ─┘   (CapturedApiCall 형식으로 변환)

[WebNavigation Mode]
  chrome.webNavigation.onHistoryStateUpdated ─┐
  chrome.webNavigation.onReferenceFragmentUpdated ─┤→ webNavEventToRawEvent() → sessionCache.events
  chrome.webNavigation.onCompleted            ─┘   (RawEvent navigation 형식으로 변환)

[Fallback Mode — CDP 불가 시]
  chrome.scripting.executeScript({ world: "MAIN" })
    → inject-api 로직 실행 (녹화 시에만)
    → content script CustomEvent 경유 → sessionCache.apiCalls
```

---

## 2. Module Design

### 2.1 `cdp-network-handler.ts` (신규)

**위치**: `apps/extension/src/background/handlers/cdp-network-handler.ts`

**책임**: CDP `Network` 도메인을 통한 API 요청/응답 캡처

```typescript
// === Types ===

interface CdpNetworkState {
  readonly tabId: number;
  readonly isAttached: boolean;
  /** requestId → 부분적으로 수집된 요청 정보 */
  readonly pendingRequests: Map<string, PendingCdpRequest>;
}

interface PendingCdpRequest {
  requestId: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  timestamp: number;
}

// === Public API ===

/** CDP 디버거를 탭에 연결하고 Network 이벤트 수신 시작 */
const attachToTab: (tabId: number) => Promise<CdpAttachResult>

/** CDP 디버거를 분리하고 모든 pending 요청 정리 */
const detachFromTab: (tabId: number) => Promise<void>

/** CDP가 현재 탭에 연결되어 있는지 확인 */
const isAttached: (tabId: number) => boolean

/** 모든 CDP 연결 정리 (service worker 재시작 시) */
const detachAll: () => Promise<void>
```

**CDP 이벤트 → `CapturedApiCall` 매핑**:

| CDP Event | 역할 | 매핑 대상 |
|-----------|------|-----------|
| `Network.requestWillBeSent` | 요청 시작 | `CapturedRequest.{id, url, method, headers, body, timestamp}` |
| `Network.responseReceived` | 응답 헤더 수신 | `CapturedResponse.{status, statusText, headers}` |
| `Network.loadingFinished` | 응답 완료 | `getResponseBody` 호출 → `CapturedResponse.{body, responseTime, bodySize}` |
| `Network.loadingFailed` | 요청 실패 | `CapturedApiCall.error` |

**변환 함수**:

```typescript
/**
 * CDP Network 이벤트를 CapturedApiCall로 변환.
 * requestWillBeSent 시점에 pending으로 생성,
 * loadingFinished 시점에 response 채워서 완성.
 */
const cdpEventToCapturedApiCall: (
  pendingRequest: PendingCdpRequest,
  responseParams: Chrome.Debugger.Network.ResponseReceived,
  body: string | null
) => CapturedApiCall
```

**`CapturedRequest.initiator` 매핑**:
- CDP `Network.requestWillBeSent`의 `initiator.type`이 `"fetch"` → `initiator: 'fetch'`
- CDP `initiator.type`이 `"xmlhttprequest"` → `initiator: 'xhr'`
- 기타 → `initiator: 'fetch'` (기본값, CDP는 navigation/script 등도 감지하므로)

**URL 필터링**:
- `Network.requestWillBeSent`에서 `request.url`을 체크
- `shouldIgnoreUrl(url)` 함수로 analytics/tracking/extension URL 필터링
- `api-interceptor`의 기존 `DEFAULT_CONFIG.ignorePatterns`과 동일 패턴 재사용

**에러 처리**:

| 시나리오 | 처리 |
|---------|------|
| `chrome.debugger.attach` 실패 | `{ success: false, reason: 'DEBUGGER_ATTACH_FAILED' }` 반환 → fallback 트리거 |
| 사용자가 디버거 바 닫음 | `chrome.debugger.onDetach` 리스닝 → 녹화 중이면 fallback 전환 |
| `getResponseBody` 실패 | `response.body = null`, 나머지 필드는 정상 채움 |
| Service Worker 재시작 | `detachAll()` 호출하여 stale 연결 정리 |

### 2.2 `navigation-handler.ts` (신규)

**위치**: `apps/extension/src/background/handlers/navigation-handler.ts`

**책임**: `chrome.webNavigation` API로 SPA/일반 네비게이션 감지

```typescript
// === Types ===

type NavigationType = 'push' | 'replace' | 'pop' | 'load' | 'hash';

interface NavigationState {
  readonly isListening: boolean;
  readonly tabId: number | null;
}

// === Public API ===

/** 특정 탭의 네비게이션 이벤트 리스닝 시작 */
const startListening: (tabId: number) => void

/** 네비게이션 리스닝 중지 */
const stopListening: () => void
```

**`chrome.webNavigation` → `RawEvent` 매핑**:

| webNavigation Event | 조건 | `RawEvent.navigationType` |
|---------------------|------|---------------------------|
| `onHistoryStateUpdated` | `details.transitionType === 'link'` | `'push'` |
| `onHistoryStateUpdated` | 기타 | `'push'` (기본) |
| `onReferenceFragmentUpdated` | — | `'hash'` |
| `onCompleted` | `details.frameId === 0` (메인 프레임만) | `'load'` |

**변환 함수**:

```typescript
/**
 * webNavigation 이벤트를 기존 RawEvent navigation 형식으로 변환.
 * recording.ts의 sendNavigationEvent()과 동일한 형식을 생성.
 */
const webNavEventToRawEvent: (
  url: string,
  navigationType: NavigationType,
  timestamp: number
) => RawEvent
```

**필터링**:
- `details.tabId !== targetTabId` → 무시 (녹화 중인 탭만 감지)
- `details.frameId !== 0` → 무시 (메인 프레임만, iframe 제외)
- `url.startsWith('chrome')` → 무시

### 2.3 `fallback-injector.ts` (신규)

**위치**: `apps/extension/src/background/handlers/fallback-injector.ts`

**책임**: CDP 불가 시 `chrome.scripting.executeScript`로 main world 코드 동적 주입

```typescript
// === Public API ===

/** API 인터셉터를 main world에 동적 주입 (녹화 시에만) */
const injectApiInterceptor: (tabId: number) => Promise<boolean>

/** History 패칭을 main world에 동적 주입 (녹화 시에만) */
const injectNavigationPatch: (tabId: number) => Promise<boolean>

/** 주입된 인터셉터 정리 (녹화 중지 시) */
const cleanupInjectedScripts: (tabId: number) => Promise<void>
```

**구현 방식**:

```typescript
// chrome.scripting.executeScript는 CSP를 우회함 (MV3 특권)
const injectApiInterceptor = async (tabId: number): Promise<boolean> => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: apiInterceptorFunction,  // inject-api.js 로직을 함수로 변환
    });
    return true;
  } catch (error) {
    console.error('[Like Cake] Fallback injection failed:', error);
    return false;
  }
};
```

**`inject-api.js` → 함수 변환**:
- 기존 IIFE 내용을 `function apiInterceptorFunction()` 으로 래핑
- `shouldIgnore` 패턴, `serializeHeaders`, `parseBody` 등 모든 유틸 포함
- 녹화 중지 시 `cleanupInjectedScripts`에서 원본 함수 복원 이벤트 전송

### 2.4 `url-filter.ts` (신규)

**위치**: `apps/extension/src/shared/url-filter.ts`

**책임**: URL 허용/차단 목록 관리

```typescript
// === Types ===

interface UrlFilterConfig {
  /** 사용자 정의 차단 패턴 (glob-like) */
  readonly blockedPatterns: readonly string[];
  /** 사용자 정의 허용 패턴 (비어있으면 전체 허용) */
  readonly allowedPatterns: readonly string[];
}

// === Constants ===

/** 항상 차단되는 시스템 URL 패턴 */
const SYSTEM_BLOCKED_PATTERNS: readonly string[] = [
  'chrome://*',
  'chrome-extension://*',
  'about:*',
  'edge://*',
  'devtools://*',
  'chrome-search://*',
];

// === Public API ===

/** URL이 녹화 가능한지 확인 */
const isUrlRecordable: (url: string, config?: UrlFilterConfig) => boolean

/** URL 필터 설정 로드 (chrome.storage.sync) */
const loadUrlFilterConfig: () => Promise<UrlFilterConfig>

/** URL 필터 설정 저장 */
const saveUrlFilterConfig: (config: UrlFilterConfig) => Promise<void>

/** glob-like 패턴을 RegExp로 변환 */
const patternToRegExp: (pattern: string) => RegExp
```

**패턴 문법**: Chrome의 match patterns 형식 사용
- `*://*.bank.com/*` → 은행 사이트 전체 차단
- `https://internal.company.com/*` → 사내 시스템 차단

### 2.5 `recording-handler.ts` 변경

**기존 파일 수정**: `apps/extension/src/background/handlers/recording-handler.ts`

**변경 사항**:

```typescript
// === startRecording 수정 ===

async function startRecording(tabId: number, config?: Record<string, boolean>): Promise<void> {
  // 1. URL 체크 (기존 하드코딩 → url-filter 사용)
  const urlConfig = await loadUrlFilterConfig();
  if (!isUrlRecordable(tab.url, urlConfig)) {
    notifyPanels({ type: 'RECORDING_STOPPED', eventCount: 0 });
    return;
  }

  // 2. CDP 연결 시도 (Primary)
  const cdpResult = await attachToTab(tabId);
  if (cdpResult.success) {
    // CDP로 API 캡처 → inject-api.js 불필요
    console.log('[Like Cake] CDP attached, using Network domain for API capture');
  } else {
    // 3. Fallback: chrome.scripting으로 동적 주입
    console.log('[Like Cake] CDP unavailable, using fallback injection');
    await injectApiInterceptor(tabId);
    await injectNavigationPatch(tabId);
  }

  // 4. webNavigation 리스닝 시작 (CDP 여부 무관)
  startNavigationListening(tabId);

  // 5. Content script 주입 확인 (이벤트 수집용, main world 주입은 하지 않음)
  const injected = await ensureContentScriptInjected(tabId);
  // ... 나머지 기존 로직
}

// === stopRecording 수정 ===

async function stopRecording(): Promise<void> {
  // CDP 연결 해제
  if (activeTabId && isAttached(activeTabId)) {
    await detachFromTab(activeTabId);
  }

  // webNavigation 리스닝 중지
  stopNavigationListening();

  // Fallback 정리
  if (activeTabId) {
    await cleanupInjectedScripts(activeTabId);
  }

  // ... 기존 중지 로직
}
```

**새로운 API 콜 수신 경로**:

```
[CDP Mode]
  cdp-network-handler → handleApiCallCaptured() (직접 호출)

[Fallback Mode]
  inject-api 함수 → CustomEvent → content script → messaging.ts → service worker
  (기존 경로와 동일)
```

### 2.6 `content/index.ts` 변경

**핵심 변경: early injection 함수 2개 제거**

```typescript
// === 삭제 대상 ===
// injectNavigationPatchEarly()    ← 함수 전체 삭제
// injectApiInterceptorEarly()     ← 함수 전체 삭제
// 파일 최상단의 호출부 2줄 삭제:
//   injectNavigationPatchEarly();
//   injectApiInterceptorEarly();

// === 삭제 대상 (main world 이벤트 리스너) ===
// window.addEventListener('__like_cake_navigation__', ...)  ← 삭제
// window.addEventListener('__like_cake_api_call__', ...)    ← 삭제
// (Fallback 모드에서만 필요하므로, fallback 시 동적으로 등록)

// === 유지 ===
// chrome.runtime.onMessage.addListener(handleMessage)  ← 유지
// handleMessage의 모든 case                            ← 유지
// PING/PONG, START_RECORDING, STOP_RECORDING 등       ← 유지
```

**변경 후 content/index.ts 구조**:

```typescript
// Content Script - ISOLATED world
// 메시지 핸들러만 유지. Main world 주입 없음.

import { ... } from './playback';
import { ... } from './recording';
import { ... } from './inspection';
import { ... } from './snapshot';
import { ... } from './messaging';

// Fallback 모드 이벤트 리스너 (service worker에서 ENABLE_FALLBACK 메시지 수신 시 등록)
let fallbackListenersActive = false;

function enableFallbackListeners(): void { ... }
function disableFallbackListeners(): void { ... }

function handleMessage(message, _sender, sendResponse): boolean {
  switch (message.type) {
    case 'ENABLE_FALLBACK_LISTENERS':
      enableFallbackListeners();
      sendResponse({ success: true });
      break;
    case 'DISABLE_FALLBACK_LISTENERS':
      disableFallbackListeners();
      sendResponse({ success: true });
      break;
    // ... 기존 모든 case 유지
  }
  return true;
}

chrome.runtime.onMessage.addListener(handleMessage);
```

### 2.7 `manifest.json` 변경

```jsonc
{
  "manifest_version": 3,
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "tabs",
    "sidePanel",
    "webNavigation",   // 추가: SPA 네비게이션 감지
    "debugger"         // 추가: CDP Network 캡처
  ],
  // host_permissions → optional_host_permissions로 이동
  "optional_host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"],
      "run_at": "document_start",
      "world": "ISOLATED"
    }
  ],
  // web_accessible_resources 제거 (inject-*.js 파일 삭제)
  // "web_accessible_resources": [...] ← 삭제
}
```

**주의**: `content_scripts`의 `<all_urls>`는 유지합니다. 이것은 `host_permissions`와 별개이며, ISOLATED world content script는 페이지에 영향을 주지 않으므로 안전합니다. 녹화 시작 시 `chrome.permissions.contains()`로 해당 호스트에 대한 권한이 있는지 확인하고, 없으면 `chrome.permissions.request()`로 요청합니다.

### 2.8 `messages.ts` 변경

```typescript
// === 추가할 MessageType ===
| 'ENABLE_FALLBACK_LISTENERS'
| 'DISABLE_FALLBACK_LISTENERS'
| 'CDP_ATTACHED'          // panel에 CDP 모드 알림
| 'CDP_DETACHED'          // panel에 CDP 분리 알림
| 'INTERCEPTION_MODE'     // 현재 인터셉션 모드 알림 ('cdp' | 'fallback' | 'none')

// === 추가할 인터페이스 ===
export interface InterceptionModeMessage extends BaseMessage {
  type: 'INTERCEPTION_MODE';
  mode: 'cdp' | 'fallback' | 'none';
}
```

---

## 3. 파일 삭제 목록

| File | Reason |
|------|--------|
| `apps/extension/public/inject-api.js` | CDP가 대체. Fallback 로직은 `fallback-injector.ts`에 함수로 내장 |
| `apps/extension/public/inject-navigation.js` | `chrome.webNavigation`이 대체 |

---

## 4. 의존성 관계

```
recording-handler.ts (수정)
  ├─ imports cdp-network-handler.ts (신규)
  ├─ imports navigation-handler.ts (신규)
  ├─ imports fallback-injector.ts (신규)
  └─ imports url-filter.ts (신규)

content/index.ts (수정)
  └─ early injection 제거, fallback 리스너 조건부 등록

manifest.json (수정)
  └─ permissions 추가, optional_host_permissions 전환

messages.ts (수정)
  └─ 새 메시지 타입 추가

state.ts (수정)
  └─ interceptionMode: 'cdp' | 'fallback' | 'none' 상태 추가
```

---

## 5. Implementation Order (Design 기준)

| # | Task | New/Modify | Files | Test Strategy |
|---|------|------------|-------|---------------|
| 1 | URL 필터 모듈 | New | `shared/url-filter.ts` | 유닛: 패턴 매칭 테스트 |
| 2 | CDP 네트워크 핸들러 | New | `background/handlers/cdp-network-handler.ts` | 수동: DevTools 열고 네트워크 요청 캡처 확인 |
| 3 | Navigation 핸들러 | New | `background/handlers/navigation-handler.ts` | 수동: SPA 사이트에서 네비게이션 감지 확인 |
| 4 | Fallback 인젝터 | New | `background/handlers/fallback-injector.ts` | 수동: debugger 거부 후 fallback 동작 확인 |
| 5 | messages.ts 확장 | Modify | `shared/messages.ts` | type-check |
| 6 | state.ts 확장 | Modify | `background/state.ts` | type-check |
| 7 | recording-handler CDP 연동 | Modify | `background/handlers/recording-handler.ts` | 수동: 녹화 시작/중지 전체 플로우 |
| 8 | content/index.ts early injection 제거 | Modify | `content/index.ts` | 수동: 페이지 로드 시 console 로그 확인 |
| 9 | manifest.json 권한 변경 | Modify | `manifest.json` | 수동: 익스텐션 재로드 후 권한 확인 |
| 10 | inject-*.js 파일 삭제 | Delete | `public/inject-api.js`, `public/inject-navigation.js` | 빌드 성공 + type-check |
| 11 | 기존 테스트 통과 확인 | — | 전체 | `yarn test` (365개) + `yarn type-check` |

---

## 6. Edge Cases & Error Handling

| Case | Detection | Handling |
|------|-----------|---------|
| DevTools 미오픈 상태에서 녹화 | content script PING 실패 | `ensureContentScriptInjected` 기존 로직 유지 |
| CDP attach 후 사용자가 노란 바 닫음 | `chrome.debugger.onDetach` 이벤트 | fallback 모드로 자동 전환, panel에 `INTERCEPTION_MODE: 'fallback'` 전송 |
| Service Worker 비활성화 후 재활성화 | `initializeCache()`에서 stale 상태 감지 | `detachAll()` 호출, `interceptionMode = 'none'` 리셋 |
| `optional_host_permissions` 미승인 사이트 | `chrome.permissions.contains()` 체크 | 권한 요청 다이얼로그 표시, 거부 시 녹화 불가 안내 |
| 동시에 여러 탭 녹화 시도 | `activeTabId` 이미 설정됨 | 기존 탭 녹화 중지 후 새 탭 녹화 시작 (기존 동작 유지) |
| iframe 내부 API 요청 | CDP는 자동으로 iframe 요청도 캡처 | `frameId` 필드 포함하여 메인 프레임과 구분 |

---

## 7. 호환성 매트릭스

| 브라우저 | `chrome.debugger` | `chrome.webNavigation` | `chrome.scripting` (MAIN) | 지원 |
|---------|:-:|:-:|:-:|:-:|
| Chrome 120+ | O | O | O | Full |
| Chrome 102-119 | O | O | O | Full |
| Edge 120+ | O | O | O | Full |
| Firefox (MV3) | X | O | X | Fallback only |
| Safari (MV3) | X | O | Partial | 미지원 |

**최소 요구 버전**: Chrome 102+ (MV3 `chrome.scripting.executeScript` world 파라미터 지원)
