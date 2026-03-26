# Gap Analysis: extension-safe-interception

> Design 문서 대비 구현 코드 Gap 분석 결과

## Overview

| Item | Detail |
|------|--------|
| Feature | extension-safe-interception |
| Design | [extension-safe-interception.design.md](../02-design/features/extension-safe-interception.design.md) |
| Analyzed | 2026-03-26 |
| **Match Rate** | **88%** |

## Module Scores

| Module | Weight | Score | Weighted |
|--------|:------:|:-----:|:--------:|
| url-filter.ts | 10% | 100% | 10.0% |
| cdp-network-handler.ts | 25% | 82% | 20.5% |
| navigation-handler.ts | 10% | 90% | 9.0% |
| fallback-injector.ts | 15% | 100% | 15.0% |
| messages.ts | 5% | 78% | 3.9% |
| state.ts | 5% | 100% | 5.0% |
| recording-handler.ts | 15% | 100% | 15.0% |
| content/index.ts | 5% | 100% | 5.0% |
| manifest.json | 5% | 100% | 5.0% |
| File deletions | 5% | 0% | 0.0% |
| **Total** | **100%** | | **88.4%** |

## Gaps Found

### High Priority (90% 도달 필수)

| # | Gap | Design Section | Impact | Fix |
|---|-----|----------------|--------|-----|
| 1 | 디버거 바 닫기 시 자동 fallback 미구현 | Section 6, row 2 | **High** | `cdp-network-handler.ts`의 `handleDetach`에서 fallback 전환 + 패널 알림 |
| 2 | `inject-api.js`, `inject-navigation.js` 미삭제 | Section 3 | **Medium** | `public/` 디렉토리에서 삭제 |
| 3 | `chrome.permissions.contains()` 권한 확인 미구현 | Section 2.7, 6 row 4 | **Medium** | `recording-handler.ts` 녹화 시작 전 체크 |

### Low Priority (설계 문서 업데이트로 해결)

| # | Gap | Description |
|---|-----|-------------|
| 4 | `CDP_ATTACHED`/`CDP_DETACHED` 메시지 타입 미구현 | `INTERCEPTION_MODE` 메시지가 대체 역할 — 설계 문서 갱신 권장 |
| 5 | `CdpNetworkState`/`NavigationState` 명시적 타입 없음 | 모듈 레벨 변수로 관리 — 기능적 차이 없음 |
| 6 | `cdpEventToCapturedApiCall()` 단일 함수 대신 helper 분리 | `buildCapturedRequest` + `buildCapturedResponse`로 분해 — 더 나은 구조 |

## Implementation Improvements (Design에 없는 추가 구현)

| # | Item | Value |
|---|------|-------|
| 1 | `IGNORED_RESOURCE_TYPES` 필터 | Document/Image/Font 등 비API 리소스 스킵 |
| 2 | `setOnApiCallCaptured`/`setOnNavigationEvent` 콜백 등록 | 모듈간 느슨한 결합 유지 |
| 3 | Response body content-type 기반 파싱 | JSON/text 자동 분류 |
| 4 | `chrome-untrusted://*` 시스템 차단 패턴 | 추가 보안 강화 |

## Verification Results

| Check | Result |
|-------|--------|
| type-check (13 packages) | PASS |
| step-player tests (122) | PASS |
| mbt-catalog tests (177) | PASS |
| backend tests (66) | PASS |
| **Total: 365 tests** | **ALL PASS** |

## Recommendation

**Match Rate 88% → 3개 High Priority Gap 수정으로 93%+ 달성 가능**

1. `handleDetach` auto-fallback 구현 (~20줄)
2. `inject-*.js` 파일 삭제 (2개 파일)
3. `chrome.permissions.contains()` 권한 체크 추가 (~10줄)
