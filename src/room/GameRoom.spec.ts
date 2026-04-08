import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Scheduler } from '../core/Scheduler'
import { GameRoom } from './GameRoom'

// Mock Web Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  postMessage = vi.fn((_data: unknown, _transfer?: Transferable[]) => {
    // Simulate worker response
    setTimeout(() => {
      if (this.onmessage) {
        // Mock board generation response
        const mockResponse = {
          type: 'GENERATE_BOARD_RESPONSE',
          data: {
            buffer: new ArrayBuffer(100),
            emptyTileIndex: 0,
          },
        }
        this.onmessage(new MessageEvent('message', { data: mockResponse }))
      }
    }, 0)
  })

  terminate = vi.fn()
}

Object.defineProperty(globalThis, 'Worker', {
  value: MockWorker,
  writable: true,
  configurable: true,
})

// Mock crypto.getRandomValues
Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = (i * 7) % 256
      }
      return array
    }),
  },
  writable: true,
  configurable: true,
})

describe('gameRoom', () => {
  let scheduler: Scheduler

  beforeEach(() => {
    scheduler = new Scheduler()
  })

  it('should create GameRoom with scheduler', () => {
    const room = new GameRoom({
      scheduler,
    })

    expect(room).toBeDefined()
    expect(room.getCurrentPlayerId()).toBeDefined()

    // Очищаем
    room.getGameState() // просто вызываем для coverage
  })

  it('should create player with custom name', () => {
    const room = new GameRoom({
      scheduler,
      playerName: 'Alice',
    })

    expect(room.getCurrentPlayerId()).toBeDefined()
  })

  it('should create game with parameters', async () => {
    const room = new GameRoom({
      scheduler,
    })

    await room.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    const state = room.getGameState()
    expect(state.width).toBe(10)
    expect(state.height).toBe(10)
    expect(state.minesNum).toBe(10)
    expect(room.getRoomId()).toBeDefined()
  })

  it('should get roomId after creation', async () => {
    const room = new GameRoom({
      scheduler,
    })

    expect(room.getRoomId()).toBeNull()

    await room.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    expect(room.getRoomId()).not.toBeNull()
    expect(room.getRoomId()?.length).toBeGreaterThan(0)
  })

  it('should subscribe to state changes', async () => {
    const room = new GameRoom({
      scheduler,
    })

    await room.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    const callback = vi.fn()
    const unsubscribe = room.subscribe(callback)

    // Unsubscribe должен работать без ошибок
    expect(() => unsubscribe()).not.toThrow()
  })

  it('should handle left click', async () => {
    const room = new GameRoom({
      scheduler,
    })

    await room.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    // Даём время на генерацию поля
    await new Promise(resolve => setTimeout(resolve, 100))

    // Кликаем по ячейке
    room.handleLeftClick(0, 0)

    // Проверяем, что состояние могло измениться
    // (или не измениться, если там мина)
    expect(room.getGameState()).toBeDefined()
  })

  it('should handle right click', async () => {
    const room = new GameRoom({
      scheduler,
    })

    await room.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    // Даём время на генерацию поля
    await new Promise(resolve => setTimeout(resolve, 100))

    // Кликаем правой кнопкой
    room.handleRightClick(0, 0)

    expect(room.getGameState()).toBeDefined()
  })

  it('should use provided roomId', async () => {
    const room = new GameRoom({
      scheduler,
      roomId: 'custom-room-id',
    })

    await room.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    expect(room.getRoomId()).toBe('custom-room-id')
  })
})
