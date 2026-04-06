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
// Host creates a game with auto-generated seed
const hostEngine = new GameEngine({
  width: 100,
  height: 100,
  minesNum: 1000,
  mode: 'seeded', // Uses deterministic generation
  scheduler: new Scheduler(),
})

const roomId = hostEngine.getSeed() // e.g., "aB3xK9mP2q"
// Share roomId with other players

// Client joins with the same seed
const clientEngine = new GameEngine({
  width: 100,
  height: 100,
  minesNum: 1000,
  mode: 'seeded',
  scheduler: new Scheduler(),
})
// Manually set the same seed (for clients)
clientEngine.restart() // Would need to pass seed somehow
```

### Room ID Format

Room IDs are generated using `crypto.getRandomValues` for cryptographic security:
- Format: Base62 (0-9, a-z, A-Z)
- Length: 10-12 characters (default: 10)
- Example: `aB3xK9mP2q`

```typescript
// Generate custom room ID
const roomId = GameEngine.generateRoomId(12) // 12 characters
```

### Low-level API

```typescript
import { createSeededRandom, generateMines } from './engine/generateMines'

// Create deterministic generator
const random = createSeededRandom('my-seed')

// Generate field
const array = new Uint8Array(100)
const emptyTileIndex = generateMines(array, 10, random)

// Same seed = same field every time
```
