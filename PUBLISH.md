# NPM 배포 가이드

## create-bomb-boilerplate 배포 절차

### 1. 준비 사항

- npm 계정이 있어야 합니다 (https://www.npmjs.com/)
- npm에 로그인되어 있어야 합니다

### 2. 배포 전 체크리스트

- [ ] 모든 테스트 통과
- [ ] 버전 업데이트 (`packages/create-bomb-boilerplate/package.json`)
- [ ] CHANGELOG 작성
- [ ] README 확인

### 3. 빌드 및 배포

```bash
# 1. create 패키지 빌드
yarn workspace create-bomb-boilerplate build

# 2. npm 로그인 (처음 한 번만)
npm login

# 3. 패키지 디렉토리로 이동
cd packages/create-bomb-boilerplate

# 4. 배포 (dry-run으로 먼저 테스트)
npm publish --dry-run

# 5. 실제 배포
npm publish

# 6. 루트로 돌아가기
cd ../..
```

### 4. 배포 후 확인

```bash
# 배포된 패키지 확인
npm info create-bomb-boilerplate

# 새 디렉토리에서 테스트
cd /tmp
npm create bomb-boilerplate test-project
```

### 5. 버전 업데이트

Semantic Versioning을 따릅니다:

- **Major (1.0.0 → 2.0.0)**: Breaking changes
- **Minor (1.0.0 → 1.1.0)**: 새로운 기능 추가
- **Patch (1.0.0 → 1.0.1)**: 버그 수정

```bash
# package.json에서 버전 변경 후
npm publish
```

## 트러블슈팅

### "You need to be logged in"

```bash
npm login
```

### "Package already exists"

버전을 올려야 합니다:

```json
{
  "version": "1.0.1"  // 1.0.0에서 변경
}
```

### 테스트 실패

```bash
# template 디렉토리 재생성
rm -rf packages/create-bomb-boilerplate/template
rsync -av --exclude='node_modules' --exclude='.yarn/cache' --exclude='.git' --exclude='packages/create-bomb-boilerplate' . packages/create-bomb-boilerplate/template/

# 다시 빌드
yarn workspace create-bomb-boilerplate build
```

