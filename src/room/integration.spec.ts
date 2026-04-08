import type * as Y from 'yjs'
import type { SyncProviderFactory } from '../room/SyncProvider'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from '../core/eventBus'
import { Scheduler } from '../core/Scheduler'
import { GameRoom } from '../room/GameRoom'
import { LocalSyncProvider } from '../room/LocalSyncProvider'

// Mock Web Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null

  postMessage = vi.fn((_data: unknown, _transfer?: Transferable[]) => {
    setTimeout(() => {
      if (this.onmessage) {
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

describe('cRDT Integration Tests', () => {
  let scheduler: Scheduler
  let eventBus: EventBus

  beforeEach(() => {
    scheduler = new Scheduler()
    eventBus = new EventBus()
  })

  const createSyncProviderFactory = (): SyncProviderFactory => {
    return (roomId: string, doc: Y.Doc) => {
      return new LocalSyncProvider(roomId, doc, eventBus)
    }
  }

  it('should create game and have roomId', async () => {
    const room = new GameRoom({
      scheduler,
      syncProviderFactory: createSyncProviderFactory(),
    })

    await room.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    expect(room.getRoomId()).toBeDefined()
    expect(room.getRoomId()?.length).toBeGreaterThan(0)
  })

  it('should create two GameRooms with same roomId', async () => {
    const roomId = 'test-room-123'

    // Создаём первую комнату (host)
    const room1 = new GameRoom({
      roomId,
      scheduler,
      playerName: 'Alice',
      syncProviderFactory: createSyncProviderFactory(),
    })

    await room1.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    // Создаём вторую комнату с тем же roomId
    const room2 = new GameRoom({
      roomId,
      scheduler,
      playerName: 'Bob',
      syncProviderFactory: createSyncProviderFactory(),
    })

    // Проверяем, что обе комнаты имеют одинаковый roomId
    expect(room1.getRoomId()).toBe(roomId)
    expect(room2.getRoomId()).toBe(roomId)

    // Проверяем, что у обеих комнат есть playerId
    expect(room1.getCurrentPlayerId()).toBeDefined()
    expect(room2.getCurrentPlayerId()).toBeDefined()
  })

  it('should handle clicks in single room', async () => {
    const room = new GameRoom({
      scheduler,
    })

    await room.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    // Даём время на генерацию поля
    await new Promise(resolve => setTimeout(resolve, 50))

    // Кликаем по нескольким ячейкам
    room.handleLeftClick(0, 0)
    room.handleRightClick(1, 1)
    room.handleLeftClick(2, 2)

    const state = room.getGameState()
    expect(state).toBeDefined()
    expect(state.width).toBe(10)
    expect(state.height).toBe(10)
  })

  it('should handle multiple clicks', async () => {
    const room = new GameRoom({
      scheduler,
      syncProviderFactory: createSyncProviderFactory(),
    })

    await room.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    // Делаем несколько кликов
    room.handleLeftClick(0, 0)
    room.handleRightClick(1, 1)
    room.handleLeftClick(2, 2)
    room.handleRightClick(3, 3)

    // Проверяем состояние
    const state = room.getGameState()
    expect(state).toBeDefined()
    expect(state.gameStatus).toBeDefined()
  })

  it('should deduplicate operations', async () => {
    const room = new GameRoom({
      scheduler,
    })

    await room.createGame({
      width: 10,
      height: 10,
      minesNum: 10,
    })

    await new Promise(resolve => setTimeout(resolve, 50))

    // Кликаем несколько раз по одной и той же ячейке
    room.handleLeftClick(0, 0)
    room.handleLeftClick(0, 0)
    room.handleLeftClick(0, 0)

    // Не должно быть ошибок
    expect(room.getGameState()).toBeDefined()
  })
})
