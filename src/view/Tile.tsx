import { memo } from 'react'
import {
  EXPLODED_CODE,
  FLAG_ENUMS,
  HIDDEN_ENUMS,
  HINT_ENUMS,
  MINE_ENUMS,
} from '../engine/consts'
import css from './Tile.module.css'

// const propsAreEqual = (prevProps: TileViewProps, nextProps: TileViewProps) => {
//     const {itemData, sharedItemData} = prevProps;

//     return (
//         itemData.value === nextProps.itemData.value &&
//         itemData.index === nextProps.itemData.index &&
//         sharedItemData.onFlag === nextProps.sharedItemData.onFlag &&
//         sharedItemData.onReveal === nextProps.sharedItemData.onReveal &&
//         sharedItemData.gameState.state ===
//             nextProps.sharedItemData.gameState.state &&
//         sharedItemData.gameState.isProcessing ===
//             nextProps.sharedItemData.gameState.isProcessing
//     );
// };

interface Props {
  // TODO: optimize and don't pass hidden value
  value: number
  index: number
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void
  // TODO: move to types
  gameStatus: 'READY' | 'PENDING' | 'PLAYING' | 'DEAD' | 'WIN'
}

function TileComponent({ value, index, onClick, gameStatus }: Props) {
  const label = (HINT_ENUMS.has(value) && value) || ''

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

  return (
    <div
      data-index={index}
      className={classes.join(' ')}
      onClick={onClick}
      onContextMenu={onClick}
    >
      {label}
    </div>
  )
}

export const Tile = memo(TileComponent)
