import { describe, expect, it, vi } from 'vitest'

import { PubSub } from './PubSub'

describe('core/PubSub', () => {
  it('should be subscribe and emit without data', () => {
    const pubSub = new PubSub('game-update')
    const callback = vi.fn()

    pubSub.subscribe(callback)

    pubSub.emit()

    expect(callback).toHaveBeenCalled()
    expect(callback).toHaveBeenCalledWith(undefined)

    pubSub.emit({ foo: 'bar' })

    expect(callback).toHaveBeenCalledWith({ foo: 'bar' })
  })

  it('should be subscribe and emit with data', () => {
    const pubSub = new PubSub('game-update')
    const callback = vi.fn()

    pubSub.subscribe(callback)

    pubSub.emit({ gameStatus: 'WIN' })

    expect(callback).toHaveBeenCalledWith({ gameStatus: 'WIN' })
  })

  it('should be unsubscribe', () => {
    const pubSub = new PubSub('game-update')
    const callback = vi.fn()

    const unsubscribe = pubSub.subscribe(callback)

    unsubscribe()

    pubSub.emit()

    expect(callback).not.toHaveBeenCalled()
  })
})
