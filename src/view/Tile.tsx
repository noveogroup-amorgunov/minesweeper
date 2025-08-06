import type { GameStatus } from '../engine/GameEngine'
import { memo, useCallback, useRef } from 'react'
import {
  EXPLODED_CODE,
  FLAG_ENUMS,
  HIDDEN_ENUMS,
  HINT_ENUMS,
  MINE_ENUMS,
} from '../engine/consts'
import css from './Tile.module.css'

interface Props {
  // TODO: optimize and don't pass hidden value / index,
  // so when user is scrolling react don't rerender tile (despite the fact that the index has changed)
  value: number
  index: number
  onTileOpen: (index: number, pressFlag: boolean) => void
  gameStatus: GameStatus
}

const LONG_PRESS_DURATION = 500 // 500ms for long press
const MOVE_THRESHOLD = 10 // 10px movement threshold

function TileComponent({ value, index, onTileOpen, gameStatus }: Props) {
  const label = (HINT_ENUMS.has(value) && value) || ''

  // Make right click (press flag) compatible with mobile Safari
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)
  const touchStartTimeRef = useRef(0)

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (gameStatus !== 'PLAYING') {
      return
    }

    touchStartTimeRef.current = Date.now()
    isLongPressRef.current = false

    // Clear any existing timeout
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current)
      longPressTimeoutRef.current = null
    }

    // Set timeout for long press
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true

      // Prevent text selection
      event.preventDefault()
      // Trigger context menu action
      onTileOpen(Number((event.target as HTMLDivElement).dataset.index), true)
    }, LONG_PRESS_DURATION)
  }, [onTileOpen, gameStatus])

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (longPressTimeoutRef.current) {
      const touch = event.touches[0]
      const startTouch = event.targetTouches[0]

      // Calculate distance moved
      const deltaX = Math.abs(touch.clientX - startTouch.clientX)
      const deltaY = Math.abs(touch.clientY - startTouch.clientY)

      // If moved too much, cancel long press
      if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
        clearTimeout(longPressTimeoutRef.current)
        longPressTimeoutRef.current = null
      }
    }
  }, [])

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    // Clear timeout
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current)
      longPressTimeoutRef.current = null
    }

    // If it was a long press, prevent the click
    if (isLongPressRef.current) {
      event.preventDefault()
      return
    }

    // Check if it was a short press (less than long press duration)
    const pressDuration = Date.now() - touchStartTimeRef.current
    if (pressDuration < LONG_PRESS_DURATION) {
      // This was a normal click/tap
      onTileOpen(Number(event.currentTarget.dataset.index), false)
    }
  }, [onTileOpen])

  const handleClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Only handle mouse clicks (not touch events)
    if (event.type === 'click' && longPressTimeoutRef.current === null) {
      event.preventDefault()
      onTileOpen(Number(event.currentTarget.dataset.index), false)
    }
  }, [onTileOpen])

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    // Handle right-click on desktop
    event.preventDefault()
    onTileOpen(Number(event.currentTarget.dataset.index), true)
  }, [onTileOpen])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onTileOpen(Number(event.currentTarget.dataset.index), false)
    }
  }, [onTileOpen])

  const classes = [
    css.tile,
    gameStatus !== 'PLAYING' && css.tile_not_clickable,
    HINT_ENUMS.has(value) && css.tile_hint,
    (FLAG_ENUMS.has(value) || (gameStatus === 'WIN' && MINE_ENUMS.has(value)))
    && css.tile_flag,
    gameStatus === 'DEAD' && MINE_ENUMS.has(value) && css.tile_mine,
    HINT_ENUMS.has(value) && css[`tile_hint-${value}`],
    (HIDDEN_ENUMS.has(value) || FLAG_ENUMS.has(value)) && css.tile_brick,
    value === EXPLODED_CODE && css.tile_exploded,
  ].filter(Boolean)

  const isClickable = gameStatus === 'PLAYING' && (HIDDEN_ENUMS.has(value) || FLAG_ENUMS.has(value))

  return (
    <div
      role="button"
      tabIndex={isClickable ? 0 : -1}
      aria-disabled={!isClickable}
      data-index={index}
      className={classes.join(' ')}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
    >
      {label}
    </div>
  )
}

export const Tile = memo(TileComponent)
