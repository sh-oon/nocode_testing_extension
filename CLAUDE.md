# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Yarn Berry (v4) monorepo boilerplate with TypeScript, Biome (linting/formatting), and Turbo (build system). The organization namespace is `@like-cake` (configurable via `yarn setup`).

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
