# Chrome Extension 기반 E2E 테스트 자동화 툴 기획서

## 1. 개요

본 프로젝트는 **Chrome Extension을 활용하여 사용자의 실제 웹 사용 시나리오를 녹화하고**,
이를 **AST(Abstract Syntax Tree) 형태의 테스트 시나리오**로 변환하여
**Puppeteer 기반 테스트 러너에서 재생(E2E 실행)** 하는 자동화 툴을 구현하는 것을 목표로 합니다.

특히 다음을 중점으로 합니다.

* 실제 사용자 행동 기반 시나리오 수집
* UI 이벤트 + API 관측을 함께 포함한 시나리오 모델
* CDP(Chrome DevTools Protocol)를 활용한 DOM Snapshot 수집
* CI/로컬 환경에서 재현 가능한 테스트 실행

---

## 2. 전체 아키텍처 개요

```text
┌───────────────────┐
│  Chrome Extension │
│───────────────────│
│ - 녹화 UI (Panel) │
│ - Content Script  │─── 사용자 이벤트 수집
│ - Service Worker  │─── 세션 관리 / 업로드
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│      Backend      │
│───────────────────│
│ - Raw Event 저장  │
│ - AST 변환        │
│ - 메타데이터 관리│
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Test Runner      │
│  (Puppeteer)     │
│───────────────────│
│ - AST 실행        │
│ - API 관측/검증   │
│ - DOM Snapshot    │
│ - 결과 리포트     │
└───────────────────┘
```

---

## 3. 주요 기능 요구사항

### 3.1 사용자 시나리오 녹화 (Chrome Extension)

#### 기능

* 사용자가 녹화 버튼을 누르면 시나리오 녹화 시작/중지 가능
* 실제 사용자 행동을 기반으로 이벤트 수집

#### 수집 대상 이벤트

* 클릭 (click)
* 입력 (input / change / blur 기준)
* 키보드 입력 (enter 등)
* 페이지 이동 (SPA route 변경 포함)
* 명시적 대기(wait) 지점

#### 구현 방식

* **Content Script**

    * DOM 이벤트 리스닝
    * 안정적인 selector 생성

        * `data-testid` 우선
        * role/aria-label
        * CSS selector / XPath fallback
* **Service Worker**

    * 녹화 세션 관리
    * 이벤트 버퍼링
    * 서버 업로드

---

### 3.2 시나리오 AST 변환 및 저장

#### 개념

* Raw Event → 정규화 → 테스트 AST 변환
* “무엇을 했는지”를 중심으로 한 의미 기반 구조

#### AST 설계 방향

* UI Action과 Observation을 명확히 분리
* 실행 환경(Puppeteer)에 독립적인 구조 유지

#### 예시 AST

```json
{
  "id": "scenario-001",
  "meta": {
    "recordedAt": "2026-01-01T10:00:00Z",
    "url": "https://example.com",
    "viewport": { "width": 1440, "height": 900 }
  },
  "steps": [
    { "type": "navigate", "url": "/login" },
    { "type": "type", "selector": "[data-testid=email]", "value": "user@test.com" },
    { "type": "click", "selector": "[data-testid=submit]" },
    { "type": "assertApi", "match": { "url": "/api/login", "method": "POST" } },
    { "type": "snapshotDom", "label": "after-login" }
  ]
}
```

---

### 3.3 테스트 메타데이터 저장

#### 저장 대상

* 녹화 시점 메타데이터

    * URL, viewport, locale, timezone
    * userAgent
    * extension 버전 / AST 스키마 버전
* 실행 시점 메타데이터

    * 실행 환경(OS, Node 버전)
    * Puppeteer/Chrome 버전
    * 실행 시간, 성공/실패 상태

#### 목적

* 테스트 재현성 확보
* 실패 원인 추적 및 디버깅 용이성

---

## 4. Puppeteer 기반 테스트 러너

### 4.1 AST 실행

* AST Step을 순차적으로 Puppeteer 명령으로 변환
* UI 액션과 검증 단계를 명확히 분리

---

### 4.2 DOM Snapshot 수집 (CDP)

#### 방식

* Puppeteer에서 CDP 세션 생성

```ts
const client = await page.target().createCDPSession();
await client.send('DOMSnapshot.captureSnapshot', {
  computedStyles: ['display', 'visibility']
});
```

#### 수집 시점

* 주요 액션 직후
* Assertion 시점

#### 저장 전략

* JSON 결과 gzip 압축
* 중요 스텝만 샘플링
* 필요 시 screenshot fallback 제공

---

### 4.3 API 관측 및 시나리오 포함

#### 목적

* UI만으로 검증하기 어려운 로직 보완
* E2E 테스트의 신뢰성 강화

#### 수집 방식

* Puppeteer 이벤트 기반

    * `page.on('request')`
    * `page.on('response')`
* 또는 CDP Network 도메인 활용

#### 시나리오 포함 방식 (권장)

* **Assertion 용도**

```json
{
  "type": "assertApi",
  "match": {
    "url": "/api/orders",
    "method": "GET"
  },
  "expect": {
    "status": 200,
    "jsonPath": {
      "$.status": "SUCCESS"
    }
  }
}
```

> ⚠️ API 응답 전체를 고정(mock)하여 재생하는 구조는 복잡도가 높아
> 2차 단계 로드맵으로 분리하는 것을 권장합니다.

---

## 5. 보안 및 안정성 고려사항

* API 응답 내 민감정보 마스킹 필수

    * 토큰, 이메일, 개인정보
* iframe / cross-origin 접근 제한 대응
* MV3 Service Worker 중단 대비 이벤트 ACK/버퍼 설계
* selector 불안정성 대비 fallback 전략 필수

---

## 6. 단계별 구현 로드맵 (권장)

### Phase 1 (MVP)

* UI 이벤트 녹화
* AST 생성 및 저장
* Puppeteer 재생
* DOM Snapshot
* API Assertion

### Phase 2

* 시나리오 편집 UI
* Snapshot Diff
* 실패 지점 자동 하이라이트

### Phase 3

* API Record & Replay(Mock)
* CI 연동
* 테스트 결과 대시보드

---

## 7. 결론

본 툴은 **기술적으로 충분히 구현 가능**하며,
Chrome Extension + Puppeteer + CDP의 역할을 명확히 분리함으로써
안정성과 확장성을 모두 확보할 수 있습니다.

특히 **UI 시나리오 + API 관측 + DOM Snapshot**의 결합은
기존 E2E 도구 대비 높은 디버깅 가치를 제공합니다.

---