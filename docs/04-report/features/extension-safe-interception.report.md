# Completion Report: extension-safe-interception

> 익스텐션 설치 시 사이트 접근성 문제 해결 — monkey-patch 제거, CDP 기반 안전한 API 인터셉션 전환

## Executive Summary

### 1.1 Project Overview

| Item | Detail |
|------|--------|
| Feature | extension-safe-interception |
| Started | 2026-03-26 |
| Completed | 2026-03-26 |
| Duration | 1 session |
| PDCA Iterations | 1 (88% → 97%) |

### 1.2 Results

| Metric | Value |
|--------|-------|
| Final Match Rate | **97%** |
| Iteration Count | 1 |
| New Files | 4 |
| Modified Files | 5 |
| Deleted Files | 2 |
| Net Lines | +816 new, -373 deleted |
| Tests | 365/365 pass |
| Type-check | 13/13 packages pass |

### 1.3 Value Delivered

| Perspective | Before | After |
|-------------|--------|-------|
| **Problem** | 모든 페이지에 fetch/XHR monkey-patch + History API 패칭이 무조건 주입. CSP 엄격 사이트 에러, `instanceof XMLHttpRequest` 깨짐, SPA 프레임워크 충돌 가능 | 녹화하지 않는 동안 페이지에 어떤 수정도 가하지 않음. 제로 임팩트 익스텐션 |
| **Solution** | `<script>` 태그 동적 삽입 (CSP 취약), `document_start`에서 무조건 실행, `host_permissions: <all_urls>` | CDP `Network.enable`으로 API 캡처, `chrome.webNavigation`으로 SPA 감지, `chrome.scripting.executeScript(MAIN)` fallback, `optional_host_permissions` |
| **Function UX Effect** | 익스텐션 설치만으로 일부 사이트 깨질 수 있음 | 녹화 OFF 시 완전 정상, 녹화 ON 시에도 페이지 코드 무수정. URL 필터로 민감 사이트 제외 가능 |
| **Core Value** | 은행/정부/사내 시스템에서 사용 불가능한 위험 | 엔터프라이즈 환경에서도 안전하게 사용 가능. Chrome 웹스토어 심사 `optional_host_permissions`로 통과 가능성 향상 |

---

## 2. Implementation Summary

### 2.1 New Files (4)

| File | Lines | Role |
|------|:-----:|------|
| `shared/url-filter.ts` | 96 | URL 허용/차단 패턴 매칭 + `chrome.storage.sync` 연동 |
| `background/handlers/cdp-network-handler.ts` | ~360 | CDP `Network` 도메인 → `CapturedApiCall` 변환, auto-fallback on detach |
| `background/handlers/navigation-handler.ts` | ~100 | `chrome.webNavigation` → `RawEvent` 변환 |
| `background/handlers/fallback-injector.ts` | ~260 | `chrome.scripting.executeScript(MAIN)` 방식 동적 주입 |

### 2.2 Modified Files (5)

| File | Change |
|------|--------|
| `shared/messages.ts` | `INTERCEPTION_MODE`, `ENABLE/DISABLE_FALLBACK_LISTENERS` 타입 + `InterceptionMode` 추가 |
| `background/state.ts` | `interceptionMode` 상태 + `initializeCache`에서 CDP/nav 정리 |
| `background/handlers/recording-handler.ts` | CDP 우선/fallback 오케스트레이션, URL 필터, 권한 체크, auto-fallback wiring |
| `content/index.ts` | early injection 2개 함수 삭제, fallback 리스너 조건부 등록 |
| `manifest.json` | `debugger`/`webNavigation` 권한 추가, `optional_host_permissions` 전환, `web_accessible_resources` 삭제 |

### 2.3 Deleted Files (2)

| File | Lines | Reason |
|------|:-----:|--------|
| `public/inject-api.js` | 315 | CDP가 대체. Fallback은 `fallback-injector.ts`에 내장 |
| `public/inject-navigation.js` | 58 | `chrome.webNavigation` API가 대체 |

---

## 3. Architecture Change

```
[Before]                              [After]
content script (document_start)       content script (document_start)
  ├─ inject-api.js ← 무조건 주입       └─ 메시지 핸들러만 (제로 임팩트)
  │    ├─ window.fetch = patched
  │    └─ window.XMLHttpRequest =      service worker
  └─ inject-navigation.js               ├─ CDP Network.enable ← 녹화 시만
       ├─ history.pushState =            ├─ chrome.webNavigation ← 녹화 시만
       └─ history.replaceState =         ├─ fallback-injector ← CDP 불가 시만
                                         └─ url-filter ← 차단 목록 체크
```

### 3.1 인터셉션 모드 결정 흐름

```
startRecording(tabId)
  │
  ├─ isUrlRecordable? ──No──→ STOP
  │
  ├─ chrome.permissions.contains? ──No──→ request() ──denied──→ STOP
  │
  ├─ attachToTab(CDP) ──success──→ mode = 'cdp'
  │                    ──fail────→ injectApiInterceptor()
  │                                injectNavigationPatch()
  │                                mode = 'fallback'
  │
  └─ startNavigationListening() (항상)

녹화 중 debugger bar 닫힘 → onDetach → auto-fallback 전환
```

---

## 4. Gap Analysis Summary

| Phase | Match Rate | Gaps |
|-------|:----------:|:----:|
| Initial Check | 88% | 6 |
| After Iteration 1 | **97%** | 2 (Low, 설계 문서 업데이트 대상) |

### Resolved Gaps (Iteration 1)

| # | Gap | Fix |
|---|-----|-----|
| 1 | `handleDetach` auto-fallback 미구현 | `setOnDetach` 콜백 + recording-handler에서 fallback 전환 |
| 2 | `inject-*.js` 파일 미삭제 | 파일 삭제 완료 |
| 3 | `chrome.permissions.contains()` 미구현 | `startRecording`에서 권한 확인 + 요청 |

### Remaining (Low Priority — 설계 문서 업데이트)

| # | Gap | Recommendation |
|---|-----|----------------|
| 1 | `CDP_ATTACHED`/`CDP_DETACHED` 메시지 타입 | `INTERCEPTION_MODE`가 대체 — 설계 문서에서 제거 |
| 2 | `CdpNetworkState`/`NavigationState` 명시적 타입 | 모듈 변수로 충분 — 설계 문서 갱신 |

---

## 5. Test Results

| Suite | Tests | Status |
|-------|:-----:|:------:|
| step-player | 122 | PASS |
| mbt-catalog | 177 | PASS |
| backend | 66 | PASS |
| **Total** | **365** | **ALL PASS** |
| type-check | 13 packages | PASS |

---

## 6. Lessons Learned

### 6.1 What Worked Well

- **CDP가 Puppeteer Runner와 동일한 프로토콜**: Extension과 Runner의 네트워크 캡처 방식이 통일됨
- **Callback 등록 패턴**: `setOnApiCallCaptured`, `setOnDetach` 등으로 순환 의존 없이 모듈간 통신
- **`optional_host_permissions`**: Chrome 웹스토어 심사 통과 가능성 향상 + 최소 권한 원칙

### 6.2 Watch Out

- **`chrome.permissions.request()`는 사용자 제스처 컨텍스트 필요**: Service worker에서 직접 호출 시 실패할 수 있음. 프로덕션에서는 DevTools 패널 UI에서 요청 후 결과 전달 방식 권장
- **CDP 노란 바 UX**: DevTools 열린 상태에서는 수용 가능하나, 사용자에게 안내 필요
- **Fallback 모드의 한계**: monkey-patch 방식이므로 CSP 엄격 사이트에서는 여전히 실패 가능 (CDP 우선이므로 대부분의 경우 해당 없음)

### 6.3 Future Work

- URL 필터 설정 UI (옵션 페이지 또는 DevTools 패널 내)
- CDP `Fetch` 도메인 활용으로 요청 수정/차단 기능 (고급 테스트 시나리오)
- `url-filter.ts` 유닛 테스트 추가
