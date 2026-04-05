import type { GameStatus } from './GameEngine'

/**
 * Save file header containing game metadata
 */
export interface SaveFileHeader {
  /** Format version */
  version: string
  /** Save timestamp (ISO 8601) */
  savedAt: string
  /** Board width */
  width: number
  /** Board height */
  height: number
  /** Total mines count */
  minesNum: number
  /** Remaining unflagged mines */
  minesLeft: number
  /** Unrevealed tiles count */
  tilesLeft: number
  /** Elapsed time in seconds */
  gameTimeSeconds: number
  /** Current game status */
  gameStatus: GameStatus
  /** Viewport X coordinate */
  offsetX: number
  /** Viewport Y coordinate */
  offsetY: number
  /** Whether first move was made */
  userDidFirstMove: boolean
  /** Empty tile index (for first move swap) */
  emptyTileIndex: number
}

/**
 * Complete game state snapshot for saving/loading
 */
export interface GameStateSnapshot {
  /** JSON header with metadata */
  header: SaveFileHeader
  /** Raw board data as Uint8Array */
  boardData: Uint8Array
}

/**
 * Options for SaveManager
 */
export interface SaveManagerOptions {
  /** Optional slot ID for multi-slot support */
  slotId?: string
}
