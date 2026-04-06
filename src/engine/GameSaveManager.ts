import type { GameStateSnapshot, SaveManagerOptions } from './types'
import { deleteFile, fileExists, listFiles, readFile, writeFile } from '../core/OPFS'
import { SaveFileCorruptedError, SaveFileError, SaveValidationError, SaveVersionError } from './errors'

/**
 * Magic header bytes: "MINESWP\0"
 */
const MAGIC_HEADER = new Uint8Array([0x4D, 0x49, 0x4E, 0x45, 0x53, 0x57, 0x50, 0x00])

/**
 * Current save file format version
 */
const CURRENT_VERSION = 0x01

/**
 * Default filename for save file
 */
const DEFAULT_FILENAME = 'savegame.dat'

/**
 * Text decoder/encoder for header serialization
 */
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/**
 * Manager for saving and loading game state to/from OPFS
 * Handles game-specific serialization format and validation
 */
export class GameSaveManager {
  private slotId: string

  constructor(options: SaveManagerOptions = {}) {
    this.slotId = options.slotId ?? 'default'
  }

  /**
   * Get the filename for the current slot
   */
  private getFileName(): string {
    if (this.slotId === 'default') {
      return DEFAULT_FILENAME
    }
    return `savegame-${this.slotId}.dat`
  }

  /**
   * Get current slot ID
   */
  getCurrentSlot(): string {
    return this.slotId
  }

  /**
   * Set current slot ID
   */
  setSlot(slotId: string): void {
    this.slotId = slotId
  }

  /**
   * Serialize game state to binary format
   * Format: magic (8) + version (1) + headerLength (4) + headerBytes + boardBytes
   */
  private serialize(gameState: GameStateSnapshot): ArrayBuffer {
    // Serialize header to JSON
    const headerJson = JSON.stringify(gameState.header)
    const headerBytes = textEncoder.encode(headerJson)

    // Calculate total size: magic (8) + version (1) + headerLength (4) + headerBytes + boardBytes
    const totalSize = 8 + 1 + 4 + headerBytes.length + gameState.boardData.length

    // Create combined buffer
    const buffer = new ArrayBuffer(totalSize)
    const view = new Uint8Array(buffer)
    let offset = 0

    // Write magic header
    view.set(MAGIC_HEADER, offset)
    offset += 8

    // Write version
    view[offset] = CURRENT_VERSION
    offset += 1

    // Write header length (4 bytes, little-endian)
    const headerLengthView = new DataView(buffer, offset, 4)
    headerLengthView.setUint32(0, headerBytes.length, true)
    offset += 4

    // Write header bytes
    view.set(headerBytes, offset)
    offset += headerBytes.length

    // Write board data
    view.set(gameState.boardData, offset)

    return buffer
  }

  /**
   * Deserialize binary data to game state snapshot
   * @throws SaveFileCorruptedError on invalid format
   * @throws SaveVersionError on unsupported version
   * @throws SaveValidationError on validation failure
   */
  private deserialize(buffer: ArrayBuffer): GameStateSnapshot {
    // Validate minimum size: magic (8) + version (1) + headerLength (4) = 13 bytes minimum
    if (buffer.byteLength < 13) {
      throw new SaveFileCorruptedError('Save file is too small')
    }

    const view = new Uint8Array(buffer)
    let offset = 0

    // Validate magic header
    for (let i = 0; i < 8; i++) {
      if (view[offset + i] !== MAGIC_HEADER[i]) {
        throw new SaveFileCorruptedError('Invalid magic header')
      }
    }
    offset += 8

    // Check version
    const version = view[offset]
    offset += 1
    if (version !== CURRENT_VERSION) {
      throw new SaveVersionError(version)
    }

    // Read header length
    const headerLengthView = new DataView(buffer, offset, 4)
    const headerLength = headerLengthView.getUint32(0, true)
    offset += 4

    // Validate header length
    if (offset + headerLength > buffer.byteLength) {
      throw new SaveFileCorruptedError('Invalid header length')
    }

    // Parse JSON header
    const headerBytes = view.slice(offset, offset + headerLength)
    offset += headerLength

    let header
    try {
      const headerJson = textDecoder.decode(headerBytes)
      header = JSON.parse(headerJson)
    }
    catch (error) {
      throw new SaveFileCorruptedError('Failed to parse header JSON', error)
    }

    // Validate header fields
    this.validateHeader(header)

    // Extract board data
    const expectedBoardSize = header.width * header.height
    const boardBytes = view.slice(offset)

    if (boardBytes.length !== expectedBoardSize) {
      throw new SaveValidationError(
        `Board data size mismatch: expected ${expectedBoardSize}, got ${boardBytes.length}`,
      )
    }

    return {
      header,
      boardData: new Uint8Array(boardBytes),
    }
  }

  /**
   * Validate save file header
   */
  private validateHeader(header: unknown): asserts header is GameStateSnapshot['header'] {
    if (typeof header !== 'object' || header === null) {
      throw new SaveValidationError('Header is not an object')
    }

    const h = header as Record<string, unknown>

    // Required fields
    const requiredFields = [
      'version',
      'savedAt',
      'width',
      'height',
      'minesNum',
      'minesLeft',
      'tilesLeft',
      'gameTimeSeconds',
      'gameStatus',
      'offsetX',
      'offsetY',
      'userDidFirstMove',
      'emptyTileIndex',
    ]

    for (const field of requiredFields) {
      if (!(field in h)) {
        throw new SaveValidationError(`Missing required field: ${field}`)
      }
    }

    // Validate types
    if (typeof h.version !== 'string') {
      throw new SaveValidationError('version must be a string')
    }
    if (typeof h.savedAt !== 'string') {
      throw new SaveValidationError('savedAt must be a string')
    }
    if (typeof h.width !== 'number' || h.width <= 0) {
      throw new SaveValidationError('width must be a positive number')
    }
    if (typeof h.height !== 'number' || h.height <= 0) {
      throw new SaveValidationError('height must be a positive number')
    }
    if (typeof h.minesNum !== 'number') {
      throw new SaveValidationError('minesNum must be a number')
    }
    if (typeof h.gameStatus !== 'string') {
      throw new SaveValidationError('gameStatus must be a string')
    }
    if (!['PLAYING', 'DEAD', 'WIN'].includes(h.gameStatus)) {
      throw new SaveValidationError(`Invalid gameStatus: ${h.gameStatus}`)
    }
  }

  /**
   * Save game state to OPFS
   */
  async save(gameState: GameStateSnapshot): Promise<void> {
    try {
      const buffer = this.serialize(gameState)
      await writeFile(this.getFileName(), buffer)
    }
    catch (error) {
      if (error instanceof SaveFileError) {
        throw error
      }
      throw new SaveFileError('Failed to save game', error)
    }
  }

  /**
   * Load game state from OPFS
   * Returns null if no save exists
   */
  async load(): Promise<GameStateSnapshot | null> {
    try {
      const buffer = await readFile(this.getFileName())
      if (buffer === null) {
        return null
      }

      return this.deserialize(buffer)
    }
    catch (error) {
      if (error instanceof SaveFileError) {
        throw error
      }
      throw new SaveFileError('Failed to load game', error)
    }
  }

  /**
   * Check if save file exists
   * Returns false on any error (graceful degradation)
   */
  async hasSave(): Promise<boolean> {
    return fileExists(this.getFileName())
  }

  /**
   * Delete save file
   */
  async deleteSave(): Promise<void> {
    try {
      await deleteFile(this.getFileName())
    }
    catch (error) {
      throw new SaveFileError('Failed to delete save', error)
    }
  }

  /**
   * Get list of available slots
   * Returns slots based on existing save files
   */
  async getAvailableSlots(): Promise<string[]> {
    const slots: string[] = []

    try {
      // List files matching savegame pattern
      const files = await listFiles(/^savegame.*\.dat$/)

      for (const file of files) {
        if (file === DEFAULT_FILENAME) {
          slots.push('default')
        }
        else if (file.startsWith('savegame-') && file.endsWith('.dat')) {
          // Extract slot ID from filename: savegame-{slotId}.dat
          const slotId = file.slice(9, -4) // Remove 'savegame-' prefix and '.dat' suffix
          if (slotId) {
            slots.push(slotId)
          }
        }
      }

      return slots
    }
    catch {
      return slots
    }
  }
}
