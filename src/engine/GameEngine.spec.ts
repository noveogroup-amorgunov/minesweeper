import type { AbstractScheduler } from '../core/AbstractScheduler'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GameEngine } from './GameEngine'

// Mock crypto.getRandomValues for deterministic tests
const mockRandomValues = vi.fn((array: Uint8Array) => {
  // Fill with predictable values for testing
  for (let i = 0; i < array.length; i++) {
    array[i] = (i * 7) % 256
  }
  return array
})

Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: mockRandomValues,
  },
  writable: true,
  configurable: true,
})

// Mock Web Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  postMessage = vi.fn()
  terminate = vi.fn()

  // Simulate receiving a message from the worker
  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }))
    }
  }
}

Object.defineProperty(globalThis, 'Worker', {
  value: MockWorker,
  writable: true,
  configurable: true,
})

describe('gameEngine.generateRoomId', () => {
  beforeEach(() => {
    mockRandomValues.mockClear()
  })

  it('should return string of default length 10', () => {
    const roomId = GameEngine.generateRoomId()
    expect(roomId).toHaveLength(10)
  })

  it('should return string of specified length', () => {
    const roomId15 = GameEngine.generateRoomId(15)
    expect(roomId15).toHaveLength(15)

    const roomId5 = GameEngine.generateRoomId(5)
    expect(roomId5).toHaveLength(5)
  })

  it('should contain only Base62 characters', () => {
    const roomId = GameEngine.generateRoomId(100)
    const base62Regex = /^[0-9a-z]+$/i
    expect(roomId).toMatch(base62Regex)
  })

  it('should use crypto.getRandomValues', () => {
    GameEngine.generateRoomId()
    expect(mockRandomValues).toHaveBeenCalled()
  })

  it('should return different values on multiple calls', () => {
    // Since we mock with predictable values, let's change the mock behavior
    let counter = 0
    mockRandomValues.mockImplementation((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = (counter + i) % 256
      }
      counter += 10
      return array
    })

    const roomId1 = GameEngine.generateRoomId()
    const roomId2 = GameEngine.generateRoomId()

    expect(roomId1).not.toBe(roomId2)
  })

  it('should handle edge case: length = 1', () => {
    const roomId = GameEngine.generateRoomId(1)
    expect(roomId).toHaveLength(1)
    expect(roomId).toMatch(/^[0-9a-z]$/i)
  })

  it('should handle edge case: length = 20', () => {
    const roomId = GameEngine.generateRoomId(20)
    expect(roomId).toHaveLength(20)
  })
})

describe('gameEngine with mode', () => {
  const createMockScheduler = (): AbstractScheduler => ({
    postTask: vi.fn(),
    clear: vi.fn(),
  })

  it('should default to random mode when no mode specified', () => {
    const scheduler = createMockScheduler()
    const engine = new GameEngine({
      scheduler,
    })

    expect(engine.getMode()).toBe('random')
  })

  it('should set mode to random when explicitly specified', () => {
    const scheduler = createMockScheduler()
    const engine = new GameEngine({
      mode: 'random',
      scheduler,
    })

    expect(engine.getMode()).toBe('random')
  })

  it('should set mode to seeded when specified', () => {
    const scheduler = createMockScheduler()
    const engine = new GameEngine({
      mode: 'seeded',
      scheduler,
    })

    expect(engine.getMode()).toBe('seeded')
  })

  it('should return undefined seed for random mode', () => {
    const scheduler = createMockScheduler()
    const engine = new GameEngine({
      mode: 'random',
      scheduler,
    })

    expect(engine.getSeed()).toBeUndefined()
  })

  it('should return seed for seeded mode', () => {
    const scheduler = createMockScheduler()
    const engine = new GameEngine({
      mode: 'seeded',
      scheduler,
    })

    const seed = engine.getSeed()
    expect(seed).toBeDefined()
    expect(seed).toHaveLength(10) // Default room ID length
    expect(seed).toMatch(/^[0-9a-z]+$/i)
  })

  it('should generate different seeds for different engines in seeded mode', () => {
    const scheduler1 = createMockScheduler()
    const scheduler2 = createMockScheduler()

    // Use different mock values for each call
    let callCount = 0
    mockRandomValues.mockImplementation((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = (callCount * 10 + i) % 256
      }
      callCount++
      return array
    })

    const engine1 = new GameEngine({
      mode: 'seeded',
      scheduler: scheduler1,
    })

    const engine2 = new GameEngine({
      mode: 'seeded',
      scheduler: scheduler2,
    })

    expect(engine1.getSeed()).not.toBe(engine2.getSeed())
  })
})
