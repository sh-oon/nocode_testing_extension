# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Chrome Extension 기반 E2E 테스트 자동화 툴. 사용자의 웹 사용 시나리오를 녹화하여 AST 형태로 변환하고, Puppeteer 기반 테스트 러너에서 재생합니다.

Yarn Berry (v4) 모노레포 + TypeScript + Biome + Turbo 구성. 조직 네임스페이스는 `@like-cake` (설정 변경: `yarn setup`).

## System Architecture

```
Chrome Extension          Backend              Test Runner (Puppeteer)
├─ Panel UI (녹화)        ├─ Raw Event 저장     ├─ AST 실행
├─ Content Script ──────► ├─ AST 변환      ───► ├─ API 관측/검증
│  (이벤트 수집)          └─ 메타데이터 관리    ├─ DOM Snapshot (CDP)
└─ Service Worker                              └─ 결과 리포트
   (세션/업로드)
```

### 핵심 개념

- **녹화 대상 이벤트**: click, input/change/blur, keyboard (enter 등), 페이지 이동 (SPA 포함), wait
- **Selector 우선순위**: `data-testid` → role/aria-label → CSS selector → XPath fallback
- **AST 구조**: UI Action과 Observation 분리, 실행 환경 독립적
- **DOM Snapshot**: CDP `DOMSnapshot.captureSnapshot` 사용, gzip 압축 저장

### AST Step Types

- `navigate`, `type`, `click`: UI 액션
- `assertApi`: API 응답 검증 (url, method, status, jsonPath)
- `snapshotDom`: DOM 스냅샷 캡처

## Commands

```bash
# Development
yarn dev                 # Run all apps in dev mode (uses turbo)
yarn build               # Build all packages and apps
yarn type-check          # TypeScript type checking across workspace

# Linting & Formatting (Biome)
yarn lint                # Check linting issues
yarn lint:fix            # Auto-fix linting issues
yarn format              # Format code

# Setup
yarn setup               # Interactive script to rename @like-cake to your org name

# Run commands in specific workspace
yarn workspace @like-cake/web dev
yarn workspace @like-cake/ui-components build
yarn workspace @like-cake/utils build
```

## Architecture

### Workspace Structure

- **apps/web** (`@like-cake/web`): Next.js 15 app with Turbopack, React 19, Tailwind CSS 4
- **packages/ui** (`@like-cake/ui-components`): Shared React component library, built with tsup
- **packages/utils** (`@like-cake/utils`): Shared utility functions, built with tsup
- **packages/tsconfig** (`@like-cake/tsconfig`): Shared TypeScript configs (base.json, nextjs.json, react-library.json)

### Build System

- Turbo handles task orchestration with dependency-aware caching
- `dependsOn: ["^build"]` ensures packages build before dependent apps
- Library packages (ui, utils) use tsup to output CJS/ESM with declarations

### TypeScript Configuration

Packages extend shared configs from `@like-cake/tsconfig`:
- `base.json`: Strict mode, ES2020 target, bundler module resolution
- `nextjs.json`: For Next.js apps (extends base)
- `react-library.json`: For React component libraries (extends base, jsx: react-jsx)

### Biome Configuration

Single `biome.json` at root with overrides:
- React/JSX files (apps/web, packages/ui): a11y rules + `useExhaustiveDependencies`
- packages/utils: Stricter rules (`noExplicitAny: error`, `noUnusedVariables: error`)
- Import organization: react → next → external packages → @like-cake/* → relative → type imports

## Internal Package References

Use `*` for workspace dependencies (resolved locally by Yarn):
```json
"@like-cake/ui-components": "*"
```
