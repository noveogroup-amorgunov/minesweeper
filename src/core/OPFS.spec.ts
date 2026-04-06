import type { GameStateSnapshot } from '../engine/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// Import mocked functions
import {
  deleteFile,
  fileExists,
  listFiles,
  readFile,
  writeFile,
} from '../core/OPFS'

import { SaveFileCorruptedError, SaveValidationError, SaveVersionError } from '../engine/errors'

// Import GameSaveManager after mock is set up
import { GameSaveManager } from '../engine/GameSaveManager'

// Mock storage for OPFS operations
const mockFileStorage = new Map<string, Uint8Array>()

// Reset storage before each test
beforeEach(() => {
  mockFileStorage.clear()
})

// Mock OPFS module using vi.mock (hoisted by vitest)
vi.mock('../core/OPFS', async (importOriginal) => {
  return {
    ...await importOriginal<typeof import('../core/OPFS')>(),
    isOPFSSupported: vi.fn(() => true),
    writeFile: vi.fn(async (filename: string, data: ArrayBuffer) => {
      mockFileStorage.set(filename, new Uint8Array(data))
    }),
    readFile: vi.fn(async (filename: string): Promise<ArrayBuffer | null> => {
      const data = mockFileStorage.get(filename)
      if (!data)
        return null
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    }),
    fileExists: vi.fn(async (filename: string): Promise<boolean> => {
      return mockFileStorage.has(filename)
    }),
    deleteFile: vi.fn(async (filename: string) => {
      mockFileStorage.delete(filename)
    }),
    listFiles: vi.fn(async (pattern?: RegExp): Promise<string[]> => {
      const files = Array.from(mockFileStorage.keys())
      if (!pattern)
        return files
      return files.filter(f => pattern.test(f))
    }),
  }
})

function createTestSnapshot(): GameStateSnapshot {
  const width = 10
  const height = 10
  const boardSize = width * height

  return {
    header: {
      version: '1.0',
      savedAt: new Date().toISOString(),
      width,
      height,
      minesNum: 10,
      minesLeft: 9,
      tilesLeft: 90,
      gameTimeSeconds: 123,
      gameStatus: 'PLAYING',
      offsetX: 5,
      offsetY: 3,
      userDidFirstMove: true,
      emptyTileIndex: 42,
    },
    boardData: new Uint8Array(boardSize).fill(12), // Fill with hidden tiles
  }
}

describe('opfs', () => {
  it('should write and read file', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5])

    await writeFile('test.dat', data.buffer)
    const read = await readFile('test.dat')

    expect(read).not.toBeNull()
    expect(new Uint8Array(read!)).toEqual(data)
  })

  it('should return null for non-existent file', async () => {
    const result = await readFile('nonexistent.dat')
    expect(result).toBeNull()
  })

  it('should check file existence', async () => {
    expect(await fileExists('test.dat')).toBe(false)

    await writeFile('test.dat', new ArrayBuffer(1))
    expect(await fileExists('test.dat')).toBe(true)
  })

  it('should delete file', async () => {
    await writeFile('test.dat', new ArrayBuffer(1))
    expect(await fileExists('test.dat')).toBe(true)

    await deleteFile('test.dat')
    expect(await fileExists('test.dat')).toBe(false)
  })

  it('should list files with pattern', async () => {
    await writeFile('savegame.dat', new ArrayBuffer(1))
    await writeFile('savegame-slot1.dat', new ArrayBuffer(1))
    await writeFile('other.dat', new ArrayBuffer(1))

    const files = await listFiles(/^savegame.*\.dat$/)
    expect(files).toContain('savegame.dat')
    expect(files).toContain('savegame-slot1.dat')
    expect(files).not.toContain('other.dat')
  })
})

describe('gameSaveManager', () => {
  it('should save and load game state', async () => {
    const manager = new GameSaveManager()
    const state = createTestSnapshot()

    await manager.save(state)
    const loaded = await manager.load()

    expect(loaded).not.toBeNull()
    expect(loaded!.header).toEqual(state.header)
    expect(loaded!.boardData).toEqual(state.boardData)
  })

  it('should return null when no save exists', async () => {
    const manager = new GameSaveManager()
    const loaded = await manager.load()
    expect(loaded).toBeNull()
  })

  it('should return false for hasSave when no file exists', async () => {
    const manager = new GameSaveManager()
    const hasSave = await manager.hasSave()
    expect(hasSave).toBe(false)
  })

  it('should return true for hasSave when file exists', async () => {
    const manager = new GameSaveManager()
    await manager.save(createTestSnapshot())
    const hasSave = await manager.hasSave()
    expect(hasSave).toBe(true)
  })

  it('should throw SaveFileCorruptedError on invalid magic header', async () => {
    const manager = new GameSaveManager()

    // Create a file with invalid magic header
    const invalidData = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00])
    mockFileStorage.set('savegame.dat', invalidData)

    await expect(manager.load()).rejects.toThrow(SaveFileCorruptedError)
  })

  it('should throw SaveFileCorruptedError on invalid JSON in header', async () => {
    const manager = new GameSaveManager()

    // Create valid magic + version + header length, but invalid JSON
    const magic = new Uint8Array([0x4D, 0x49, 0x4E, 0x45, 0x53, 0x57, 0x50, 0x00]) // MINESWP\0
    const version = new Uint8Array([0x01])
    const headerLength = new Uint8Array(4)
    new DataView(headerLength.buffer).setUint32(0, 10, true) // 10 bytes of invalid JSON
    const invalidJson = new Uint8Array([0x7B, 0x7B, 0x7B, 0x7B, 0x7B, 0x7B, 0x7B, 0x7B, 0x7B, 0x7B]) // {{{{{{{{{

    const combined = new Uint8Array(magic.length + version.length + headerLength.length + invalidJson.length)
    combined.set(magic, 0)
    combined.set(version, magic.length)
    combined.set(headerLength, magic.length + version.length)
    combined.set(invalidJson, magic.length + version.length + headerLength.length)

    mockFileStorage.set('savegame.dat', combined)

    await expect(manager.load()).rejects.toThrow(SaveFileCorruptedError)
  })

  it('should throw SaveVersionError on unsupported version', async () => {
    const manager = new GameSaveManager()

    // Create valid magic + unsupported version
    const magic = new Uint8Array([0x4D, 0x49, 0x4E, 0x45, 0x53, 0x57, 0x50, 0x00]) // MINESWP\0
    const version = new Uint8Array([0xFF]) // Unsupported version
    const headerLength = new Uint8Array(4)
    new DataView(headerLength.buffer).setUint32(0, 2, true)
    const emptyJson = new Uint8Array([0x7B, 0x7D]) // {}

    const combined = new Uint8Array(magic.length + version.length + headerLength.length + emptyJson.length)
    combined.set(magic, 0)
    combined.set(version, magic.length)
    combined.set(headerLength, magic.length + version.length)
    combined.set(emptyJson, magic.length + version.length + headerLength.length)

    mockFileStorage.set('savegame.dat', combined)

    await expect(manager.load()).rejects.toThrow(SaveVersionError)
  })

  it('should throw SaveValidationError on missing required fields', async () => {
    const manager = new GameSaveManager()

    // Create valid magic + version + header with missing fields
    const magic = new Uint8Array([0x4D, 0x49, 0x4E, 0x45, 0x53, 0x57, 0x50, 0x00])
    const version = new Uint8Array([0x01])
    const headerJson = JSON.stringify({ version: '1.0', savedAt: 'test' }) // Missing many fields
    const headerBytes = new TextEncoder().encode(headerJson)
    const headerLength = new Uint8Array(4)
    new DataView(headerLength.buffer).setUint32(0, headerBytes.length, true)

    const combined = new Uint8Array(magic.length + version.length + headerLength.length + headerBytes.length)
    combined.set(magic, 0)
    combined.set(version, magic.length)
    combined.set(headerLength, magic.length + version.length)
    combined.set(headerBytes, magic.length + version.length + headerLength.length)

    mockFileStorage.set('savegame.dat', combined)

    await expect(manager.load()).rejects.toThrow(SaveValidationError)
  })

  it('should throw SaveValidationError on board size mismatch', async () => {
    const manager = new GameSaveManager()

    // Create valid header but wrong board size
    const magic = new Uint8Array([0x4D, 0x49, 0x4E, 0x45, 0x53, 0x57, 0x50, 0x00])
    const version = new Uint8Array([0x01])
    const headerJson = JSON.stringify({
      version: '1.0',
      savedAt: '2024-01-01T00:00:00.000Z',
      width: 10,
      height: 10,
      minesNum: 10,
      minesLeft: 9,
      tilesLeft: 90,
      gameTimeSeconds: 0,
      gameStatus: 'PLAYING',
      offsetX: 0,
      offsetY: 0,
      userDidFirstMove: true,
      emptyTileIndex: 0,
    })
    const headerBytes = new TextEncoder().encode(headerJson)
    const headerLength = new Uint8Array(4)
    new DataView(headerLength.buffer).setUint32(0, headerBytes.length, true)

    // Board data with wrong size (5 bytes instead of 100)
    const wrongBoardData = new Uint8Array(5)

    const combined = new Uint8Array(magic.length + version.length + headerLength.length + headerBytes.length + wrongBoardData.length)
    combined.set(magic, 0)
    combined.set(version, magic.length)
    combined.set(headerLength, magic.length + version.length)
    combined.set(headerBytes, magic.length + version.length + headerLength.length)
    combined.set(wrongBoardData, magic.length + version.length + headerLength.length + headerBytes.length)

    mockFileStorage.set('savegame.dat', combined)

    await expect(manager.load()).rejects.toThrow(SaveValidationError)
  })

  it('should support slot switching', async () => {
    const manager = new GameSaveManager({ slotId: 'slot1' })

    const state1 = createTestSnapshot()
    state1.header.savedAt = '2024-01-01T00:00:00.000Z'
    await manager.save(state1)

    manager.setSlot('slot2')
    const state2 = createTestSnapshot()
    state2.header.savedAt = '2024-02-01T00:00:00.000Z'
    await manager.save(state2)

    manager.setSlot('slot1')
    const loaded1 = await manager.load()
    expect(loaded1!.header.savedAt).toBe('2024-01-01T00:00:00.000Z')

    manager.setSlot('slot2')
    const loaded2 = await manager.load()
    expect(loaded2!.header.savedAt).toBe('2024-02-01T00:00:00.000Z')
  })

  it('should delete save file', async () => {
    const manager = new GameSaveManager()
    await manager.save(createTestSnapshot())

    expect(await manager.hasSave()).toBe(true)
    await manager.deleteSave()
    expect(await manager.hasSave()).toBe(false)
  })

  it('should return empty array for getAvailableSlots when no saves exist', async () => {
    const manager = new GameSaveManager()
    const slots = await manager.getAvailableSlots()
    expect(slots).toEqual([])
  })

  it('should return default slot for getAvailableSlots when save exists', async () => {
    const manager = new GameSaveManager()
    await manager.save(createTestSnapshot())
    const slots = await manager.getAvailableSlots()
    expect(slots).toEqual(['default'])
  })

  it('should return multiple slots for getAvailableSlots', async () => {
    // Create saves for different slots directly
    const manager1 = new GameSaveManager({ slotId: 'slot1' })
    const manager2 = new GameSaveManager({ slotId: 'slot2' })
    const defaultManager = new GameSaveManager()

    await manager1.save(createTestSnapshot())
    await manager2.save(createTestSnapshot())
    await defaultManager.save(createTestSnapshot())

    const slots = await defaultManager.getAvailableSlots()
    expect(slots).toContain('default')
    expect(slots).toContain('slot1')
    expect(slots).toContain('slot2')
    expect(slots.length).toBe(3)
  })
})
