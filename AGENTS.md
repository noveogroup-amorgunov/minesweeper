# Agent Guide

Minesweeper game with a 10000x10000 field (10⁸ tiles) on React.

## Commands

- `pnpm dev` - Start dev server
- `pnpm tests` - Run tests
- `pnpm lint:fix` - Run eslint with autofix mode
- `pnpm lint:types` - Check TypeScript types

## Rules

- After you finish write code ALWAYS check types (`pnpm lint:types`), lint (`pnpm lint:fix`) and run tests (`pnpm tests`)

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
- **Deterministic Generation**: Supports seeded generation using cyrb128 + sfc32 PRNG for multiplayer

### Field Generation Modes

Two generation modes supported:

1. **Random Mode** (`mode: 'random'`): Uses `Math.random()` for field generation
2. **Seeded Mode** (`mode: 'seeded'`): Uses deterministic PRNG from a seed string

```typescript
// Random mode (default)
const engine = new GameEngine({ mode: 'random', scheduler })

// Seeded mode for multiplayer
const engine = new GameEngine({ mode: 'seeded', scheduler })
const roomId = engine.getSeed() // Auto-generated Base62 ID
```

### PRNG Implementation

The deterministic generator uses:
- **cyrb128**: String hashing to 128-bit state (4 x 32-bit numbers)
- **sfc32**: Small Fast Counter 32-bit PRNG

```typescript
// src/engine/generateMines.ts
export function createSeededRandom(seed: string): () => number
export function generateMines(
  array: Uint8Array,
  minesNum: number,
  random?: () => number // Optional custom generator
): number
```

### Room ID Format

- Base62 alphabet: `0-9a-zA-Z` (62 characters)
- Default length: 10 characters
- Generated using `crypto.getRandomValues()` for cryptographic security
- Collision probability: ~1.5% for 100 IDs with 10 characters

## Critical Implementation Details

### Import Order Matters

In `main.tsx`, `initReactScan` MUST be imported first:

```typescript
// WARNING: initReactScan must be imported first
import { initReactScan } from './view/reactScan'
```

### Safari Polyfills Required

`requestIdleCallback` and `scheduler` APIs are not supported in Safari. Polyfills loaded in:
- `src/core/requestIdleCallback.ts` — polyfills `requestIdleCallback`
- `src/core/Scheduler.ts` vs `Scheduler_navite.ts` — runtime detection in `App.tsx`

### Testing

- Framework: **Vitest** (not Jest)
- Test files:
  - `src/core/PubSub.spec.ts` — PubSub tests
  - `src/engine/generateMines.spec.ts` — PRNG and mine generation tests
  - `src/engine/GameEngine.spec.ts` — GameEngine tests
  - `src/engine/integration.spec.ts` — Integration tests
  - `src/engine/SaveManager.spec.ts` — Save/Load tests
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
