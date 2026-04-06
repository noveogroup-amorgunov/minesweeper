# Specification: Save and Load Game (OPFS)

## 1. Overview

Save and load game state functionality using Origin Private File System (OPFS). The game is saved to a single fixed file without user-defined name or location.

## 2. Save File Format

### 2.1 File Structure

Binary format with JSON header:

```
┌─────────────────────────────────────────────────────────────────┐
│  Magic Header (8 bytes)                                         │
│  "MINESWP" (0x4D 0x49 0x4E 0x45 0x53 0x57 0x50 0x00)           │
├─────────────────────────────────────────────────────────────────┤
│  Version (1 byte)                                               │
│  0x01 - current format version                                  │
├─────────────────────────────────────────────────────────────────┤
│  Header Length (4 bytes, uint32, little-endian)                 │
│  JSON header length in bytes                                    │
├─────────────────────────────────────────────────────────────────┤
│  JSON Header (UTF-8 encoded)                                    │
│  {"width":10000,"height":10000,...}                            │
├─────────────────────────────────────────────────────────────────┤
│  Board Data (Uint8Array)                                        │
│  Raw bytes from _uInt8Array (width * height bytes)             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 JSON Header Schema

```typescript
interface SaveFileHeader {
  // Format version
  version: string // "1.0"

  // Save timestamp (ISO 8601)
  savedAt: string // "2024-01-15T10:30:00.000Z"

  // Board parameters
  width: number // Board width (e.g., 10000)
  height: number // Board height (e.g., 10000)
  minesNum: number // Total mines count

  // Game state
  minesLeft: number // Remaining unflagged mines
  tilesLeft: number // Rem unrevealed tiles
  gameTimeSeconds: number // Elapsed time in seconds
  gameStatus: 'PLAYING' | 'DEAD' | 'WIN' // Current status

  // View position
  offsetX: number // Viewport X coordinate
  offsetY: number // Viewport Y coordinate

  // Internal state
  userDidFirstMove: boolean // Whether first move was made
  emptyTileIndex: number // Empty tile index (for first move swap)
}
```

### 2.3 Example JSON Header

```json
{
  "version": "1.0",
  "savedAt": "2024-01-15T10:30:00.000Z",
  "width": 10000,
  "height": 10000,
  "minesNum": 1000000,
  "minesLeft": 999985,
  "tilesLeft": 98999991,
  "gameTimeSeconds": 245,
  "gameStatus": "PLAYING",
  "offsetX": 4950,
  "offsetY": 5023,
  "userDidFirstMove": true,
  "emptyTileIndex": 52341234
}
```

## 3. SaveManager API

### 3.1 SaveManager Class

```typescript
class SaveManager {
  constructor(options?: { slotId?: string })

  // Core methods
  save(gameState: GameStateSnapshot): Promise<void>
  load(): Promise<GameStateSnapshot | null>
  hasSave(): Promise<boolean>
  deleteSave(): Promise<void>

  // Slot support (for future multi-slot feature)
  getCurrentSlot(): string
  setSlot(slotId: string): void
  getAvailableSlots(): Promise<string[]>
}
```

**Note:** Current implementation uses single slot (`"default"`). Architecture supports multiple slots for future enhancement.

### 3.2 Save File Naming

- **Current:** `savegame.dat` (single file)
- **Future (multi-slot):** `savegame-{slotId}.dat`

### 3.3 Save Method

**`save(gameState): Promise<void>`**

**Conditions:**
- Only available if `gameStatus` ∈ ['PLAYING', 'DEAD', 'WIN']
- If `gameStatus` ∈ ['READY', 'PENDING'] — no-op, returns resolved Promise

**Algorithm:**
1. Check `gameStatus` — exit if not applicable
2. Create JSON header from current state
3. Serialize header to UTF-8 bytes
4. Create combined ArrayBuffer: magic (8) + version (1) + headerLength (4) + headerBytes + boardBytes
5. Get OPFS root directory access
6. Create/overwrite file `savegame.dat`
7. Write data atomically
8. Close file handle

**Errors:**
- `DOMException` — OPFS access issues
- `QuotaExceededError` — insufficient storage
- Any error is propagated to caller

### 3.4 Load Method

**`load(): Promise<GameStateSnapshot | null>`**

**Returns:**
- `GameStateSnapshot` — loaded game state
- `null` — save file not found

**Algorithm:**
1. Get OPFS root directory access
2. Try to get file handle for `savegame.dat`
3. If file not found — return `null`
4. Get File object
5. Read entire file as ArrayBuffer
6. Validate magic header
7. Check version (only 0x01 supported)
8. Read header length
9. Deserialize JSON header
10. Validate header:
    - All required fields present
    - Board data size matches width * height
    - gameStatus is valid value
11. Return `GameStateSnapshot` with header + board data

**Errors:**
- `SaveFileCorruptedError` — invalid magic header or invalid JSON
- `SaveVersionError` — unsupported save file version
- `SaveValidationError` — size or data mismatch

### 3.5 Has Save Method

**`hasSave(): Promise<boolean>`**

**Returns:**
- `true` — file exists
- `false` — file not found or OPFS unavailable

**Usage:**
- UI: enable/disable "Load game" menu item
- Does not throw on OPFS errors

### 3.6 Error Types

```typescript
class SaveFileError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'SaveFileError'
  }
}

class SaveFileCorruptedError extends SaveFileError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'SaveFileCorruptedError'
  }
}

class SaveVersionError extends SaveFileError {
  constructor(public readonly version: number) {
    super(`Unsupported save file version: ${version}`)
    this.name = 'SaveVersionError'
  }
}

class SaveValidationError extends SaveFileError {
  constructor(message: string) {
    super(message)
    this.name = 'SaveValidationError'
  }
}
```

## 4. UI Changes

### 4.1 File Menu Structure

Current menu:
```
File
├── New game
├── Settings
├── Toggle debug info
└── Turn on/off react-scan
```

New menu:
```
File
├── New game
├── Save game          [disabled if: gameStatus ∈ ['READY', 'PENDING']]
├── Load game          [disabled if: no save exists]
├── ────────────────── (separator)
├── Settings
├── Toggle debug info
└── Turn on/off react-scan
```

**Note:** Separator is placed below Save/Load items.

### 4.2 Menu Item Behavior

**Save game:**
- **Disabled when:** `gameStatus === 'PENDING' || gameStatus === 'READY'`
- **Action:** Show confirmation dialog if save already exists
- **Success:** Close menu
- **Error:** Show error modal

**Load game:**
- **Disabled when:** `!hasSave()` (checked at app startup and cached)
- **Action:**
  1. Check current `gameStatus`
  2. If `gameStatus === 'PLAYING'` — show confirmation dialog
  3. On confirm — call `gameEngine.load()`
- **Success:** Close menu, game loaded
- **Error:** Show error modal

### 4.3 Confirmation Dialog: Overwrite Save

**Shown when:** User clicks "Save game" and file already exists

**Text:**
```
┌─────────────────────────────┐
│  ?                 [_][X]   │
├─────────────────────────────┤
│                             │
│  Overwrite saved game?      │
│                             │
│  Existing save will be      │
│  replaced.                  │
│                             │
│       [Cancel]  [Save]      │
│                             │
└─────────────────────────────┘
```

**Buttons:**
- Cancel — close dialog, stay in menu
- Save — proceed with save

### 4.4 Confirmation Dialog: Load Game

**Shown when:** User clicks "Load game" with active 'PLAYING' game

**Text:**
```
┌─────────────────────────────┐
│  ?                 [_][X]   │
├─────────────────────────────┤
│                             │
│  Load saved game?           │
│                             │
│  Current game progress      │
│  will be lost.              │
│                             │
│       [Cancel]  [Load]      │
│                             │
└─────────────────────────────┘
```

**Buttons:**
- Cancel — close dialog, stay in menu
- Load — proceed with load

### 4.5 Error Modal

**Component:**
```tsx
<Modal>
  <WindowHeader>Error</WindowHeader>
  <WindowContent>{errorMessage}</WindowContent>
  <Button onClick={closeModal}>OK</Button>
</Modal>
```

**Error Messages:**

| Error | User Message |
|-------|--------------|
| `SaveFileCorruptedError` | "Save file is corrupted or invalid." |
| `SaveVersionError` | "Save file version is not supported. Please update the game." |
| `SaveValidationError` | "Save file data is invalid." |
| `QuotaExceededError` | "Not enough storage space to save the game." |
| `SecurityError` | "Browser storage access denied." |
| Generic error | "Failed to save/load game. Please try again." |

## 5. Auto-Save on Tab Close

### 5.1 Behavior

Game is automatically saved when user closes the tab or navigates away.

**Implementation:**
```typescript
window.addEventListener('beforeunload', (event) => {
  if (gameStatus === 'PLAYING') {
    // Synchronous save required for beforeunload
    // Note: OPFS is async, so we use sync alternative or accept potential data loss
    // Best effort: trigger async save and hope it completes
    gameEngine.save().catch(() => {
      // Silent fail — browser is closing
    })
  }
})
```

**Limitations:**
- OPFS operations are asynchronous
- `beforeunload` handler should not be async
- **Best effort approach:** Trigger save, accept potential race condition
- Modern browsers may not wait for async operations

### 5.2 Alternative: Visibility API

For more reliable auto-save:
```typescript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && gameStatus === 'PLAYING') {
    gameEngine.save().catch(() => {
      // Silent fail
    })
  }
})
```

**Priority:** Use both `beforeunload` and `visibilitychange` for maximum coverage.

### 5.3 Visual Indicator

Show brief indicator when auto-save occurs:
```
┌─────────────────┐
│ Game saved ✓    │
└─────────────────┘
```

Auto-dismiss after 2 seconds.

## 6. Security and Edge Cases

### 6.1 Browser Support

**OPFS Check:**
```typescript
const isOPFSSupported
  = typeof navigator !== 'undefined'
    && 'storage' in navigator
    && 'getDirectory' in navigator.storage
```

**Behavior if not supported:**
- "Save game" and "Load game" menu items are hidden
- Or disabled with tooltip: "Not supported in your browser"

**Supported Browsers:**
- Chrome 86+
- Edge 86+
- Safari 15.2+ (partial)
- Firefox 111+ (partial)

### 6.2 Private/Incognito Mode

**Issue:** OPFS may be restricted or cleared on session end in some browsers.

**Solution:**
- Same checks via `hasSave()`
- Handle `SecurityError` on access

### 6.3 Storage Quota

**File size for max board (10,000×10,000):**
- Header: ~500 bytes
- Board data: 100,000,000 bytes (100 MB)
- Total: ~100 MB

**Behavior:**
- Catch `QuotaExceededError`
- Notify user about insufficient space

### 6.4 Corrupted Files

**Scenarios:**
- Interrupted write
- Manual file editing
- Version incompatibility

**Handling:**
- Magic header for quick integrity check
- JSON schema validation
- Board buffer size checked against width × height

### 6.5 Concurrent Access

**Issue:** Two tabs may attempt to read/write same file.

**Solution:**
- OPFS atomic writes via `createWritable()` + `write()` + `close()`
- Reads are always consistent (snapshot at `getFile()`)

## 7. Performance

### 7.1 Save Performance

| Board Size | Save Time | Memory |
|-----------|-----------|--------|
| 100×100 | <10ms | 10KB |
| 1000×1000 | 50-100ms | 1MB |
| 10000×10000 | 500-1000ms | 100MB |

**Optimizations:**
- Use `FileSystemWritableFileStream` for streaming write
- Non-blocking UI — async method

### 7.2 Load Performance

| Board Size | Load Time | Memory |
|-----------|-----------|--------|
| 100×100 | <10ms | 10KB |
| 1000×1000 | 30-50ms | 1MB |
| 10000×10000 | 200-500ms | 100MB |

**Optimizations:**
- Read via `file.arrayBuffer()` (zero-copy where possible)
- Reuse existing buffer/view if size matches

## 8. Testing

### 8.1 Unit Tests (SaveManager)

```typescript
describe('SaveManager', () => {
  it('should save and load game state', async () => {
    const manager = new SaveManager()
    const state = createTestGameState()

    await manager.save(state)
    const loaded = await manager.load()

    expect(loaded).toEqual(state)
  })

  it('should return null when no save exists', async () => {
    const manager = new SaveManager()
    const loaded = await manager.load()
    expect(loaded).toBeNull()
  })

  it('should throw on corrupted save file', async () => {
    writeCorruptedFile()
    const manager = new SaveManager()
    await expect(manager.load()).rejects.toThrow(SaveFileCorruptedError)
  })

  it('should support slot switching', async () => {
    const manager = new SaveManager({ slotId: 'slot1' })
    await manager.save(state1)

    manager.setSlot('slot2')
    await manager.save(state2)

    manager.setSlot('slot1')
    const loaded1 = await manager.load()
    expect(loaded1).toEqual(state1)

    manager.setSlot('slot2')
    const loaded2 = await manager.load()
    expect(loaded2).toEqual(state2)
  })
})
```

### 8.2 Integration Tests

- Full cycle: create game → save → load → verify state
- Verify timer restoration after load
- Verify viewport position restoration
- Verify auto-save on tab close

### 8.3 E2E Tests

- UI: click Save → confirm overwrite → verify file created
- UI: click Load → confirm dialog → verify game restored
- UI: error modal display on save/load failure

## 9. Future Enhancements (Not in Current Implementation)

### 9.1 Multiple Save Slots

**Architecture already supports:**
- `SaveManager` accepts `slotId` parameter
- File naming: `savegame-{slotId}.dat`

**UI Changes Needed:**
- "Save As..." dialog
- Slot selection UI
- Delete slot button
- Slot metadata (name, timestamp, preview)

### 9.2 Compression

- deflate/gzip for board data
- ~80% size reduction for sparse boards

### 9.3 Export/Import

- Save to Downloads (File System Access API)
- Import from user-selected file
- Cross-browser save portability

## 10. Migration

On format version change:

1. Increment version number in header
2. Add migration code:
```typescript
if (header.version === '1.0') {
  // migrate to 2.0
}
```
3. Or reject load with update message

## 11. File Structure

### 11.1 New Files

```
src/
  engine/
    SaveManager.ts           # OPFS logic
    SaveManager.spec.ts      # Tests
    errors.ts                # Error classes
    types.ts                 # Save-related types
  view/
    game/
      SaveLoadDialog.tsx     # Confirmation dialogs
      ErrorDialog.tsx        # Error display
      AutoSaveIndicator.tsx  # Auto-save notification
```

### 11.2 Modified Files

```
src/
  engine/
    GameEngine.ts            # Integrate SaveManager
  view/
    game/
      GameView.tsx           # Add menu items
    App.tsx                  # Add auto-save listeners
```

## 12. Implementation Notes

### 12.1 GameEngine Integration

```typescript
class GameEngine {
  private saveManager: SaveManager

  constructor(options: { scheduler: AbstractScheduler, saveManager?: SaveManager }) {
    this.scheduler = options.scheduler
    this.saveManager = options.saveManager || new SaveManager()
    // ...
  }

  async save(): Promise<void> {
    if (!this.canSave())
      return

    const snapshot = this.createSnapshot()
    await this.saveManager.save(snapshot)
  }

  async load(): Promise<boolean> {
    const snapshot = await this.saveManager.load()
    if (!snapshot)
      return false

    this.restoreFromSnapshot(snapshot)
    return true
  }

  async hasSave(): Promise<boolean> {
    return this.saveManager.hasSave()
  }

  private createSnapshot(): GameStateSnapshot {
    return {
      width: this._width,
      height: this._height,
      minesNum: this._minesNum,
      minesLeft: this._minesLeft,
      tilesLeft: this._tilesLeft,
      gameTimeSeconds: this._gameTimeSeconds,
      gameStatus: this.gameStatus,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      userDidFirstMove: this._userDidFirstMove,
      emptyTileIndex: this._emptyTileIndex,
      boardData: new Uint8Array(this._boardBuffer),
    }
  }

  private restoreFromSnapshot(snapshot: GameStateSnapshot): void {
    // Stop current timer
    clearTimeout(this._gameTimeoutId!)
    this._gameTimeoutId = null

    // Clear scheduler
    this.scheduler.clear()

    // Restore fields
    this._width = snapshot.width
    this._height = snapshot.height
    this._minesNum = snapshot.minesNum
    this._minesLeft = snapshot.minesLeft
    this._tilesLeft = snapshot.tilesLeft
    this._gameTimeSeconds = snapshot.gameTimeSeconds
    this.gameStatus = snapshot.gameStatus
    this.offsetX = snapshot.offsetX
    this.offsetY = snapshot.offsetY
    this._userDidFirstMove = snapshot.userDidFirstMove
    this._emptyTileIndex = snapshot.emptyTileIndex

    // Restore board
    this._boardBuffer = snapshot.boardData.buffer.slice(
      snapshot.boardData.byteOffset,
      snapshot.boardData.byteOffset + snapshot.boardData.byteLength
    )
    this._uInt8Array = new Uint8Array(this._boardBuffer)

    // Restart timer if playing
    if (this.gameStatus === 'PLAYING') {
      this.runGameLoopTimer()
    }

    // Update view
    this.updateVisibleBoard()
  }
}
```

### 12.2 Usage Example

```typescript
// In GameView.tsx
const [hasSaveFile, setHasSaveFile] = useState(false)
const [showOverwriteDialog, setShowOverwriteDialog] = useState(false)
const [showLoadDialog, setShowLoadDialog] = useState(false)
const [errorMessage, setErrorMessage] = useState<string | null>(null)

// Check for save on mount
useEffect(() => {
  gameEngine.hasSave().then(setHasSaveFile)
}, [gameEngine])

async function handleSaveGame() {
  const hasExisting = await gameEngine.hasSave()
  if (hasExisting) {
    setShowOverwriteDialog(true)
    return
  }
  await performSave()
}

async function performSave() {
  try {
    await gameEngine.save()
    setHasSaveFile(true)
    setOpen(false)
    setShowOverwriteDialog(false)
  }
  catch (error) {
    setErrorMessage(getErrorMessage(error))
  }
}

function handleLoadGame() {
  if (gameStatus === 'PLAYING') {
    setShowLoadDialog(true)
  }
  else {
    performLoad()
  }
}

async function performLoad() {
  try {
    const loaded = await gameEngine.load()
    if (loaded) {
      setOpen(false)
      setShowLoadDialog(false)
    }
    else {
      setErrorMessage('No saved game found')
    }
  }
  catch (error) {
    setErrorMessage(getErrorMessage(error))
  }
}
```

## 13. Binary Format Reference

### 13.1 Magic Header
- Bytes: `0x4D 0x49 0x4E 0x45 0x53 0x57 0x50 0x00`
- ASCII: `"MINESWP\0"`

### 13.2 File Layout

```
Offset  Size  Description
─────────────────────────────────
0       8     Magic header
8       1     Version (0x01)
9       4     Header length (uint32, little-endian)
13      N     JSON header (UTF-8, N = header length)
13+N    M     Board data (M = width × height)
```

### 13.3 Endianness
- All numeric fields: little-endian
- JSON: UTF-8 encoded

### 13.4 Example Hex Dump

```
0000: 4D 49 4E 45 53 57 50 00 01 5A 00 00 00 7B 22 76  MINESWP..Z...{"v
0010: 65 72 73 69 6F 6E 22 3A 22 31 2E 30 22 2C 22 73  ersion":"1.0","s
0020: 61 76 65 64 41 74 22 3A 2E 2E 2E 7D 00 00 00 00  avedAt":...}....
```
