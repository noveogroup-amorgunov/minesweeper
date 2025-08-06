import { useCallback, useMemo } from 'react'
import { useGameEngine } from '../react/context'
import { useGameState } from '../react/useGameState'
import { VirtualGrid } from '../react/virtualgrid/VirtualGrid'
import { Tile } from './Tile'

const CELL_SIZE_PX = 30

const boardStyle = {
  '--grid-cell': `${CELL_SIZE_PX}px`,
} as React.CSSProperties

export function GameBoard() {
  const gameEngine = useGameEngine()
  const visibleBoard = useGameState(state => state.visibleBoard)
  const gameStatus = useGameState(state => state.gameStatus)
  const gameWidth = useGameState(state => state.width)
  const gameHeight = useGameState(state => state.height)

  const onTileOpen = useCallback((index: number, pressFlag: boolean) => {
    if (pressFlag) {
      gameEngine.flag(index)
    }
    else {
      gameEngine.reveal(index)
    }
  }, [gameEngine.reveal, gameEngine.flag])

  const changeVisibleBoard = useCallback((startNodeX: number, startNodeY: number) => {
    gameEngine.updateVisibleBoard(startNodeX, startNodeY)
  }, [gameEngine])

  const sharedItemProps = useMemo(() => {
    return {
      onTileOpen,
      gameStatus,
    }
  }, [onTileOpen, gameStatus])

  return (
    <div style={boardStyle}>
      <VirtualGrid
        updateGrid={changeVisibleBoard}
        data={visibleBoard}
        Item={Tile}
        sharedItemProps={sharedItemProps}
        width={gameWidth}
        height={gameHeight}
        cellSizePx={CELL_SIZE_PX}
        cellsInViewportWidth={10}
        cellsInViewportHeight={10}
      />
    </div>
  )
}
