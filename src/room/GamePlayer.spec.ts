import { describe, expect, it } from 'vitest'
import { GamePlayer } from './GamePlayer'

describe('gamePlayer', () => {
  it('should create player with generated id', () => {
    const player = new GamePlayer()

    expect(player.id).toBeDefined()
    expect(player.id.length).toBe(8)
  })

  it('should create player with default name', () => {
    const player = new GamePlayer()

    expect(player.name).toBeDefined()
    expect(player.name.startsWith('Player ')).toBe(true)
    expect(player.name.includes(player.id.slice(0, 4))).toBe(true)
  })

  it('should create player with custom name', () => {
    const player = new GamePlayer({ name: 'Alice' })

    expect(player.name).toBe('Alice')
    expect(player.id).toBeDefined()
  })

  it('should generate unique ids for different players', () => {
    const player1 = new GamePlayer()
    const player2 = new GamePlayer()

    expect(player1.id).not.toBe(player2.id)
  })
})
