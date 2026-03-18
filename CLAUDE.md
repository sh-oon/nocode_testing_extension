# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome Extension 기반 E2E 테스트 자동화 툴. 사용자의 웹 사용 시나리오를 녹화하거나 위자드로 작성하여 AST 형태로 변환하고, Puppeteer 기반 테스트 러너에서 재생합니다.

Yarn Berry (v4) 모노레포 + TypeScript + Biome + Turbo 구성. 조직 네임스페이스는 `@like-cake`.

## System Architecture

```
Chrome Extension            Backend (Hono)          Test Runner (Puppeteer)
├─ ScenarioWizard           ├─ Scenario CRUD        ├─ AST Step 실행
│  (녹화 + 수동 스텝 작성)   ├─ Flow CRUD            ├─ API 관측/검증
├─ FlowBuilder              ├─ Execution Service    ├─ DOM Snapshot (CDP)
│  (시나리오 조합/분기)       └─ Model Execution     └─ 결과 리포트
├─ Content Script ──────►
│  (이벤트 수집/인스펙트)
└─ Service Worker
   (메시지 라우팅)
```

### 핵심 개념

- **녹화 대상 이벤트**: click, input/change/blur, keyboard, 페이지 이동 (SPA 포함), wait
- **Selector 우선순위**: `data-testid` → role/aria-label → CSS selector → XPath fallback
- **AST 구조**: UI Action, Assertion, Observation 분리, 실행 환경 독립적
- **Adapter 패턴**: step-player의 ExtensionAdapter(브라우저) / PuppeteerAdapter(Node.js)

### AST Step Types

**UI Actions**: navigate, click, type, keypress, hover, scroll, select, wait, mouseOut, dragAndDrop, fileUpload, historyBack, historyForward
**Assertions**: assertElement, assertApi, assertPage, assertStyle
**Observations**: snapshotDom

## Commands

```bash
# Development
yarn dev                 # Run all apps in dev mode (turbo)
yarn build               # Build all packages and apps
yarn type-check          # TypeScript type checking across workspace

# Linting & Formatting (Biome)
yarn lint                # Check linting issues
yarn lint:fix            # Auto-fix linting issues
yarn format              # Format code

# Docker (Backend)
yarn docker:up           # Start backend in Docker (port 8888)
yarn docker:down         # Stop Docker
yarn docker:logs         # View backend logs
yarn docker:restart      # Rebuild and restart

# Testing
yarn workspace @like-cake/mbt-catalog test   # MBT catalog tests (159)
```

## Workspace Structure

### Apps
- **apps/extension** (`@like-cake/extension`): Chrome DevTools Extension — ScenarioWizard(녹화+수동작성), FlowBuilder(시나리오 조합)
- **apps/backend** (`@like-cake/backend`): Hono API server + SQLite — 시나리오/플로우 CRUD, 실행 서비스
- **apps/runner** (`@like-cake/runner`): Puppeteer 기반 테스트 러너 — StepPlayer에 위임

### Domain Packages
- **packages/ast-types**: AST 타입 정의 (Step, Scenario, Selector, FlowNode 등)
- **packages/selector-engine**: 셀렉터 생성 + 안정성 점수
- **packages/event-collector**: DOM 이벤트 수집/정규화 + 유휴 감지 + DOM 변경 추적
- **packages/api-interceptor**: fetch/XHR 인터셉션
- **packages/dom-serializer**: DOM 직렬화 + 스크린샷
- **packages/diff-engine**: API/DOM/비주얼 비교
- **packages/variable-store**: 변수 관리 + 보간 + 조건 평가
- **packages/step-player**: Step 실행 엔진 (PlaybackAdapter 패턴)
- **packages/mbt-catalog**: MBT 카탈로그 (이벤트 15개, 검증 22개), 컨버터, 그래프 경로 생성, 유효성 검사

### Infrastructure
- **packages/tsconfig**: 공유 TypeScript 설정 (base.json, react-library.json)

## Extension Component Structure

```
devtools/components/
  App.tsx                     — 2탭 라우터 (시나리오 | 플로우)
  ScenarioWizard/             — 위자드 기반 시나리오 빌더
    useScenarioWizard.ts      — 스텝 CRUD + 녹화 + 재생 + 저장
    StepConfigPanel.tsx       — 인라인 스텝 설정 (무엇을?/어떤 요소를?)
    WizardStepList.tsx        — 스텝 목록 + 검증 삽입
  FlowBuilder/                — React Flow 캔버스 기반 플로우 빌더
    FlowCanvas.tsx + nodes/   — 캔버스 + 커스텀 노드
    editors/                  — 속성 에디터 (조건/변수/추출)
  shared/                     — 공유 컴포넌트 (TabToggle, Icons, StatusBadge 등)
```

## Service Worker Structure

```
background/
  service-worker.ts           — 메시지 라우터 (170줄)
  state.ts                    — 공유 상태 (activeTabId, sessionCache 등)
  handlers/
    recording-handler.ts      — 녹화 라이프사이클
    playback-handler.ts       — 재생 라이프사이클
    auto-assertion-handler.ts — 유휴 감지 + 자동 검증 삽입
    inspect-handler.ts        — 요소 인스펙트 (위자드용)
    baseline-handler.ts       — 베이스라인 CRUD
```

## Build System

- Turbo handles task orchestration with dependency-aware caching
- `dependsOn: ["^build"]` ensures packages build before dependent apps
- Domain packages use tsup to output CJS/ESM with declarations

## Internal Package References

Use `*` for workspace dependencies (resolved locally by Yarn):
```json
"@like-cake/ast-types": "*"
```
