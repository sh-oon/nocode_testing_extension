# Plan: extension-safe-interception

> 익스텐션 설치 시 사이트 접근성 문제 해결 — monkey-patch 제거, CDP 기반 안전한 API 인터셉션으로 전환

## Executive Summary

| Perspective | Description |
|-------------|-------------|
| **Problem** | 모든 페이지에 `document_start` 시점에 fetch/XHR monkey-patch + History API 패칭이 무조건 주입되어, 엄격한 CSP 사이트에서 스크립트 차단 에러 발생 및 일부 사이트의 네트워크 요청 동작이 깨질 수 있음 |
| **Solution** | 녹화/재생 모드일 때만 CDP(`chrome.debugger`) 기반 네트워크 캡처를 사용하고, main world 스크립트 주입은 `chrome.scripting.executeScript({ world: "MAIN" })`로 전환하여 CSP-safe하게 변경. 비활성 시 페이지에 아무 영향 없음 |
| **Function UX Effect** | 녹화하지 않는 동안 모든 사이트가 완전히 정상 동작. 녹화 시에도 CDP 기반이므로 페이지 코드 무수정. URL 허용 목록으로 민감한 사이트 제외 가능 |
| **Core Value** | 익스텐션 설치만으로 사이트가 깨지는 근본 원인 제거, 엔터프라이즈 환경(은행/정부/사내 시스템)에서도 안전하게 사용 가능 |

| Item | Detail |
|------|--------|
| Feature | extension-safe-interception |
| Created | 2026-03-26 |
| Level | Dynamic |
| Status | Plan |

## 1. Background & Goal

### 1.1 현재 상태

현재 content script(`content/index.ts`)는 `document_start` + `<all_urls>`로 **모든 페이지에 무조건 주입**되며, 즉시 두 개의 main world 스크립트를 삽입합니다:

| # | Issue | File | Impact |
|---|-------|------|--------|
| 1 | fetch/XHR monkey-patch 무조건 주입 | `public/inject-api.js` (315줄) | **High** — `window.fetch`와 `XMLHttpRequest` 생성자를 교체. 녹화 OFF에서도 모든 요청에 오버헤드. `instanceof XMLHttpRequest` 깨짐 가능 |
| 2 | History API 패칭 무조건 주입 | `public/inject-navigation.js` (58줄) | **Medium** — `pushState`/`replaceState` 래핑. SPA 프레임워크와 충돌 가능 |
| 3 | `<script>` 태그 동적 삽입 방식 | `content/index.ts:84-86, 114-116` | **High** — CSP `script-src` 정책이 엄격한 사이트에서 차단됨 |
| 4 | `host_permissions: ["<all_urls>"]` | `manifest.json:7` | **Medium** — Chrome 웹스토어 심사 시 광범위 권한으로 리젝 가능성 |

### 1.2 Goal

> 녹화/재생하지 않는 동안에는 페이지에 **어떤 수정도 가하지 않는** 제로 임팩트 익스텐션으로 전환

### 1.3 Success Criteria

- [ ] 녹화 OFF 상태에서 content script가 main world에 스크립트를 주입하지 않음
- [ ] 녹화 ON 시 CDP `Network.enable`로 요청/응답 캡처 동작
- [ ] CDP 사용 불가 시 `chrome.scripting.executeScript({ world: "MAIN" })` fallback 동작
- [ ] SPA 네비게이션 감지가 CDP 또는 `chrome.webNavigation` API로 전환됨
- [ ] URL 허용/차단 목록 설정 UI 존재 (옵션 페이지 또는 팝업)
- [ ] 기존 테스트 365개 전부 통과
- [ ] type-check 통과

## 2. Scope

### 2.1 In Scope

| # | Item | Description |
|---|------|-------------|
| 1 | CDP 기반 네트워크 인터셉터 | `chrome.debugger` API로 Network.enable → 요청/응답 캡처 |
| 2 | content script 조건부 주입 | 녹화/재생 시에만 `chrome.scripting.executeScript` 호출 |
| 3 | SPA 네비게이션 감지 전환 | `chrome.webNavigation` API + CDP `Page.frameNavigated` 활용 |
| 4 | URL 필터링 | 녹화 대상 URL 패턴 설정 (허용/차단 목록) |
| 5 | manifest 권한 최적화 | `optional_host_permissions` + 런타임 권한 요청 |
| 6 | inject-api.js / inject-navigation.js 제거 | main world 스크립트 파일 삭제 |

### 2.2 Out of Scope

| Item | Reason |
|------|--------|
| Puppeteer Runner 변경 | Runner는 이미 CDP 기반으로 동작하므로 영향 없음 |
| assertApi 로직 변경 | 데이터 형식은 동일하게 유지, 수집 방식만 변경 |
| 옵션 페이지 풀 UI | 최소한의 URL 설정만, 고급 옵션은 후속 PDCA |

## 3. Approach

### 3.1 API 인터셉션: CDP 전환

```
현재: content script → <script> 태그 → main world에서 fetch/XHR 패칭
변경: service worker → chrome.debugger.attach → CDP Network 이벤트 수신
```

**CDP 흐름**:
1. 녹화 시작 → `chrome.debugger.attach({ tabId }, "1.3")`
2. `Network.enable` + `Network.requestWillBeSent` / `Network.responseReceived` 리스닝
3. Response body: `Network.getResponseBody({ requestId })` 로 캡처
4. 녹화 중지 → `chrome.debugger.detach({ tabId })`

**Fallback** (debugger 거부 시):
- `chrome.scripting.executeScript({ target: { tabId }, world: "MAIN", func: ... })`로 동적 주입
- 기존 monkey-patch 로직을 함수로 변환하여 필요 시에만 실행

### 3.2 SPA 네비게이션 감지: webNavigation API 전환

```
현재: inject-navigation.js → History.pushState/replaceState 패칭
변경: chrome.webNavigation.onHistoryStateUpdated + chrome.webNavigation.onCompleted
```

- `chrome.webNavigation.onHistoryStateUpdated` — pushState/replaceState 감지
- `chrome.webNavigation.onReferenceFragmentUpdated` — hash 변경 감지
- `chrome.webNavigation.onCompleted` — 일반 페이지 로드 감지

### 3.3 Manifest 권한 최적화

```json
// Before
"permissions": ["activeTab", "scripting", "storage", "tabs", "sidePanel"],
"host_permissions": ["<all_urls>"],

// After
"permissions": ["activeTab", "scripting", "storage", "tabs", "sidePanel", "webNavigation", "debugger"],
"optional_host_permissions": ["<all_urls>"],
```

- `host_permissions: ["<all_urls>"]` → `optional_host_permissions`로 이동
- 사용자가 녹화할 사이트에 대해 런타임에 `chrome.permissions.request()` 호출
- `debugger`, `webNavigation` 권한 추가

### 3.4 URL 필터링

- 기본 차단 목록: `chrome://*`, `chrome-extension://*`, `about:*`, `edge://*`
- 사용자 설정 차단 패턴: `chrome.storage.sync`에 저장
- 녹화 시작 전 URL 체크 → 차단 목록이면 경고 표시

## 4. Implementation Order

| Phase | Task | Files | Dependency |
|-------|------|-------|------------|
| **Phase 1** | CDP 네트워크 인터셉터 모듈 작성 | `background/handlers/cdp-network-handler.ts` (신규) | 없음 |
| **Phase 2** | webNavigation 기반 SPA 감지 | `background/handlers/navigation-handler.ts` (신규) | 없음 |
| **Phase 3** | recording-handler에서 CDP 연동 | `background/handlers/recording-handler.ts` | Phase 1 |
| **Phase 4** | content script에서 early injection 제거 | `content/index.ts` | Phase 1, 2 |
| **Phase 5** | Fallback 모듈 (chrome.scripting 방식) | `background/handlers/fallback-injector.ts` (신규) | Phase 4 |
| **Phase 6** | manifest 권한 재구성 + URL 필터 | `manifest.json`, `shared/url-filter.ts` (신규) | Phase 3 |
| **Phase 7** | inject-api.js, inject-navigation.js 제거 | `public/` 정리 | Phase 4, 5 |
| **Phase 8** | 통합 테스트 + 기존 테스트 통과 확인 | 전체 | Phase 7 |

## 5. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| CDP debugger 노란 바 UX | Medium | DevTools 열린 상태에서는 노란 바가 이미 존재. 재생 시에만 attach하고 즉시 detach |
| `Network.getResponseBody` 타이밍 | Medium | `Network.loadingFinished` 이벤트 후 body 요청. 실패 시 body=null로 graceful 처리 |
| optional_host_permissions 전환 시 기존 사용자 | Low | MV3에서 이전에 granted된 권한은 유지됨. 신규 설치만 영향 |
| Fallback monkey-patch 유지 보수 | Low | Fallback은 기존 코드 재사용, CDP 우선 전략으로 점진적 폐기 |

## 6. Reference

- [Chrome Debugger API](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- [Chrome WebNavigation API](https://developer.chrome.com/docs/extensions/reference/api/webNavigation)
- [chrome.scripting.executeScript](https://developer.chrome.com/docs/extensions/reference/api/scripting#method-executeScript)
- [Chrome DevTools Protocol - Network Domain](https://chromedevtools.github.io/devtools-protocol/tot/Network/)
- 관련 코드: `content/index.ts`, `public/inject-api.js`, `public/inject-navigation.js`, `background/handlers/recording-handler.ts`
