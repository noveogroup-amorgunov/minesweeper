import React, {useCallback, useMemo} from 'react';
import {
    FLAG_ENUMS,
    HIDDEN_ENUMS,
    EXPLODED_ENUM,
    HINT_ENUMS,
    MINE_ENUMS,
} from './constants';
import type {GameState, TileValue} from './types';

type TileViewProps = {
    itemData: {
        value: TileValue;
        index: number;
        onFlag: (index: number) => void;
        onReveal: (index: number) => void;
        gameState: {state: GameState; isProcessing: boolean};
    };
};

export const TileView = React.memo(({itemData}: TileViewProps) => {
    const {
        value,
        index,
        gameState: {state, isProcessing},
    } = itemData;

    const isPlaying = useMemo(
        () => !isProcessing && state === 'PLAYING',
        [isProcessing, state]
    );

    const onFlag = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            isPlaying && itemData.onFlag(index);
        },
        [index, isPlaying]
    );

    const onReveal = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            isPlaying && itemData.onReveal(index);
        },
        [index, isPlaying]
    );

    let label = (HINT_ENUMS.has(value) && value) || '';

    const classes = [
        'tile',
        !isPlaying && 'tile_not_clickable',
        HINT_ENUMS.has(value) && `tile_hint`,
        (FLAG_ENUMS.has(value) || (state === 'WIN' && MINE_ENUMS.has(value))) &&
            'tile_flag',
        state === 'DEAD' && MINE_ENUMS.has(value) && 'tile_mine',
        HINT_ENUMS.has(value) && `tile_hint-${value}`,
        (HIDDEN_ENUMS.has(value) || FLAG_ENUMS.has(value)) && 'tile_brick',
        value === EXPLODED_ENUM && 'tile_exploded',
    ].filter(Boolean);

    return (
        <div
            data-index={index}
            className={classes.join(' ')}
            onClick={onReveal}
            onContextMenu={onFlag}
        >
            {label}
        </div>
    );
});
