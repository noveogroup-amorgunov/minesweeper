import React from 'react';
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
    };
    sharedItemData: {
        onFlag: (index: number) => void;
        onReveal: (index: number) => void;
        gameState: {state: GameState; isProcessing: boolean};
    };
};

const propsAreEqual = (prevProps: TileViewProps, nextProps: TileViewProps) => {
    const {itemData, sharedItemData} = prevProps;

    return (
        itemData.value === nextProps.itemData.value &&
        itemData.index === nextProps.itemData.index &&
        sharedItemData.onFlag === nextProps.sharedItemData.onFlag &&
        sharedItemData.onReveal === nextProps.sharedItemData.onReveal &&
        sharedItemData.gameState.state ===
            nextProps.sharedItemData.gameState.state &&
        sharedItemData.gameState.isProcessing ===
            nextProps.sharedItemData.gameState.isProcessing
    );
};

export const TileView = React.memo(function TileView({
    itemData,
    sharedItemData,
}: TileViewProps) {
    const {value, index} = itemData;
    const {
        gameState: {state, isProcessing},
        onFlag,
        onReveal,
    } = sharedItemData;

    const isPlaying = !isProcessing && state === 'PLAYING';

    const onFlagClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (isPlaying) {
            onFlag(index);
        }
    };

    const onRevealClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (isPlaying) {
            onReveal(index);
        }
    };

    const label = (HINT_ENUMS.has(value) && value) || '';

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
            onClick={onRevealClick}
            onContextMenu={onFlagClick}
        >
            {label}
        </div>
    );
},
propsAreEqual);
