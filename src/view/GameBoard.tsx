import { useCallback, useMemo } from 'react'
import { useGameEngine } from '../react/context'
import { useGameState } from '../react/useGameState'
import { VirtualGrid } from '../react/virtualgrid/VirtualGrid'
import css from './GameBoard.module.css'
import { Tile } from './Tile'

export const CELL_SIZE_PX = 30

export function GameBoard() {
  console.log('rerender GameBoard')

  const gameEngine = useGameEngine()
  // const board = useGameState(state => state.board)
  const visibleBoard = useGameState(state => state.visibleBoard)
  const gameStatus = useGameState(state => state.gameStatus)

  const onClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const index = e.currentTarget.dataset.index

    if (e.type === 'click') {
      console.log(`Open tile ${index}`)
      gameEngine.reveal(Number(index))
    }
    else if (e.type === 'contextmenu') {
      gameEngine.flag(Number(index))
      console.log(`Flag tile ${index}`)
    }
  }, [gameEngine.reveal, gameEngine.flag])

  const changeVisibleBoard = useCallback((startNodeX: number, startNodeY: number) => {
    console.log(`updateGrid ${startNodeX} ${startNodeY}`)
    gameEngine.updateVisibleBoard(startNodeX, startNodeY)
  }, [gameEngine])

  const sharedItemProps = useMemo(() => {
    return {
      onClick,
      gameStatus,
    }
  }, [onClick, gameStatus])

  return (
    <>
      <VirtualGrid
        updateGrid={changeVisibleBoard}
        data={visibleBoard}
        Item={Tile}
        sharedItemProps={sharedItemProps}
        width={gameEngine._width}
        height={gameEngine._height}
        cellSizePx={CELL_SIZE_PX}
        cellsInViewportWidth={10}
        cellsInViewportHeight={10}
      />

      {/*
      <br />
      <br />
      <div className={css.board}>
        {board.map((tile, index) => (
          <Tile
            value={tile}
            index={index}
            onClick={onClick}
            gameStatus={gameStatus}
          />
        ))}
      </div> */}
    </>
  )
}
