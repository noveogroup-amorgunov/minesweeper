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

describe('gameEngine with mode', () => {
  const createMockScheduler = (): AbstractScheduler => ({
    postTask: vi.fn(),
    clear: vi.fn(),
  })

  beforeEach(() => {
    mockRandomValues.mockClear()
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
    expect(engine.getRoomId()).toBeUndefined()
  })

  it('should return seed and roomId when roomId provided in constructor', () => {
    const scheduler = createMockScheduler()
    const testRoomId = 'aB3xK9mP2q'
    const engine = new GameEngine({
      mode: 'seeded',
      scheduler,
      roomId: testRoomId,
    })

    expect(engine.getRoomId()).toBe(testRoomId)
    expect(engine.getSeed()).toBe(testRoomId)
    expect(engine.getSeed()).toHaveLength(10)
  })

  it('should accept roomId of any length', () => {
    const scheduler = createMockScheduler()
    const testRoomId = 'my-custom-room-id-123'
    const engine = new GameEngine({
      mode: 'seeded',
      scheduler,
      roomId: testRoomId,
    })

    expect(engine.getRoomId()).toBe(testRoomId)
    expect(engine.getSeed()).toBe(testRoomId)
  })

  it('should return undefined seed and roomId for seeded mode without roomId', () => {
    const scheduler = createMockScheduler()
    const engine = new GameEngine({
      mode: 'seeded',
      scheduler,
    })

    expect(engine.getSeed()).toBeUndefined()
    expect(engine.getRoomId()).toBeUndefined()
  })
})
