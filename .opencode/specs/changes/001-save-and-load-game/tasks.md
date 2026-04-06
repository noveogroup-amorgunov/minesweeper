# Tasks: Save and Load Game Implementation

## Phase 1: Foundation

### Task 1.1: Create Error Classes
**File:** `src/engine/errors.ts`
**Description:** Create error classes for save/load operations
**Acceptance Criteria:**
- [ ] `SaveFileError` base class
- [ ] `SaveFileCorruptedError` for invalid/corrupted files
- [ ] `SaveVersionError` for unsupported versions
- [ ] `SaveValidationError` for data validation failures
- [ ] All classes extend Error with proper name and message

**Estimation:** 30 min

---

### Task 1.2: Create Types for Save System
**File:** `src/engine/types.ts` (or extend existing)
**Description:** Define TypeScript interfaces for save state
**Acceptance Criteria:**
- [ ] `SaveFileHeader` interface with all required fields
- [ ] `GameStateSnapshot` interface (includes header + board data)
- [ ] `SaveManagerOptions` interface (for slot support)
- [ ] All types properly exported

**Estimation:** 20 min

---

### Task 1.3: Create SaveManager Class - Basic Structure
**File:** `src/engine/SaveManager.ts`
**Description:** Create SaveManager class with constructor and basic methods
**Acceptance Criteria:**
- [ ] Class `SaveManager` exported
- [ ] Constructor accepts optional `{ slotId?: string }`
- [ ] Private method `getFileName()` returns `savegame.dat` (or with slot suffix)
- [ ] Private method `getOPFSRoot()` handles OPFS access
- [ ] Constant `CURRENT_VERSION = 0x01`
- [ ] Constant `MAGIC_HEADER` bytes

**Estimation:** 30 min

---

### Task 1.4: Implement SaveManager.save() Method
**File:** `src/engine/SaveManager.ts`
**Description:** Implement game state serialization and saving to OPFS
**Acceptance Criteria:**
- [ ] Accept `GameStateSnapshot` parameter
- [ ] Serialize header to JSON
- [ ] Create binary format: magic (8) + version (1) + headerLength (4) + headerBytes + boardBytes
- [ ] Use OPFS to write file atomically
- [ ] Handle `QuotaExceededError` specifically
- [ ] All errors wrapped in appropriate error classes

**Estimation:** 1.5 hours

---

### Task 1.5: Implement SaveManager.load() Method
**File:** `src/engine/SaveManager.ts`
**Description:** Implement game state deserialization from OPFS
**Acceptance Criteria:**
- [ ] Returns `Promise<GameStateSnapshot | null>`
- [ ] Returns `null` if file not found
- [ ] Validate magic header, throw `SaveFileCorruptedError` if invalid
- [ ] Check version, throw `SaveVersionError` if unsupported
- [ ] Parse JSON header, throw `SaveFileCorruptedError` if invalid JSON
- [ ] Validate header fields, throw `SaveValidationError` if invalid
- [ ] Extract board data from remaining bytes
- [ ] Return complete `GameStateSnapshot`

**Estimation:** 1.5 hours

---

### Task 1.6: Implement SaveManager.hasSave() Method
**File:** `src/engine/SaveManager.ts`
**Description:** Check if save file exists
**Acceptance Criteria:**
- [ ] Returns `Promise<boolean>`
- [ ] Returns `false` if file not found
- [ ] Returns `false` on any error (graceful degradation)
- [ ] Does not throw exceptions

**Estimation:** 30 min

---

### Task 1.7: Unit Tests for SaveManager
**File:** `src/engine/SaveManager.spec.ts`
**Description:** Write comprehensive unit tests
**Acceptance Criteria:**
- [ ] Test `save()` saves file correctly
- [ ] Test `load()` returns correct state after save
- [ ] Test `load()` returns `null` when no file exists
- [ ] Test `hasSave()` returns correct boolean
- [ ] Test corrupted magic header throws `SaveFileCorruptedError`
- [ ] Test invalid JSON throws `SaveFileCorruptedError`
- [ ] Test unsupported version throws `SaveVersionError`
- [ ] Test validation errors throw `SaveValidationError`
- [ ] Mock OPFS for tests (or use vitest mocks)

**Estimation:** 2 hours

---

## Phase 2: GameEngine Integration

### Task 2.1: Add SaveManager to GameEngine
**File:** `src/engine/GameEngine.ts`
**Description:** Integrate SaveManager into GameEngine
**Acceptance Criteria:**
- [ ] Import `SaveManager` and error classes
- [ ] Add private `saveManager: SaveManager` field
- [ ] Accept optional `saveManager` in constructor
- [ ] Create default `SaveManager` if not provided
- [ ] No breaking changes to existing GameEngine API

**Estimation:** 30 min

---

### Task 2.2: Implement GameEngine.createSnapshot()
**File:** `src/engine/GameEngine.ts`
**Description:** Create method to extract current state for saving
**Acceptance Criteria:**
- [ ] Private method `createSnapshot(): GameStateSnapshot`
- [ ] Include all fields from `SaveFileHeader`
- [ ] Include board data as `Uint8Array` copy
- [ ] Properly copy all game state fields

**Estimation:** 30 min

---

### Task 2.3: Implement GameEngine.save() Public Method
**File:** `src/engine/GameEngine.ts`
**Description:** Public API for saving game
**Acceptance Criteria:**
- [ ] Public async method `save(): Promise<void>`
- [ ] Check `canSave()` — only allow if gameStatus ∈ ['PLAYING', 'DEAD', 'WIN']
- [ ] No-op if cannot save (resolve immediately)
- [ ] Call `createSnapshot()` and pass to `saveManager.save()`
- [ ] Propagate errors to caller

**Estimation:** 20 min

---

### Task 2.4: Implement GameEngine.restoreFromSnapshot()
**File:** `src/engine/GameEngine.ts`
**Description:** Restore game state from loaded snapshot
**Acceptance Criteria:**
- [ ] Private method `restoreFromSnapshot(snapshot: GameStateSnapshot): void`
- [ ] Stop current timer (`clearTimeout`)
- [ ] Clear scheduler (`scheduler.clear()`)
- [ ] Restore all game fields from snapshot
- [ ] Restore `_boardBuffer` and `_uInt8Array` from board data
- [ ] Restart timer if `gameStatus === 'PLAYING'`
- [ ] Call `updateVisibleBoard()`

**Estimation:** 40 min

---

### Task 2.5: Implement GameEngine.load() Public Method
**File:** `src/engine/GameEngine.ts`
**Description:** Public API for loading game
**Acceptance Criteria:**
- [ ] Public async method `load(): Promise<boolean>`
- [ ] Call `saveManager.load()` to get snapshot
- [ ] Return `false` if no save exists (snapshot is null)
- [ ] Call `restoreFromSnapshot()` with loaded data
- [ ] Return `true` on success
- [ ] Propagate errors to caller

**Estimation:** 20 min

---

### Task 2.6: Implement GameEngine.hasSave() Public Method
**File:** `src/engine/GameEngine.ts`
**Description:** Public API to check for existing save
**Acceptance Criteria:**
- [ ] Public async method `hasSave(): Promise<boolean>`
- [ ] Delegate to `saveManager.hasSave()`

**Estimation:** 10 min

---

### Task 2.7: Integration Tests
**File:** `src/engine/GameEngine.spec.ts` (or extend existing)
**Description:** Test save/load integration with GameEngine
**Acceptance Criteria:**
- [ ] Test save/load roundtrip preserves game state
- [ ] Test timer restoration after load
- [ ] Test viewport position restoration
- [ ] Test `hasSave()` returns true after save
- [ ] Test `load()` returns false when no save
- [ ] Test save is no-op when game not started

**Estimation:** 1.5 hours

---

## Phase 3: UI Components

### Task 3.1: Create ErrorDialog Component
**File:** `src/view/game/ErrorDialog.tsx`
**Description:** Modal dialog for displaying errors
**Acceptance Criteria:**
- [ ] Use react95 components: `Modal`, `Window`, `WindowHeader`, `WindowContent`, `Button`
- [ ] Props: `message: string`, `isOpen: boolean`, `onClose: () => void`
- [ ] Display error message in centered text
- [ ] Single "OK" button to close
- [ ] Proper styling consistent with app theme

**Estimation:** 30 min

---

### Task 3.2: Create ConfirmationDialog Component
**File:** `src/view/game/ConfirmationDialog.tsx`
**Description:** Reusable confirmation dialog
**Acceptance Criteria:**
- [ ] Use react95 components
- [ ] Props: `title: string`, `message: string`, `isOpen: boolean`, `onConfirm: () => void`, `onCancel: () => void`, `confirmText?: string`, `cancelText?: string`
- [ ] Two buttons: Cancel (left) and Confirm (right)
- [ ] Window header with title and icon (optional)
- [ ] Proper styling

**Estimation:** 30 min

---

### Task 3.3: Create AutoSaveIndicator Component
**File:** `src/view/game/AutoSaveIndicator.tsx`
**Description:** Brief notification for auto-save events
**Acceptance Criteria:**
- [ ] Props: `visible: boolean`
- [ ] Small overlay/banner with "Game saved ✓" text
- [ ] Auto-hide after 2 seconds (use `useEffect` with timer)
- [ ] Position: bottom-right or top-right corner
- [ ] Use react95 styling (Frame, Button, or custom)

**Estimation:** 30 min

---

## Phase 4: GameView Integration

### Task 4.1: Update GameView State for Save/Load
**File:** `src/view/game/GameView.tsx`
**Description:** Add state management for save/load UI
**Acceptance Criteria:**
- [ ] Add `hasSaveFile` state (boolean)
- [ ] Add `showOverwriteDialog` state (boolean)
- [ ] Add `showLoadDialog` state (boolean)
- [ ] Add `errorMessage` state (string | null)
- [ ] Add `showAutoSaveIndicator` state (boolean)
- [ ] Check `hasSave()` on mount using `useEffect`

**Estimation:** 20 min

---

### Task 4.2: Add Save/Load Menu Items
**File:** `src/view/game/GameView.tsx`
**Description:** Add Save game and Load game to File menu
**Acceptance Criteria:**
- [ ] Add "Save game" `MenuListItem` after "New game"
- [ ] Add "Load game" `MenuListItem` after "Save game"
- [ ] Add separator (`<Separator />` or styled div) after "Load game"
- [ ] "Save game" disabled when `gameStatus` ∈ ['READY', 'PENDING']
- [ ] "Load game" disabled when `!hasSaveFile`
- [ ] Click handlers defined (implementation in next task)

**Estimation:** 30 min

---

### Task 4.3: Implement Save Game Handler
**File:** `src/view/game/GameView.tsx`
**Description:** Handle Save game menu click
**Acceptance Criteria:**
- [ ] `handleSaveGame()` async function
- [ ] Check if save exists using `hasSave()`
- [ ] If exists: show overwrite confirmation dialog
- [ ] If not exists: proceed with save directly
- [ ] On success: close menu, update `hasSaveFile` state
- [ ] On error: show error dialog with message

**Estimation:** 30 min

---

### Task 4.4: Implement Load Game Handler
**File:** `src/view/game/GameView.tsx`
**Description:** Handle Load game menu click
**Acceptance Criteria:**
- [ ] `handleLoadGame()` function
- [ ] If `gameStatus === 'PLAYING'`: show load confirmation dialog
- [ ] If not playing: proceed with load directly
- [ ] On confirm: call `gameEngine.load()`
- [ ] On success: close menu
- [ ] On error: show error dialog
- [ ] Handle `load()` returning false (no save)

**Estimation:** 30 min

---

### Task 4.5: Add Dialog Components to GameView
**File:** `src/view/game/GameView.tsx`
**Description:** Render confirmation and error dialogs
**Acceptance Criteria:**
- [ ] Import `ConfirmationDialog` and `ErrorDialog`
- [ ] Render overwrite confirmation dialog (conditional)
- [ ] Render load confirmation dialog (conditional)
- [ ] Render error dialog (conditional)
- [ ] Proper prop passing for all dialogs

**Estimation:** 30 min

---

## Phase 5: Auto-Save

### Task 5.1: Add Auto-Save Hook
**File:** `src/view/useAutoSave.ts` (or in `App.tsx`)
**Description:** Hook to handle auto-save on tab close/visibility change
**Acceptance Criteria:**
- [ ] Hook `useAutoSave(gameEngine: GameEngine)`
- [ ] Add `beforeunload` event listener
- [ ] Add `visibilitychange` event listener
- [ ] Trigger save when `visibilityState === 'hidden'` or `beforeunload`
- [ ] Only save if `gameStatus === 'PLAYING'`
- [ ] Silent fail on errors (don't block tab close)
- [ ] Return `triggerAutoSave()` function for manual trigger
- [ ] Clean up listeners on unmount

**Estimation:** 40 min

---

### Task 5.2: Integrate Auto-Save into App
**File:** `src/App.tsx`
**Description:** Add auto-save functionality to app lifecycle
**Acceptance Criteria:**
- [ ] Import `useAutoSave` hook
- [ ] Call `useAutoSave(gameEngine)` in App component
- [ ] Import and render `AutoSaveIndicator` component
- [ ] Connect indicator visibility to auto-save trigger
- [ ] Briefly show indicator when auto-save completes

**Estimation:** 20 min

---

### Task 5.3: Connect Auto-Save Indicator to Save Method
**File:** `src/view/game/GameView.tsx` or `src/App.tsx`
**Description:** Show indicator when auto-save happens
**Acceptance Criteria:**
- [ ] Indicator shows when auto-save is triggered
- [ ] Indicator hides after 2 seconds
- [ ] Works for both programmatic and event-triggered saves

**Estimation:** 20 min

---

## Phase 7: Refactoring

### Task 7.1: Refactor SaveManager Architecture
**Files:** `src/engine/SaveManager.ts`, `src/engine/GameSaveManager.ts`, `src/core/OPFS.ts`
**Description:** Split SaveManager into abstract OPFS layer and game-specific implementation
**Acceptance Criteria:**
- [ ] Create `src/core/OPFS.ts` with abstract OPFS operations:
  - `writeFile(filename: string, data: ArrayBuffer): Promise<void>`
  - `readFile(filename: string): Promise<ArrayBuffer | null>`
  - `fileExists(filename: string): Promise<boolean>`
  - Proper error handling with custom error types
- [ ] Create `src/engine/GameSaveManager.ts` extending/ composing OPFS functionality:
  - Import and use `OPFS` for file operations
  - Keep game-specific logic: serialization format, header structure, validation
  - Keep `save()`, `load()`, `hasSave()` methods with same signatures
  - Handle game-specific errors (corrupted file, version mismatch, etc.)
- [ ] Refactor `src/engine/SaveManager.ts`:
  - Either convert to thin wrapper/alias for GameSaveManager
  - Or remove and update all imports to use GameSaveManager directly
- [ ] Update existing tests to work with new structure:
  - Mock OPFS layer for unit tests
  - Move SaveManager.spec.ts tests to appropriate locations
- [ ] Ensure no breaking changes to GameEngine API

**Estimation:** 2 hours

---

## Phase 6: Polish and Testing

### Task 6.1: Manual Testing Checklist
**Description:** Manual testing of complete feature
**Checklist:**
- [ ] Save game works from menu
- [ ] Load game works from menu
- [ ] Overwrite confirmation appears on second save
- [ ] Load confirmation appears with active game
- [ ] Error modal appears on OPFS failure (simulate by blocking storage)
- [ ] Auto-save triggers on tab close
- [ ] Auto-save indicator appears briefly
- [ ] Load game disabled when no save exists
- [ ] Save game disabled when game not started
- [ ] Game state fully restored after load (timer, board, viewport)
- [ ] Works in Chrome
- [ ] Works in Firefox (if OPFS supported)
- [ ] Graceful degradation when OPFS not supported

**Estimation:** 1 hour

---

### Task 6.2: Code Review and Cleanup
**Description:** Review and polish code
**Checklist:**
- [ ] All files pass `pnpm lint`
- [ ] No TypeScript errors
- [ ] Remove any `console.log` statements
- [ ] Add JSDoc comments to public methods
- [ ] Ensure consistent naming conventions
- [ ] Verify no memory leaks (event listeners cleaned up)

**Estimation:** 30 min

---

## Summary

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1: Foundation | 7 tasks | ~6.5 hours |
| Phase 2: GameEngine Integration | 7 tasks | ~4 hours |
| Phase 3: UI Components | 3 tasks | ~1.5 hours |
| Phase 4: GameView Integration | 5 tasks | ~2 hours |
| Phase 5: Auto-Save | 3 tasks | ~1.5 hours |
| Phase 6: Polish | 2 tasks | ~1.5 hours |
| Phase 7: Refactoring | 1 task | ~2 hours |
| **Total** | **28 tasks** | **~19 hours** |

## Dependencies

```
Task 1.1 → Task 1.2 → Task 1.3 → Task 1.4 → Task 1.5 → Task 1.6 → Task 1.7
                                                      ↓
Task 2.1 → Task 2.2 → Task 2.3 → Task 2.4 → Task 2.5 → Task 2.6 → Task 2.7
                                                      ↓
                              Task 3.1 → Task 3.2 → Task 3.3
                                       ↓
Task 4.1 → Task 4.2 → Task 4.3 → Task 4.4 → Task 4.5
    ↓
Task 5.1 → Task 5.2 → Task 5.3
    ↓
Task 6.1 → Task 6.2

Task 7.1 (can be done in parallel with Phase 6 or after)
```

## Notes

- Tasks within same phase can be done in parallel if multiple developers
- Phase 1 and Phase 3 are independent and can be done in parallel
- Phase 4 depends on both Phase 2 and Phase 3
- Phase 5 depends on Phase 4
- Phase 6 (testing) should be done after all other phases
- Phase 7 (refactoring) can be done in parallel with Phase 6 or after all other phases
