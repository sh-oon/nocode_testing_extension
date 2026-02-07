# Auto Assertion 기획서

> 녹화 중 자동으로 wait/assertElement/assertApi 스텝을 삽입하여,
> 사용자가 수동 assertion 없이도 의미 있는 테스트 시나리오를 생성하도록 한다.

## 현재 문제

녹화 결과에 UI 액션(click, type, navigate)만 포함되고 assertion이 없다.
재생 시 "스텝이 에러 없이 실행되면 passed"일 뿐, **기대 결과를 검증하지 않는다.**

```
현재:  click → type → click → (끝)         → "길이 막혀있지 않은가"만 확인
목표:  click → type → click → wait → assert → "결과가 맞는가"까지 확인
```

---

## 핵심 휴리스틱: "유저 유휴 구간 = 결과 확인 구간"

녹화 중 사용자가 **일정 시간 동안 아무 조작을 하지 않는 구간**이 곧
**"화면에 나타난 결과를 눈으로 확인하고 있는 구간"**이다.

이 구간에서:
1. DOM 변화를 감시하여 새로 나타난 요소를 assertion 대상으로 삼는다
2. 완료된 API 호출을 assertion 대상으로 삼는다
3. DOM이 안정될 때까지 wait 스텝을 삽입한다

---

## 팀 구성 (3명)

| 팀원 | 담당 | 주요 작업 위치 |
|------|------|--------------|
| **A** | Idle Detector + Auto Wait | `event-collector`, Content Script |
| **B** | DOM Mutation Tracker + Auto assertElement | Content Script, `event-collector` |
| **C** | API Completion Tracker + Auto assertApi | Service Worker, `event-collector` |

---

## 팀원 A: Idle Detector + Auto Wait

### 목표
녹화 중 사용자의 유휴 구간을 감지하고, `wait { strategy: 'networkIdle' }` 스텝을 자동 삽입한다.

### 설계

#### 1. IdleDetector 클래스 (`packages/event-collector/src/idle-detector.ts`)

```typescript
interface IdleDetectorConfig {
  /** 유휴로 판단하는 최소 시간 (ms). 기본값: 2000 */
  idleThreshold: number;
  /** 너무 짧은 유휴는 무시하는 최소 시간 (ms). 기본값: 800 */
  minIdleDuration: number;
  /** 유휴 감지 시 호출되는 콜백 */
  onIdle: (context: IdleContext) => void;
}

interface IdleContext {
  /** 유휴 시작 시점 (마지막 이벤트 timestamp) */
  startedAt: number;
  /** 유휴 기간 (ms) */
  duration: number;
  /** 유휴 직전에 발생한 이벤트 타입 */
  lastEventType: string;
}
```

**동작 원리:**
- 녹화 시작 시 타이머 시작
- 이벤트가 발생할 때마다 타이머 리셋
- `idleThreshold` 동안 이벤트 없으면 `onIdle` 콜백 호출
- 콜백은 한 유휴 구간당 최대 1회만 호출 (다음 이벤트 발생 전까지)

#### 2. Content Script 통합 (`apps/extension/src/content/index.ts`)

```
이벤트 발생 → IdleDetector.reset()
                    ↓ (threshold 경과, 이벤트 없음)
              onIdle 콜백 발동
                    ↓
              IDLE_DETECTED 메시지 → Service Worker
```

#### 3. Service Worker에서 wait 스텝 삽입 (`service-worker.ts`)

`IDLE_DETECTED` 메시지 수신 시:
- 현재 steps 배열 끝에 `WaitStep { strategy: 'networkIdle' }` 삽입
- 팀원 B, C의 결과(DOM 변화, API 완료)가 있으면 wait 스텝 뒤에 assertion 삽입

### 수정 파일

| 파일 | 변경 |
|------|------|
| `packages/event-collector/src/idle-detector.ts` | **신규** — IdleDetector 클래스 |
| `packages/event-collector/src/index.ts` | export 추가 |
| `apps/extension/src/content/index.ts` | IdleDetector 인스턴스 생성, 이벤트 연동 |
| `apps/extension/src/background/service-worker.ts` | `IDLE_DETECTED` 핸들러, wait 스텝 삽입 로직 |
| `apps/extension/src/shared/messages.ts` | `IdleDetectedMessage` 타입 추가 |

### 엣지 케이스

- 페이지 로드 직후 idle → 무시 (첫 이벤트 전에는 idle 판정 안 함)
- 연속 idle (사용자가 오래 보고 있음) → 첫 1회만 삽입
- 녹화 중지 직전 idle → 삽입하되 마지막 스텝 이후에

---

## 팀원 B: DOM Mutation Tracker + Auto assertElement

### 목표
유휴 구간 동안 발생한 DOM 변화를 추적하여, 새로 나타난 의미 있는 요소에 대해
`assertElement { type: 'visible' }` 또는 `assertElement { type: 'text' }` 스텝을 자동 삽입한다.

### 설계

#### 1. DomMutationTracker 클래스 (`packages/event-collector/src/dom-mutation-tracker.ts`)

```typescript
interface DomMutationTrackerConfig {
  /** DOM 안정화로 판단하는 기간 (ms). 기본값: 1500 */
  stabilityThreshold: number;
  /** 추적 대상에서 제외할 셀렉터 */
  ignoreSelectors: string[];
  /** DOM 안정화 시 호출되는 콜백 */
  onStable: (mutations: TrackedMutation[]) => void;
}

interface TrackedMutation {
  /** 변화 유형 */
  type: 'added' | 'textChanged' | 'attributeChanged';
  /** 대상 요소의 셀렉터 */
  selector: SelectorInput;
  /** 추가된 텍스트 또는 변경된 값 */
  textContent?: string;
  /** 변경된 attribute 이름과 값 */
  attribute?: { name: string; value: string };
  /** 요소의 태그명 */
  tagName: string;
  /** 부모 요소 정보 (컨텍스트) */
  parentSelector?: SelectorInput;
}
```

**동작 원리:**
1. 녹화 시작과 함께 `MutationObserver` 활성화
2. `childList`, `characterData`, `subtree` 감시
3. 변화가 감지될 때마다 내부 버퍼에 축적 + 안정화 타이머 리셋
4. `stabilityThreshold` 동안 추가 변화 없으면 `onStable` 콜백 호출

#### 2. 의미 있는 변화 필터링

모든 DOM 변화가 assertion 대상이 되면 안 된다. 필터링 기준:

```typescript
function isSignificantMutation(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return false;

  const tag = node.tagName.toLowerCase();

  // 무시: 스크립트, 스타일, 메타 요소
  if (['script', 'style', 'link', 'meta', 'noscript'].includes(tag)) return false;

  // 무시: 숨겨진 요소
  if (node.offsetParent === null && tag !== 'body') return false;

  // 무시: 너무 작은 요소 (1px 미만)
  const rect = node.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return false;

  // 무시: 익스텐션이 삽입한 요소
  if (node.matches('[data-like-cake-ignore], .like-cake-overlay')) return false;

  // 무시: 로딩 스피너 등 일시적 요소 (빠르게 나타났다 사라짐)
  // → onStable 시점에 여전히 DOM에 존재하는지 확인

  return true;
}
```

#### 3. Assertion 생성 전략

`onStable` 콜백에서 mutations 배열을 받아 assertion 스텝으로 변환:

| 변화 유형 | 생성할 assertion | 예시 |
|----------|-----------------|------|
| 새 요소 출현 (`added`) | `assertElement { visible }` | 폴더 아이템 나타남 |
| 텍스트 변경 (`textChanged`) | `assertElement { text, contains }` | 채팅 응답 텍스트 |
| 의미 있는 텍스트가 있는 새 요소 | `assertElement { text, value }` | 성공 메시지 토스트 |

**최대 assertion 수 제한**: 한 유휴 구간당 최대 3개 (가장 의미 있는 것 우선)

**우선순위:**
1. 텍스트가 있는 새 요소 (사용자가 읽을 가능성 높음)
2. 사용자의 마지막 클릭 위치 근처의 변화 (시각적 연관성)
3. 화면 중앙 영역의 변화 (사이드바/헤더보다 콘텐츠 영역)

#### 4. Content Script 통합

```
MutationObserver 변화 감지
      ↓ (stabilityThreshold 경과)
onStable 콜백
      ↓
DOM_MUTATIONS_STABLE 메시지 → Service Worker
  { mutations: TrackedMutation[] }
      ↓
Service Worker: assertElement 스텝 생성 & 삽입
  (IdleDetector의 wait 스텝 뒤에 배치)
```

### 수정 파일

| 파일 | 변경 |
|------|------|
| `packages/event-collector/src/dom-mutation-tracker.ts` | **신규** — DomMutationTracker 클래스 |
| `packages/event-collector/src/index.ts` | export 추가 |
| `apps/extension/src/content/index.ts` | MutationTracker 인스턴스, onStable 핸들러 |
| `apps/extension/src/background/service-worker.ts` | `DOM_MUTATIONS_STABLE` 핸들러, assertion 생성 |
| `apps/extension/src/shared/messages.ts` | `DomMutationsStableMessage` 타입 추가 |

### 엣지 케이스

- SPA 라우팅 (대량 DOM 변경) → 새 페이지 전체를 assertion 하지 않도록, navigate 이벤트 직후 mutations 버퍼 초기화
- 무한 스크롤 → 스크롤 이벤트 직후의 DOM 추가는 assertion 대상에서 제외 (사용자 액션의 직접 결과)
- 애니메이션/트랜지션 → `stabilityThreshold`가 충분히 크면 자연스럽게 필터링됨
- 안정화 시점에 이미 DOM에서 사라진 요소 → 제외 (로딩 스피너 등)

---

## 팀원 C: API Completion Tracker + Auto assertApi

### 목표
유휴 구간 직전에 완료된 API 호출을 감지하여 `assertApi` 스텝을 자동 삽입한다.

### 설계

#### 1. Service Worker 내 API 타이밍 분석

API 호출은 이미 `API_CALL_CAPTURED` 메시지로 Service Worker에 전달되고 있다.
추가로 필요한 것은 **"어떤 API 호출이 유휴 구간과 관련 있는가"**를 판단하는 로직이다.

```typescript
interface ApiAssertionContext {
  /** 마지막 UI 이벤트 시각 */
  lastEventTimestamp: number;
  /** 유휴 감지 시각 */
  idleDetectedAt: number;
  /** 이 구간에 완료된 API 호출들 */
  completedCalls: CapturedApiCall[];
}
```

#### 2. 관련 API 호출 판단 기준

```
마지막 UI 이벤트 ─────────────── 유휴 감지
      |                              |
      |  이 구간에 완료된 API = 관련   |
      |  [call1]  [call2]  [call3]   |
      └──────────────────────────────┘
```

```typescript
function getRelevantApiCalls(
  allCalls: CapturedApiCall[],
  lastEventTimestamp: number,
  idleDetectedAt: number
): CapturedApiCall[] {
  return allCalls.filter(call => {
    if (!call.response) return false;

    // 응답 완료 시각이 유휴 구간 내에 있는가
    const responseTime = call.request.timestamp + (call.response.responseTime ?? 0);
    return responseTime >= lastEventTimestamp && responseTime <= idleDetectedAt;
  });
}
```

#### 3. assertApi 스텝 생성 전략

| API 특성 | 생성할 assertion | 이유 |
|----------|-----------------|------|
| POST/PUT/PATCH/DELETE (상태 변경) | `assertApi { status: 200, waitFor: true }` | 데이터 변경 작업의 성공 검증이 핵심 |
| GET with 4xx/5xx | `assertApi { status: { min: 200, max: 299 } }` | 에러 감지 |
| GET with 2xx (일반 데이터 조회) | 삽입하지 않음 | 노이즈 — 페이지 렌더링용 데이터 |

**필터링 (기존 excludePatterns 재활용):**
```typescript
const EXCLUDE_PATTERNS = [
  /google-analytics/, /googletagmanager/, /facebook\.com\/tr/,
  /analytics/, /tracking/, /beacon/,
  /hot-update/, /__vite/, /__webpack/, /\.map$/,
  /favicon\.ico/, /\.woff2?$/, /\.ttf$/,
];
```

**최대 assertion 수**: 유휴 구간당 최대 2개 (가장 중요한 API 우선)

**우선순위:**
1. POST/PUT/DELETE (상태 변경 API)
2. 에러 응답 (4xx, 5xx)
3. 나머지는 무시

#### 4. Service Worker 통합

```
handleEventCaptured() → lastEventTimestamp 갱신
      ↓
handleApiCallCaptured() → 완료된 호출 축적
      ↓
IDLE_DETECTED 수신 (팀원 A)
      ↓
getRelevantApiCalls() → 관련 API 필터링
      ↓
generateAssertApiSteps() → assertApi 스텝 생성
      ↓
steps 배열에 삽입 (wait 스텝 뒤, assertElement 뒤)
```

### 수정 파일

| 파일 | 변경 |
|------|------|
| `packages/event-collector/src/api-assertion-generator.ts` | **신규** — API assertion 생성 로직 |
| `packages/event-collector/src/index.ts` | export 추가 |
| `apps/extension/src/background/service-worker.ts` | 유휴 구간 API 연관 분석, assertApi 삽입 |

### 엣지 케이스

- 폴링 API (주기적 GET) → 같은 URL이 반복되면 첫 1회만 assertion
- 병렬 API 호출 → 상태 변경 API만 우선 선택
- 인증 토큰 갱신 등 자동 호출 → URL 패턴으로 제외 (`/auth/refresh`, `/token` 등)
- Long-polling → 응답 시간이 `idleThreshold`보다 긴 호출은 제외

---

## 통합 아키텍처

### 전체 데이터 흐름

```
Content Script
├─ EventCollector (기존) ─── 이벤트 발생 ──→ SERVICE WORKER
├─ IdleDetector (팀A)   ─── IDLE_DETECTED ──→    │
├─ DomMutationTracker (팀B) ── DOM_MUTATIONS_STABLE ──→ │
│                                                  │
│                                      ┌───────────┘
│                                      ▼
│                              SERVICE WORKER
│                              handleIdleDetected()
│                              ├─ 1. WaitStep 삽입 (팀A)
│                              ├─ 2. assertElement 삽입 (팀B 데이터)
│                              └─ 3. assertApi 삽입 (팀C 데이터)
│                                      │
│                                      ▼
│                              steps[] 업데이트 → Panel UI
└─ API Interceptor (기존) ── API_CALL_CAPTURED ──→ SERVICE WORKER
```

### 스텝 삽입 순서

유휴 구간이 감지되면, 다음 순서로 스텝이 삽입된다:

```
... (기존 UI 액션 스텝들)
├─ click ".create-button"              ← 사용자의 마지막 액션
├─ wait  { strategy: "networkIdle" }   ← 팀A: 자동 wait
├─ assertApi { "/api/files", POST, 200 } ← 팀C: API 성공 검증
├─ assertElement { ".folder-item", visible } ← 팀B: DOM 변화 검증
... (다음 UI 액션 스텝들)
```

### 메시지 순서 타이밍

```
Time ─────────────────────────────────────────────────►

 이벤트 발생  ···(유휴)···  DOM 안정화  ···  Idle 감지
     │                        │               │
     │    DOM 변화 시작       │               │
     │         │              │               │
     ▼         ▼              ▼               ▼
  EVENT    mutations     DOM_MUTATIONS    IDLE_DETECTED
 CAPTURED  축적 중         STABLE

                              │               │
                              └──── 둘 다 Service Worker에 도달
                                    → 통합하여 스텝 삽입
```

**타이밍 조율:**
- `DomMutationTracker.stabilityThreshold` (1500ms) < `IdleDetector.idleThreshold` (2000ms)
- DOM 안정화가 먼저 감지되고, idle이 뒤에 감지됨
- Service Worker는 `IDLE_DETECTED` 수신 시점에 이미 도착한 `DOM_MUTATIONS_STABLE` 데이터를 활용

---

## AST 타입 변경

### WaitStep 확장 (`packages/ast-types/src/types/step.ts`)

기존 `WaitStep.strategy`에 `'domStable'` 추가:

```typescript
export interface WaitStep extends BaseStep {
  type: 'wait';
  strategy: 'time' | 'selector' | 'navigation' | 'networkIdle' | 'domStable';
  duration?: number;
  selector?: SelectorInput;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  /** DOM 안정화 판단 기간 (domStable 전략용, ms) */
  stabilityThreshold?: number;
}
```

### step-player executor 확장 (`packages/step-player/src/executors/navigation.ts`)

`domStable` 전략 실행 로직 추가:
- Puppeteer 환경: `page.waitForFunction()` + MutationObserver 기반 안정화 감지
- Extension 환경: 기존 `wait()` + setTimeout 기반

---

## 사용자 설정 (Phase 2)

자동 assertion 기능은 기본 활성화하되, 설정에서 세부 조정 가능:

```typescript
interface AutoAssertionSettings {
  /** 자동 assertion 활성화 여부 */
  enabled: boolean;
  /** 자동 wait 삽입 */
  autoWait: boolean;
  /** DOM 변화 기반 assertion */
  autoAssertElement: boolean;
  /** API 결과 기반 assertion */
  autoAssertApi: boolean;
  /** 유휴 감지 임계값 (ms) */
  idleThreshold: number;
  /** DOM 안정화 임계값 (ms) */
  domStabilityThreshold: number;
}
```

설정 UI는 기존 `SettingsPanel`에 섹션 추가.
**이번 Sprint에서는 구현하지 않음** — 하드코딩된 기본값 사용.

---

## 테스트 계획

### 팀A: IdleDetector

```
idle-detector.test.ts
├─ 이벤트 없이 threshold 경과 → onIdle 호출됨
├─ 이벤트 발생으로 타이머 리셋 → onIdle 호출 안 됨
├─ 연속 유휴 → 1회만 호출
├─ minIdleDuration 미만 → 무시
└─ 녹화 시작 전 idle → 무시
```

### 팀B: DomMutationTracker

```
dom-mutation-tracker.test.ts (jsdom 환경)
├─ 새 요소 추가 → TrackedMutation 생성
├─ 숨겨진 요소 추가 → 무시
├─ script/style 추가 → 무시
├─ 텍스트 변경 → textChanged mutation 생성
├─ 빠르게 나타났다 사라진 요소 → 제외
├─ stabilityThreshold 내 연속 변화 → 한 번에 모아서 콜백
└─ 최대 3개 assertion 제한 → 우선순위 적용
```

### 팀C: ApiAssertionGenerator

```
api-assertion-generator.test.ts
├─ POST 200 → assertApi 생성
├─ GET 200 → 생성하지 않음
├─ DELETE 204 → assertApi 생성
├─ analytics URL → 제외
├─ 유휴 구간 외 API → 제외
├─ 같은 URL 반복 (폴링) → 1회만
└─ 최대 2개 제한 → 우선순위 적용
```

### 통합 테스트 (Service Worker)

```
auto-assertion-integration.test.ts
├─ click → idle → wait + assertApi 삽입 확인
├─ click → DOM 변화 → idle → wait + assertElement 삽입 확인
├─ click → API 완료 + DOM 변화 → idle → wait + assertApi + assertElement 순서 확인
├─ navigate 직후 → 대량 DOM 변화 무시 확인
└─ 자동 assertion이 기존 수동 스텝에 영향 없음 확인
```

---

## 일정

| 단계 | 작업 | 소요 |
|------|------|------|
| **Sprint 1** | 팀A: IdleDetector + auto wait | 병렬 진행 |
| | 팀B: DomMutationTracker + auto assertElement | 병렬 진행 |
| | 팀C: ApiAssertionGenerator + auto assertApi | 병렬 진행 |
| **Sprint 2** | Service Worker 통합 (3개 모듈 연동) | 순차 |
| | step-player `domStable` executor 추가 | 순차 |
| | 통합 테스트 | 순차 |

Sprint 1은 각 팀이 독립적으로 모듈을 개발하고 단위 테스트를 작성한다.
Sprint 2에서 Service Worker의 `handleIdleDetected()`에 3개 모듈을 통합한다.

---

## 의존성 그래프

```
팀A (IdleDetector)─────────┐
                           ├──→ Service Worker 통합 (Sprint 2)
팀B (DomMutationTracker)───┤
                           │
팀C (ApiAssertionGenerator)┘

팀A ← 팀B, 팀C 없이도 단독 동작 (wait만 삽입)
팀B ← 팀A의 idle 시점 정보 필요 (하지만 자체 stabilityThreshold로 독립 동작 가능)
팀C ← 팀A의 idle 시점 + 기존 API 캡처 데이터 활용
```

Sprint 1에서 각 모듈은 **독립적으로 테스트 가능**하도록 설계되어 있다.
통합은 Sprint 2의 Service Worker에서만 발생한다.
