# Yarn Workspace 모노레포 보일러플레이트

[![CI](https://github.com/sh-oon/next-ts-boilerplate/actions/workflows/ci.yml/badge.svg)](https://github.com/sh-oon/next-ts-boilerplate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Yarn](https://img.shields.io/badge/Yarn-4.x-2C8EBB?logo=yarn)](https://yarnpkg.com/)
[![Biome](https://img.shields.io/badge/Biome-2.x-60A5FA?logo=biome)](https://biomejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)

TypeScript, Biome, Turbo를 사용하는 Yarn Berry 기반 모노레포 보일러플레이트입니다.

## 🚀 Quick Start

### 방법 1: npm create (권장)

```bash
# npm
npm create bomb-boilerplate my-project

# yarn
yarn create bomb-boilerplate my-project

# pnpm
pnpm create bomb-boilerplate my-project
```

### 방법 2: Git Clone

```bash
# 1. 저장소 클론
git clone https://github.com/sh-oon/next-ts-boilerplate.git my-project
cd my-project

# 2. Yarn Berry 활성화 및 의존성 설치
corepack enable
yarn install

# 3. 조직명 설정 (예: mycompany)
yarn setup

# 4. 의존성 재설치 및 개발 시작
yarn install
yarn dev
```

## 프로젝트 구조

```
.
├── apps/
│   └── web/              # Next.js 웹 애플리케이션
├── packages/
│   ├── eslint-config/    # 공유 ESLint 설정
│   ├── tsconfig/         # 공유 TypeScript 설정
│   ├── ui/               # 공유 UI 컴포넌트
│   └── utils/            # 공유 유틸리티 함수
├── package.json          # 루트 package.json (workspace 설정)
├── tsconfig.json         # 루트 TypeScript 설정
├── .eslintrc.js          # 루트 ESLint 설정
├── .prettierrc.js        # Prettier 설정
└── turbo.json            # Turbo 빌드 시스템 설정
```

## 기능

- ✅ **Yarn Berry (v4)**: 최신 Yarn Workspace 기반 모노레포 관리
- ✅ **TypeScript**: 전체 프로젝트에 TypeScript 적용
- ✅ **Turbo**: 빠른 빌드 및 캐싱 시스템
- ✅ **Biome**: 초고속 린터 및 포매터 (ESLint + Prettier 대체)
  - import 자동 정렬
  - 코드 품질 관리
  - 코드 포맷팅
  - TypeScript, React 지원

## 시작하기

### 1. 조직명 설정 (첫 설정 시)

보일러플레이트를 처음 사용하는 경우, 조직명을 설정하세요:

```bash
corepack enable
yarn install
yarn setup
```

스크립트가 실행되면 조직명(예: `mycompany`)을 입력하면 모든 `@like-cake` 참조가 `@mycompany`로 자동 변경됩니다.

### 2. 의존성 재설치

```bash
yarn install
```

### 3. 개발 서버 실행

```bash
yarn dev
```

웹 애플리케이션이 `http://localhost:3000`에서 실행됩니다.

### 4. 빌드

```bash
yarn build
```

### 5. 린트 실행

```bash
yarn lint
```

### 6. 린트 자동 수정 및 포맷팅

```bash
yarn lint:fix
```

### 7. 코드 포맷팅

```bash
yarn format
```

## Workspace 패키지

### Apps

#### @like-cake/web

Next.js 기반의 웹 애플리케이션입니다.

### Packages

#### @like-cake/tsconfig

공유 TypeScript 설정 패키지입니다.

- `base.json` - 기본 설정
- `nextjs.json` - Next.js 앱용
- `react-library.json` - React 라이브러리용

#### @like-cake/ui

공유 UI 컴포넌트 라이브러리입니다.

```tsx
import { Button } from '@like-cake/ui';

<Button onClick={() => console.log('클릭')}>버튼</Button>;
```

#### @like-cake/utils

공유 유틸리티 함수 라이브러리입니다.

```ts
import { formatDate, debounce } from '@like-cake/utils';

const today = formatDate(new Date());
const debouncedFn = debounce(() => console.log('실행!'), 300);
```

## 새로운 앱 추가하기

```bash
mkdir -p apps/새로운앱
cd apps/새로운앱
yarn init -y
```

## 새로운 패키지 추가하기

```bash
mkdir -p packages/새로운패키지
cd packages/새로운패키지
yarn init -y
```

## 스크립트

- `yarn setup` - 조직명 설정 (첫 설정 시)
- `yarn dev` - 모든 앱을 개발 모드로 실행
- `yarn build` - 모든 앱과 패키지 빌드
- `yarn lint` - Biome으로 린트 실행
- `yarn lint:fix` - Biome으로 린트 자동 수정
- `yarn format` - Biome으로 코드 포맷팅
- `yarn type-check` - TypeScript 타입 체크

## Yarn Berry 특징

- **node_modules 모드**: 호환성을 위해 node_modules linker 사용
- **로컬 캐시**: `.yarn/cache` 디렉토리에 의존성 캐시
- **Zero-installs**: 선택적으로 캐시를 git에 커밋 가능 (현재는 .gitignore 처리)
- **Workspace 프로토콜**: 내부 패키지는 `*` 버전 사용

## Biome 특징

- **빠른 속도**: Rust로 작성되어 ESLint보다 25배 빠름
- **올인원**: 린터 + 포매터 통합 (ESLint + Prettier 대체)
- **Import 정렬**: `assist.actions.source.organizeImports` 활성화로 자동 정렬
- **VSCode 통합**: 저장 시 자동 포맷팅 및 import 정렬
- **Overrides**: 프로젝트별로 다른 규칙 적용 가능

### Biome 설정 구조

루트 `biome.json`에서 모든 설정을 중앙 관리하며, `overrides`로 프로젝트별 규칙을 적용합니다:

- **apps/web & packages/ui**: React + a11y 규칙 적용
- **packages/utils**: 더 엄격한 규칙 (noExplicitAny: error)

### Import 정렬 순서

[Biome 공식 문서](https://biomejs.dev/assist/actions/organize-imports/#_top)를 참고하여 다음 순서로 정렬됩니다:

1. `react` - React 라이브러리
2. `next`, `next/**` - Next.js 관련 (apps/web만)
3. `:Library:` - 외부 라이브러리 (node_modules)
4. `@like-cake/**` - 내부 모노레포 패키지
5. `**` - 상대 경로 import
6. `{ "type": true }` - Type import

### Import 정렬 사용법

1. **VSCode에서**: 파일 저장 시 자동 정렬
2. **커맨드로**: `yarn lint:fix` 실행
3. **수동으로**: VSCode에서 `Shift + Cmd + P` → "Organize Imports"

### VSCode 설정

1. Biome VSCode 익스텐션 설치 (권장)
2. 저장 시 자동 포맷팅 및 import 정렬 활성화됨
3. TypeScript 버전 선택 시 "Use Workspace Version" 선택

## CI/CD Pipeline

GitHub Actions를 통한 자동화된 워크플로우 (`.github/workflows/ci.yml`):

### 1️⃣ Check (검증)
- ✅ Lint (Biome)
- ✅ Type check (TypeScript)

### 2️⃣ Build (빌드)
- ✅ create-bomb-boilerplate 패키지 빌드
- ✅ 빌드 결과물 아티팩트 저장

### 3️⃣ Publish (배포)
- ✅ main 브랜치 푸시 시에만 실행
- ✅ npm에 자동 배포
- ✅ Provenance 포함 (보안)

**PR 생성 시**: Check + Build만 실행  
**main 푸시 시**: Check + Build + Publish 실행

## NPM 배포

### 자동 배포 (권장)

```bash
# 1. 버전 업데이트
cd packages/create-bomb-boilerplate
# package.json에서 version 변경 (예: 1.0.0 → 1.0.1)

# 2. 커밋 및 푸시
git add .
git commit -m "chore: bump version to 1.0.1"
git push

# 3. GitHub에서 Release 생성
# → GitHub Actions가 자동으로 npm 배포!
```

### 수동 배포

```bash
# 1. create 패키지 빌드
yarn workspace create-bomb-boilerplate build

# 2. npm 로그인
npm login

# 3. create 패키지 배포
cd packages/create-bomb-boilerplate
npm publish --provenance --access public
```

### 사용자 사용법

배포 후 사용자들은 다음과 같이 사용할 수 있습니다:

```bash
# npm
npm create bomb-boilerplate my-project

# yarn
yarn create bomb-boilerplate my-project

# pnpm
pnpm create bomb-boilerplate my-project
```

CLI가 자동으로:
1. 템플릿 복사
2. 조직명 입력 받기
3. `@like-cake`를 사용자 조직명으로 변경
4. 의존성 설치
5. 프로젝트 완료!

## 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.
