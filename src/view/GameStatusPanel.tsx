import { useMemo } from 'react'
import { Button, Counter } from 'react95'
import { useGameEngine } from '../react/context'
import { useGameState } from '../react/useGameState'
import css from './GameStatusPanel.module.css'

export function GameStatusPanel() {
  const gameEngine = useGameEngine()
  const minesLeft = useGameState(state => state.minesLeft)
  const minesNum = useGameState(state => state.minesNum)
  const gameStatus = useGameState(state => state.gameStatus)
  const minLength = Math.max(String(minesNum).length + 1, 3)

  const buttonLabel = useMemo(() => {
    if (gameStatus === 'PLAYING') {
      return 'Restart'
    }
    if (gameStatus === 'DEAD') {
      return 'You dead! Try again'
    }
    if (gameStatus === 'WIN') {
      return 'You won! Restart'
    }
    return '...'
  }, [gameStatus])

  return (
    <div className={css.root}>
      <Counter
        size="md"
        value={Math.max(minesLeft, 0)}
        minLength={minLength > 8 ? minLength - 1 : minLength}
      />
      <Button
        disabled={gameStatus === 'PENDING'}
        className={css.button}
        size="lg"
        onClick={() => gameEngine.restart()}
      >
        {buttonLabel}
      </Button>
    </div>
  )
}
