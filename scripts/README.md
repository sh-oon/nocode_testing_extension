# Setup Scripts

## setup.mjs

보일러플레이트의 조직명(`@like-cake`)을 원하는 조직명으로 일괄 변경하는 스크립트입니다.

### 사용법

```bash
yarn setup
```

### 동작

1. 조직명 입력 받기 (예: `mycompany`)
2. 모든 파일에서 `@like-cake`를 `@mycompany`로 변경
3. 변경된 파일 목록 출력

### 변경되는 파일

- `package.json` (모든 workspace)
- TypeScript/JSX 소스 파일
- `next.config.js/ts`
- `README.md`
- `biome.json`
- `tsconfig.json`

### 주의사항

- 조직명은 소문자, 숫자, 하이픈만 사용 가능
- npm scope 규칙을 따름

