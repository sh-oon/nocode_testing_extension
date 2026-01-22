# @like-cake/tsconfig

모노레포 전체에서 사용하는 공유 TypeScript 설정입니다.

## 설정 파일

- `base.json` - 기본 TypeScript 설정
- `nextjs.json` - Next.js 앱용 설정
- `react-library.json` - React 라이브러리용 설정

## 사용법

### Next.js 앱

```json
{
  "extends": "@like-cake/tsconfig/nextjs.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### React 라이브러리

```json
{
  "extends": "@like-cake/tsconfig/react-library.json"
}
```

