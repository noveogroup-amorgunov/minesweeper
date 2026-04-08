import type { GameStateSnapshot, SaveManagerOptions } from './types'
import { deleteFile, fileExists, listFiles, readFile, writeFile } from '../core/OPFS'
import { SaveFileCorruptedError, SaveFileError, SaveValidationError, SaveVersionError } from './errors'

/**
 * Magic header bytes for v1: "MINESWP\0"
 */
const MAGIC_HEADER = new Uint8Array([0x4D, 0x49, 0x4E, 0x45, 0x53, 0x57, 0x50, 0x00])

/**
 * Magic header bytes for v2 (CRDT): "MINESCRD"
 */
const MAGIC_HEADER_V2 = new Uint8Array([0x4D, 0x49, 0x4E, 0x45, 0x53, 0x43, 0x52, 0x44])

/**
 * Current save file format version (v1)
 */
const CURRENT_VERSION = 0x01

/**
 * Version 2 format identifier
 */
const VERSION_V2 = 2

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
 * Regex for matching savegame files
 */
const SAVEGAME_FILE_REGEX = /^savegame.*\.dat$/

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
      const files = await listFiles(SAVEGAME_FILE_REGEX)

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

  /**
   * ============================================================================
   * VERSION 2 (CRDT) FORMAT SUPPORT
   * ============================================================================
   */

  /**
   * Metadata for save file version 2 (JSON)
   */
  static get SAVE_MAGIC_HEADER_V2(): Uint8Array {
    return MAGIC_HEADER_V2
  }

  /**
   * Version 2 format identifier
   */
  static get SAVE_VERSION_V2(): number {
    return VERSION_V2
  }

  /**
   * Serialize data to version 2 binary format
   * Format:
   *   - magic (8 bytes): "MINESCRD"
   *   - version (2 bytes, uint16le): 0x0002
   *   - jsonLen (4 bytes, uint32le)
   *   - jsonMetadata (N bytes, UTF-8 JSON)
   *   - yjsUpdateLen (4 bytes, uint32le)
   *   - yjsStateUpdate (M bytes, binary)
   */
  static serializeV2(metadata: Record<string, unknown>, yjsStateUpdate: Uint8Array): Uint8Array {
    // Serialize metadata to JSON
    const metadataJson = JSON.stringify(metadata)
    const metadataBytes = textEncoder.encode(metadataJson)

    // Calculate total size
    const totalSize = 8 + 2 + 4 + metadataBytes.length + 4 + yjsStateUpdate.length

    // Create buffer
    const buffer = new Uint8Array(totalSize)
    let offset = 0

    // Write magic header
    buffer.set(MAGIC_HEADER_V2, offset)
    offset += 8

    // Write version (2 bytes, little-endian)
    const versionView = new DataView(buffer.buffer, offset, 2)
    versionView.setUint16(0, VERSION_V2, true)
    offset += 2

    // Write JSON length (4 bytes, little-endian)
    const jsonLenView = new DataView(buffer.buffer, offset, 4)
    jsonLenView.setUint32(0, metadataBytes.length, true)
    offset += 4

    // Write JSON metadata
    buffer.set(metadataBytes, offset)
    offset += metadataBytes.length

    // Write Yjs update length (4 bytes, little-endian)
    const yjsLenView = new DataView(buffer.buffer, offset, 4)
    yjsLenView.setUint32(0, yjsStateUpdate.length, true)
    offset += 4

    // Write Yjs state update
    buffer.set(yjsStateUpdate, offset)

    return buffer
  }

  /**
   * Deserialize version 2 binary format
   * @throws SaveFileCorruptedError on invalid format
   * @throws SaveVersionError if version is not 2
   */
  static deserializeV2(buffer: Uint8Array): { metadata: Record<string, unknown>, yjsStateUpdate: Uint8Array } {
    // Validate minimum size: magic (8) + version (2) + jsonLen (4) + yjsLen (4) = 18 bytes minimum
    if (buffer.length < 18) {
      throw new SaveFileCorruptedError('Save file v2 is too small')
    }

    let offset = 0

    // Validate magic header
    for (let i = 0; i < 8; i++) {
      if (buffer[offset + i] !== MAGIC_HEADER_V2[i]) {
        throw new SaveFileCorruptedError('Invalid magic header for v2 format')
      }
    }
    offset += 8

    // Check version
    const versionView = new DataView(buffer.buffer, offset, 2)
    const version = versionView.getUint16(0, true)
    offset += 2

    if (version !== VERSION_V2) {
      throw new SaveVersionError(version)
    }

    // Read JSON length
    const jsonLenView = new DataView(buffer.buffer, offset, 4)
    const jsonLen = jsonLenView.getUint32(0, true)
    offset += 4

    // Validate JSON length
    if (offset + jsonLen > buffer.length - 4) { // -4 for yjsLen
      throw new SaveFileCorruptedError('Invalid JSON length in v2 format')
    }

    // Parse JSON metadata
    const metadataBytes = buffer.slice(offset, offset + jsonLen)
    offset += jsonLen

    let metadata: Record<string, unknown>
    try {
      const metadataJson = textDecoder.decode(metadataBytes)
      metadata = JSON.parse(metadataJson) as Record<string, unknown>
    }
    catch (error) {
      throw new SaveFileCorruptedError('Failed to parse v2 metadata JSON', error)
    }

    // Read Yjs update length
    const yjsLenView = new DataView(buffer.buffer, offset, 4)
    const yjsLen = yjsLenView.getUint32(0, true)
    offset += 4

    // Validate Yjs update length
    if (offset + yjsLen > buffer.length) {
      throw new SaveFileCorruptedError('Invalid Yjs update length in v2 format')
    }

    // Extract Yjs state update
    const yjsStateUpdate = buffer.slice(offset, offset + yjsLen)

    return { metadata, yjsStateUpdate }
  }

  /**
   * Detect save file version
   * Returns 1 for v1 format, 2 for v2 format, or 'unknown'
   */
  static detectVersion(buffer: Uint8Array): 1 | 2 | 'unknown' {
    if (buffer.length < 8) {
      return 'unknown'
    }

    // Check for v2 magic header
    let isV2 = true
    for (let i = 0; i < 8; i++) {
      if (buffer[i] !== MAGIC_HEADER_V2[i]) {
        isV2 = false
        break
      }
    }
    if (isV2) {
      return 2
    }

    // Check for v1 magic header
    let isV1 = true
    for (let i = 0; i < 8; i++) {
      if (buffer[i] !== MAGIC_HEADER[i]) {
        isV1 = false
        break
      }
    }
    if (isV1) {
      return 1
    }

    return 'unknown'
  }
}
