import { memo, useMemo } from 'react'
import { useGameState } from '../useGameState'

const GameStatsState = memo(() => {
  const gameStatus = useGameState(state => state.gameStatus)

  return (
    <div>
      {gameStatus}
    </div>
  )
})

export function GameStats() {
  const boardByteLength = useGameState(state => state.boardByteLength)
  const offsetX = useGameState(state => state.offsetX)
  const offsetY = useGameState(state => state.offsetY)

  const boardSize = useMemo(() => {
    if (boardByteLength === 0) {
      return '...'
    }

    if (boardByteLength < 1024) {
      return `${boardByteLength} BYTES`
    }

    if (boardByteLength < 1024 * 1024) {
      return `${Math.round(boardByteLength / 1024)} KB`
    }

    return `${Math.round(boardByteLength / 1024 / 1024)} MB`
  }, [boardByteLength])

  return (
    <>
      <div>
        OFFSET:&nbsp;
        [X:
        {offsetX}
        ;Y:
        {offsetY}
        ]
      </div>
      <div>
        SIZE:&nbsp;
        {boardSize}
      </div>
      <GameStatsState />
    </>
  )
}
