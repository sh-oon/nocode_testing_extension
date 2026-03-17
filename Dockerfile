# ── Stage 1: Build ───────────────────────────────────────────────────────
FROM node:20-slim AS builder

# Corepack 활성화 (Yarn Berry 4.x 사용)
RUN corepack enable

WORKDIR /app

# Yarn Berry 설정
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

# 모든 워크스페이스 package.json 복사 (Yarn resolution에 필요)
COPY apps/backend/package.json apps/backend/
COPY apps/extension/package.json apps/extension/
COPY apps/runner/package.json apps/runner/
COPY packages/api-interceptor/package.json packages/api-interceptor/
COPY packages/ast-types/package.json packages/ast-types/
COPY packages/diff-engine/package.json packages/diff-engine/
COPY packages/dom-serializer/package.json packages/dom-serializer/
COPY packages/event-collector/package.json packages/event-collector/
COPY packages/mbt-catalog/package.json packages/mbt-catalog/
COPY packages/selector-engine/package.json packages/selector-engine/
COPY packages/step-player/package.json packages/step-player/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/ui/package.json packages/ui/
COPY packages/utils/package.json packages/utils/
COPY packages/variable-store/package.json packages/variable-store/

# Python + build tools for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

RUN yarn install

# 소스 복사 및 빌드 (backend + 의존 패키지만)
COPY packages/ packages/
COPY apps/backend/ apps/backend/
COPY apps/runner/ apps/runner/
COPY turbo.json ./
COPY biome.json ./

RUN yarn build --filter=@like-cake/backend

# ── Stage 2: Runtime ─────────────────────────────────────────────────────
FROM node:20-slim

# Puppeteer가 사용하는 Chromium 의존 라이브러리
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-noto-cjk \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer가 시스템 Chromium을 사용하도록 설정
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# node_modules + 빌드 결과물 복사
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages packages
COPY --from=builder /app/apps/backend apps/backend
COPY --from=builder /app/apps/runner apps/runner
COPY --from=builder /app/package.json package.json

# SQLite DB 저장 디렉토리
RUN mkdir -p /app/apps/backend/data

EXPOSE 4000

ENV PORT=4000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

CMD ["node", "apps/backend/dist/index.js"]
