import type { GameStateSnapshot } from './types'
import { describe, expect, it, vi } from 'vitest'
import { SaveFileCorruptedError, SaveValidationError, SaveVersionError } from './errors'
import { SaveManager } from './SaveManager'

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

describe('saveManager', () => {
  // Mock OPFS
  const mockFileHandles = new Map<string, { data: Uint8Array | null }>()

  // Mock navigator.storage.getDirectory
  const mockGetDirectory = vi.fn(async () => ({
    getFileHandle: vi.fn(async (name: string, options?: { create?: boolean }) => {
      if (!mockFileHandles.has(name)) {
        if (options?.create) {
          mockFileHandles.set(name, { data: null })
        }
        else {
          const error = new DOMException('File not found', 'NotFoundError')
          throw error
        }
      }
      return {
        getFile: vi.fn(async () => ({
          arrayBuffer: vi.fn(async () => {
            const fileData = mockFileHandles.get(name)?.data
            if (!fileData) {
              throw new DOMException('File not found', 'NotFoundError')
            }
            return fileData.buffer.slice(
              fileData.byteOffset,
              fileData.byteOffset + fileData.byteLength,
            )
          }),
        })),
        createWritable: vi.fn(async () => {
          const chunks: Uint8Array[] = []
          return {
            write: vi.fn(async (data: ArrayBuffer) => {
              chunks.push(new Uint8Array(data))
            }),
            close: vi.fn(async () => {
              const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
              const combined = new Uint8Array(totalLength)
              let offset = 0
              for (const chunk of chunks) {
                combined.set(chunk, offset)
                offset += chunk.length
              }
              mockFileHandles.set(name, { data: combined })
            }),
          }
        }),
      }
    }),
    removeEntry: vi.fn(async (name: string) => {
      mockFileHandles.delete(name)
    }),
  }))

  // Setup mock before each test
  vi.stubGlobal('navigator', {
    storage: {
      getDirectory: mockGetDirectory,
    },
  })

  it('should save and load game state', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()
    const state = createTestSnapshot()

    await manager.save(state)
    const loaded = await manager.load()

    expect(loaded).not.toBeNull()
    expect(loaded!.header).toEqual(state.header)
    expect(loaded!.boardData).toEqual(state.boardData)
  })

  it('should return null when no save exists', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()
    const loaded = await manager.load()
    expect(loaded).toBeNull()
  })

  it('should return false for hasSave when no file exists', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()
    const hasSave = await manager.hasSave()
    expect(hasSave).toBe(false)
  })

  it('should return true for hasSave when file exists', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()
    await manager.save(createTestSnapshot())
    const hasSave = await manager.hasSave()
    expect(hasSave).toBe(true)
  })

  it('should throw SaveFileCorruptedError on invalid magic header', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()

    // Create a file with invalid magic header
    const invalidData = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00])
    mockFileHandles.set('savegame.dat', { data: invalidData })

    await expect(manager.load()).rejects.toThrow(SaveFileCorruptedError)
  })

  it('should throw SaveFileCorruptedError on invalid JSON in header', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()

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

    mockFileHandles.set('savegame.dat', { data: combined })

    await expect(manager.load()).rejects.toThrow(SaveFileCorruptedError)
  })

  it('should throw SaveVersionError on unsupported version', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()

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

    mockFileHandles.set('savegame.dat', { data: combined })

    await expect(manager.load()).rejects.toThrow(SaveVersionError)
  })

  it('should throw SaveValidationError on missing required fields', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()

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

    mockFileHandles.set('savegame.dat', { data: combined })

    await expect(manager.load()).rejects.toThrow(SaveValidationError)
  })

  it('should throw SaveValidationError on board size mismatch', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()

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

    mockFileHandles.set('savegame.dat', { data: combined })

    await expect(manager.load()).rejects.toThrow(SaveValidationError)
  })

  it('should support slot switching', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager({ slotId: 'slot1' })

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
    mockFileHandles.clear()
    const manager = new SaveManager()
    await manager.save(createTestSnapshot())

    expect(await manager.hasSave()).toBe(true)
    await manager.deleteSave()
    expect(await manager.hasSave()).toBe(false)
  })

  it('should return empty array for getAvailableSlots when no saves exist', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()
    const slots = await manager.getAvailableSlots()
    expect(slots).toEqual([])
  })

  it('should return default slot for getAvailableSlots when save exists', async () => {
    mockFileHandles.clear()
    const manager = new SaveManager()
    await manager.save(createTestSnapshot())
    const slots = await manager.getAvailableSlots()
    expect(slots).toEqual(['default'])
  })
})
