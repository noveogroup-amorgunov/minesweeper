import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { EventBus } from '../core/eventBus'
import { LocalSyncProvider } from './LocalSyncProvider'

describe('localSyncProvider', () => {
  it('should create provider with roomId and doc', () => {
    const doc = new Y.Doc()
    const provider = new LocalSyncProvider('room-123', doc)

    expect(provider.roomId).toBe('room-123')
    expect(provider.doc).toBe(doc)
    expect(provider.connected).toBe(true)

    provider.destroy()
  })

  it('should not receive own updates', () => {
    const eventBus = new EventBus()
    const doc = new Y.Doc()

    const onSync = vi.fn()
    const provider = new LocalSyncProvider('room-123', doc, eventBus)
    provider.onSync = onSync

    // Добавляем элемент в doc с origin = provider
    doc.transact(() => {
      const root = doc.getMap()
      const arr = new Y.Array()
      root.set('data', arr)
      arr.push(['item1'])
    }, provider)

    // Callback не должен быть вызван для собственных обновлений
    expect(onSync).not.toHaveBeenCalled()

    provider.destroy()
  })

  it('should call onDisconnect on destroy', () => {
    const doc = new Y.Doc()
    const onDisconnect = vi.fn()

    const provider = new LocalSyncProvider('room-123', doc)
    provider.onDisconnect = onDisconnect

    provider.destroy()

    expect(onDisconnect).toHaveBeenCalled()
    expect(provider.connected).toBe(false)
  })

  it('should allow access to EventBus', () => {
    const eventBus = new EventBus()
    const doc = new Y.Doc()

    const provider = new LocalSyncProvider('room-123', doc, eventBus)

    expect(provider.getEventBus()).toBe(eventBus)

    provider.destroy()
  })

  it('should create new EventBus if not provided', () => {
    const doc = new Y.Doc()
    const provider = new LocalSyncProvider('room-123', doc)

    expect(provider.getEventBus()).toBeInstanceOf(EventBus)

    provider.destroy()
  })

  it('should support pause and resume', () => {
    const eventBus = new EventBus()
    const doc = new Y.Doc()

    const provider = new LocalSyncProvider('room-123', doc, eventBus)

    // Проверяем, что методы существуют
    expect(() => provider.pause()).not.toThrow()
    expect(() => provider.resume()).not.toThrow()

    provider.destroy()
  })
})
