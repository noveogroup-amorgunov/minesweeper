# Architecture

## Multiplayer Mode (Seed-based Generation)

The game supports deterministic field generation using seeds, enabling multiplayer mode where all players can play on identical fields.

### Single Player (Random Mode)

```typescript
import { Scheduler } from './core/Scheduler'
import { GameEngine } from './engine/GameEngine'

const engine = new GameEngine({
  width: 100,
  height: 100,
  minesNum: 1000,
  mode: 'random', // Default - uses Math.random
  scheduler: new Scheduler(),
})
```

### Multiplayer (Seeded Mode)

```typescript
import { Scheduler } from './core/Scheduler'
import { GameEngine } from './engine/GameEngine'
import { generateRoomId } from './utils/generateRandomId'

// Host creates a game with generated room ID
const roomId = generateRoomId() // e.g., "aB3xK9mP2q"

const hostEngine = new GameEngine({
  width: 100,
  height: 100,
  minesNum: 1000,
  mode: 'seeded', // Uses deterministic generation
  scheduler: new Scheduler(),
  roomId, // Pass roomId explicitly
})

// Share roomId with other players

// Client joins with the same roomId
const clientEngine = new GameEngine({
  width: 100,
  height: 100,
  minesNum: 1000,
  mode: 'seeded',
  scheduler: new Scheduler(),
  roomId, // Same roomId = same field
})
```

### Room ID Format

Room IDs are generated using `crypto.getRandomValues` for cryptographic security:
- Format: Base62 (0-9, a-z, A-Z)
- Length: 10-12 characters (default: 10)
- Example: `aB3xK9mP2q`

```typescript
import { generateRandomId, generateRoomId } from './utils/generateRandomId'

// Generate room ID
const roomId = generateRoomId() // Default 10 characters
const longRoomId = generateRoomId(12) // 12 characters

// Generate any random ID
const randomId = generateRandomId(8) // 8 characters
```

### Low-level API

```typescript
import { generateMines } from './engine/generateMines'
import { createSeededRandom } from './utils/hashFunctions'

// Create deterministic generator
const random = createSeededRandom('my-seed')

// Generate field
const array = new Uint8Array(100)
const emptyTileIndex = generateMines(array, 10, random)

// Same seed = same field every time
```

### Hash Functions

The deterministic generator uses hash functions located in `src/utils/hashFunctions.ts`:
- **cyrb128**: String hashing to 128-bit state (4 x 32-bit numbers)
- **sfc32**: Small Fast Counter 32-bit PRNG

```typescript
import { createSeededRandom, cyrb128, sfc32 } from './utils/hashFunctions'

// Hash string to 128-bit state
const [a, b, c, d] = cyrb128('my-seed')

// Create PRNG from state
const random = sfc32(a, b, c, d)

// Or use the convenience function
const random2 = createSeededRandom('my-seed')
```

## Project Structure

```
src/
  core/          # PubSub, Scheduler (priority queue), polyfills
  engine/        # GameEngine, Web Worker for map generation
  utils/         # Utilities: hashFunctions, generateRandomId
  view/          # React components (react95 UI library)
```

### Key Patterns

- **GameEngine**: PubSub pattern for state updates (`PubSub.ts`)
- **Scheduler**: Custom task scheduler with priority queue
- **Web Workers**: Map generation runs in worker (`GameWebWorker.ts`)
- **Binary Storage**: Board state stored in `ArrayBuffer`/`Uint8Array`
- **Virtual Grid**: Only visible tiles rendered via `VirtualGrid.tsx`
- **Deterministic Generation**: Seeded generation using cyrb128 + sfc32 PRNG
