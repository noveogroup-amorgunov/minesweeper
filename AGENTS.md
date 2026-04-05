# Agent Guide

## Quick Start

```bash
# Use correct Node version (v22.14)
nvm use

# Install dependencies (use pnpm, not npm/yarn)
pnpm install

# Start dev server
pnpm dev

# Run tests
pnpm test

# Lint (auto-fixes on save via VSCode settings)
pnpm lint
```

## Architecture Overview

**Minesweeper with a 10,000×10,000 field** — uses virtualization and advanced browser APIs for performance.

```
src/
  core/          # PubSub, Scheduler (priority queue), polyfills
  engine/        # GameEngine, Web Worker for map generation
  view/          # React components (react95 UI library)
```

### Key Patterns

- **GameEngine**: PubSub pattern for state updates (`PubSub.ts`)
- **Scheduler**: Custom task scheduler with priority queue; falls back to native `scheduler.postTask` when available
- **Web Workers**: Map generation runs in worker (`GameWebWorker.ts`) using transferable ArrayBuffer
- **Binary Storage**: Board state stored in `ArrayBuffer`/`Uint8Array` (one byte per tile)
- **Virtual Grid**: Only visible tiles rendered via `VirtualGrid.tsx`

## Critical Implementation Details

### Import Order Matters

In `main.tsx`, `initReactScan` MUST be imported first:

```typescript
/* eslint-disable perfectionist/sort-imports */
// WARNING: initReactScan must be imported first
import { initReactScan } from './view/reactScan'
```

### Safari Polyfills Required

`requestIdleCallback` and `scheduler` APIs are not supported in Safari. Polyfills loaded in:
- `src/core/requestIdleCallback.ts` — polyfills `requestIdleCallback`
- `src/core/Scheduler.ts` vs `Scheduler_navite.ts` — runtime detection in `App.tsx`

### Testing

- Framework: **Vitest** (not Jest)
- Only test file: `src/core/PubSub.spec.ts`
- Run: `pnpm test`

### Linting & Formatting

- **ESLint only** — Prettier is explicitly disabled (see `.vscode/settings.json`)
- Uses `@antfu/eslint-config` — handles formatting via ESLint
- VSCode auto-fixes on save; manual run: `pnpm lint`

## Tech Stack Notes

- **React 19** (newest version, not 18)
- **pnpm** — lockfile present, do not use npm/yarn
- **Vite** with `@vitejs/plugin-react`
- **styled-components** + **react95** (Windows 95 UI theme)
- TypeScript with `ESNext` target, `react-jsx` transform
