import { describe, expect, it, vi } from 'vitest'
import { EventBus } from './eventBus'

describe('eventBus', () => {
  it('should subscribe and emit events', () => {
    const bus = new EventBus()
    const callback = vi.fn()

    bus.on('test', callback)
    bus.emit('test', { data: 'value' })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith({ data: 'value' })
  })

  it('should support multiple listeners', () => {
    const bus = new EventBus()
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    bus.on('test', callback1)
    bus.on('test', callback2)
    bus.emit('test', 'data')

    expect(callback1).toHaveBeenCalledWith('data')
    expect(callback2).toHaveBeenCalledWith('data')
  })

  it('should unsubscribe correctly', () => {
    const bus = new EventBus()
    const callback = vi.fn()

    const unsubscribe = bus.on('test', callback)
    unsubscribe()
    bus.emit('test', 'data')

    expect(callback).not.toHaveBeenCalled()
  })

  it('should pause and resume events', () => {
    const bus = new EventBus()
    const callback = vi.fn()

    bus.on('test', callback)
    bus.pause()
    bus.emit('test', 1)
    bus.emit('test', 2)

    expect(callback).not.toHaveBeenCalled()

    bus.resume()

    expect(callback).toHaveBeenCalledTimes(2)
    expect(callback).toHaveBeenNthCalledWith(1, 1)
    expect(callback).toHaveBeenNthCalledWith(2, 2)
  })

  it('should clear queue', () => {
    const bus = new EventBus()
    const callback = vi.fn()

    bus.on('test', callback)
    bus.pause()
    bus.emit('test', 1)
    bus.clearQueue()
    bus.resume()

    expect(callback).not.toHaveBeenCalled()
  })

  it('should handle different event types', () => {
    const bus = new EventBus()
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    bus.on('event1', callback1)
    bus.on('event2', callback2)
    bus.emit('event1', 'data1')

    expect(callback1).toHaveBeenCalledWith('data1')
    expect(callback2).not.toHaveBeenCalled()
  })
})
