import { useEffect, useState } from 'react'
import { describe, expect, it } from 'vitest'

import { GameEngine } from './GameEngine'

function Counter() {
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCounter(previousCounter => previousCounter + 1)
    }, 100)

    return () => {
      clearInterval(timer)
    }
  }, [])

  return (
    <div color="green">
      {counter}
      {' '}
      tests passed
    </div>
  )
}

describe('gameEngine', () => {
  it('should be defined', () => {
    const gameEngine = new GameEngine()

    gameEngine.restart({ width: 10, height: 10, minesNum: 25 })

    expect(gameEngine.gameStatus).toBe('PLAYING')
    expect(gameEngine.minesLeft).toBe(25)
    expect(gameEngine.tilesLeft).toBe(75)

    gameEngine.flag(5)

    // const { lastFrame } = render(<Counter />)

    // for (let i = 0; i < 100; i++) {
    let field = ''
    for (let i = 0; i < 100; i++) {
      field += `[${gameEngine._uInt8Array[i]}]`

      if ((i + 1) % 10 === 0) {
        field += '\n'
      }
    }

    console.log(field)
    console.log(gameEngine.minesLeft)
    console.log(gameEngine.gameStatus)
    // expect(gameEngine.minesLeft).toBe(24)
    // expect(gameEngine.tilesLeft).toBe(74)
  })
})
