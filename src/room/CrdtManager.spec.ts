import type { GameOperation, JoinGameOperation, LeftClickOperation } from './CrdtManager'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { CrdtManager } from './CrdtManager'

describe('crdtManager', () => {
  it('should add and get operations', () => {
    const manager = new CrdtManager()

    const op: LeftClickOperation = {
      type: 'leftClick',
      x: 5,
      y: 10,
      playerId: 'player1',
      timestamp: 1234567890,
    }

    manager.addOperation(op)
    const ops = manager.getOperations()

    expect(ops).toHaveLength(1)
    expect(ops[0]).toEqual(op)
  })

  it('should maintain operation order', () => {
    const manager = new CrdtManager()

    const op1: LeftClickOperation = {
      type: 'leftClick',
      x: 1,
      y: 1,
      playerId: 'player1',
      timestamp: 1000,
    }

    const op2: LeftClickOperation = {
      type: 'leftClick',
      x: 2,
      y: 2,
      playerId: 'player2',
      timestamp: 2000,
    }

    manager.addOperation(op1)
    manager.addOperation(op2)

    const ops = manager.getOperations()
    expect(ops).toHaveLength(2)
    expect(ops[0]).toEqual(op1)
    expect(ops[1]).toEqual(op2)
  })

  it('should not call onExternalOperations for local operations', () => {
    const callback = vi.fn()
    const manager = new CrdtManager({
      onExternalOperations: callback,
    })

    const op: LeftClickOperation = {
      type: 'leftClick',
      x: 5,
      y: 10,
      playerId: 'player1',
      timestamp: 1234567890,
    }

    manager.addOperation(op, 'local')

    expect(callback).not.toHaveBeenCalled()
  })

  it('should serialize state to Uint8Array', () => {
    const manager = new CrdtManager()

    const joinOp: JoinGameOperation = {
      type: 'join',
      roomId: 'room-123',
      width: 10,
      height: 10,
      minesNum: 10,
      seed: 'room-123',
      playerId: 'player1',
      timestamp: 1000,
    }

    manager.addOperation(joinOp)

    // Проверяем, что getStateUpdate возвращает данные
    const stateUpdate = manager.getStateUpdate()
    expect(stateUpdate).toBeInstanceOf(Uint8Array)
    expect(stateUpdate.length).toBeGreaterThan(0)

    // Примечание: полная проверка десериализации тестируется
    // в интеграционных тестах через LocalSyncProvider
  })

  it('should clear all operations', () => {
    const manager = new CrdtManager()

    const op: LeftClickOperation = {
      type: 'leftClick',
      x: 5,
      y: 10,
      playerId: 'player1',
      timestamp: 1234567890,
    }

    manager.addOperation(op)
    expect(manager.getOperations()).toHaveLength(1)

    manager.clear()
    expect(manager.getOperations()).toHaveLength(0)
  })

  it('should handle join operations', () => {
    const manager = new CrdtManager()

    const op: JoinGameOperation = {
      type: 'join',
      roomId: 'room-abc',
      width: 100,
      height: 100,
      minesNum: 1000,
      seed: 'room-abc',
      playerId: 'host',
      timestamp: 1000,
    }

    manager.addOperation(op)
    const ops = manager.getOperations()

    expect(ops).toHaveLength(1)
    expect(ops[0]).toEqual(op)
  })

  it('should handle rightClick operations', () => {
    const manager = new CrdtManager()

    const op: GameOperation = {
      type: 'rightClick',
      x: 3,
      y: 7,
      playerId: 'player1',
      timestamp: 1234567890,
    }

    manager.addOperation(op)
    const ops = manager.getOperations()

    expect(ops).toHaveLength(1)
    expect(ops[0]).toEqual(op)
  })

  it('should get Yjs document', () => {
    const manager = new CrdtManager()
    const doc = manager.getDoc()

    expect(doc).toBeInstanceOf(Y.Doc)
  })
})
