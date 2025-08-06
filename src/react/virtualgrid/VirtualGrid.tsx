import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import css from './VirtualGrid.module.css'

function useGridScroll() {
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const onScroll = useCallback((event: Event) =>
    requestAnimationFrame(() => {
      setScrollTop((event.target as HTMLDivElement).scrollTop)
      setScrollLeft((event.target as HTMLDivElement).scrollLeft)
    }), [])

  useEffect(() => {
    const scrollContainer = ref.current

    if (!scrollContainer) {
      return
    }

    setScrollTop(scrollContainer.scrollTop)
    setScrollLeft(scrollContainer.scrollLeft)
    scrollContainer.addEventListener('scroll', onScroll)

    return () => scrollContainer.removeEventListener('scroll', onScroll)
  }, [])

  return [scrollTop, scrollLeft, ref] as const
}

// interface Item<T, P> {
//   itemData: T
//   sharedItemData: P
//   width: number
//   height: number
//   cellSize: number
// }

interface Props<T, P> {
  updateGrid: (startNodeX: number, startNodeY: number) => void
  data: Array<T>
  width: number
  height: number
  cellSizePx: number
  // Item: React.ComponentType<P>
  Item: React.ComponentType<any>
  cellsInViewportHeight: number
  cellsInViewportWidth: number
  sharedItemProps: Partial<P>
}

export interface Styles extends React.CSSProperties {
  '--grid-cell': string
}

export function VirtualGrid<T, P>({
  updateGrid,
  data,
  width,
  height,
  cellSizePx,
  Item,
  sharedItemProps,
  cellsInViewportHeight,
  cellsInViewportWidth,
  // sharedItemData,
}: Props<T, P>) {
  const [scrollTop, scrollLeft, ref] = useGridScroll()
  const viewportWidth = cellsInViewportWidth * cellSizePx
  const viewportHeight = cellsInViewportHeight * cellSizePx

  const startCellY = Math.max(0, Math.floor(scrollTop / cellSizePx))
  const startCellX = Math.max(0, Math.floor(scrollLeft / cellSizePx))

  const totalHeight = `${height * cellSizePx}px`
  const totalWidth = `${width * cellSizePx}px`

  useEffect(
    () => updateGrid(startCellX, startCellY),
    [startCellY, startCellX, updateGrid],
  )

  const child = useMemo(
    () =>
      // data.map((tile: T) => (
      data.map((tile: any) => (
        <Item
          key={tile.index}
          value={tile.value}
          index={tile.index}
          {...sharedItemProps}
          // onClick={onClick}
          // gameStatus={gameStatus}
        />
      )),
    [data, width, height, cellSizePx, Item],
  )

  const styles: Styles = {
    'height': viewportHeight + 26,
    'width': viewportWidth + 26,
    '--grid-cell': `${cellSizePx}px`,
  }

  return (
    <div className={css.virtualgrid} style={styles} ref={ref}>
      <div
        className={css.virtualgrid__viewport}
        style={{ height: totalHeight, width: totalWidth }}
      >
        <div
          className={css.virtualgrid__content}
          style={{
            transform: `translate(${scrollLeft}px, ${scrollTop}px)`,
            width: `${cellSizePx * cellsInViewportWidth}px`,
            height: `${cellSizePx * cellsInViewportHeight}px`,
          }}
        >
          {child}
        </div>
      </div>
    </div>
  )
}
