import { memo } from 'react'
import { Button } from 'react95'
import { useGameEngine } from '../react/context'
import { useGameState } from '../react/useGameState'

const GameStatsState = memo(() => {
  const gameStatus = useGameState(state => state.gameStatus)

  return (
    <div>
      {gameStatus}
    </div>
  )
})

/* <div>
<Button onClick={() => gameEngine.restart()}>Restart</Button>
</div>
  const gameEngine = useGameEngine() */

export function GameStats() {
  console.log('rerender GameStats')
  const minesLeft = useGameState(state => state.minesLeft)
  const tilesLeft = useGameState(state => state.tilesLeft)

  // console.log(gameState, '👍👍👍👍 gameState')

  return (
    <>
      <div>
        MINES LEFT:
        {minesLeft}
      </div>
      <div>
        TILES LEFT:
        {tilesLeft}
      </div>
      <GameStatsState />
    </>
  )
}
