import { useMemo } from 'react'
import { Button, Counter } from 'react95'
import { useGameEngine } from '../gameContext'
import { useGameState } from '../useGameState'
import css from './GameStatusPanel.module.css'

function GameTimer() {
  const gameTimeSeconds = useGameState(state => state.gameTimeSeconds)

  return (
    <Counter
      size="md"
      value={gameTimeSeconds}
      minLength={3}
    />
  )
}

function GameMinesLeft() {
  const gameEngine = useGameEngine()
  const minesLeft = useGameState(state => state.minesLeft)
  const minesNum = useGameState(state => state.minesNum)
  const minLength = Math.max(String(minesNum).length + 1, 3)

  return (
    <Counter
      onClick={() => gameEngine.restart()}
      size="md"
      value={Math.max(minesLeft, 0)}
      minLength={minLength > 8 ? minLength - 1 : minLength}
    />
  )
}

export function GameStatusPanel() {
  return (
    <div className={css.root}>
      <GameMinesLeft />
      <GameTimer />
    </div>
  )
}
