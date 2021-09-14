import React, {useEffect, useState, useCallback, useRef} from 'react';
import {Button, Counter, Hourglass} from 'react95';
import {VirtualGrid} from '../virtualgrid/VirtualGrid';
import {GameEngine} from './GameEngine';
import {TileView} from './TileView';
import {TILE_SIZE} from './constants';
import type {GameState, Tiles} from './types';
import {withGameWindow} from './withGameWindow';
import './styles.css';

export const useEnhance = ({width, height, minesNum}: GameViewProps) => {
    const [data, setData] = useState<Tiles>([]);
    const [gameState, setGameState] = useState<{
        state: GameState;
        isProcessing: boolean;
    }>({
        state: 'PLAYING',
        isProcessing: false,
    });
    const gameEngine = useRef<GameEngine>(null);
    const [open, setOpen] = React.useState(false);

    const cellsInViewportWidth = Math.min(
        gameEngine.current?.width || width,
        10
    );
    const cellsInViewportHeight = Math.min(
        gameEngine.current?.height || height,
        10
    );

    const onFlag = useCallback(
        (index: number) => {
            gameEngine.current.flag(index);
        },
        [gameEngine.current]
    );

    const onReveal = useCallback(
        (index: number) => {
            gameEngine.current.reveal(index);
        },
        [gameEngine.current]
    );

    const updateGrid = useCallback(
        (startNodeX, startNodeY) => {
            if (!gameEngine.current) return;
            gameEngine.current.requestViewportGrid({
                startNodeX,
                startNodeY,
                viewportHeight: cellsInViewportHeight,
                viewportWidth: cellsInViewportWidth,
            });
        },
        [
            width,
            height,
            cellsInViewportHeight,
            cellsInViewportWidth,
            gameEngine.current,
        ]
    );

    useEffect(() => {
        gameEngine.current = new GameEngine({width, height, minesNum});

        gameEngine.current.requestViewportGrid({
            startNodeX: 0,
            startNodeY: 0,
            viewportHeight: cellsInViewportHeight,
            viewportWidth: cellsInViewportWidth,
        });

        const removeListeners = [
            gameEngine.current.addUpdateGridListener(setData),
            gameEngine.current.addUpdateGameStateListener(setGameState),
        ];

        return () => {
            removeListeners.forEach(remove => remove());
        };
    }, []);

    const onGameCreate = useCallback(() => {
        gameEngine.current.restart({width, height, minesNum});
    }, [width, height, minesNum]);

    return {
        data,
        setData,
        gameState,
        setGameState,
        gameEngine,
        open,
        setOpen,
        cellsInViewportWidth,
        cellsInViewportHeight,
        onFlag,
        onReveal,
        onGameCreate,
        updateGrid,
    };
};

type GameViewProps = {
    width: number;
    height: number;
    minesNum: number;
};

export const GameView = withGameWindow(
    React.forwardRef(
        ({width, height, minesNum}: GameViewProps, startGameButtonRef) => {
            const {
                data,
                gameState,
                gameEngine,
                cellsInViewportWidth,
                cellsInViewportHeight,
                onFlag,
                onReveal,
                onGameCreate,
                updateGrid,
            } = useEnhance({width, height, minesNum});

            return (
                <main className="game">
                    <div
                        className="game__loader"
                        style={{
                            visibility: gameState.isProcessing
                                ? 'visible'
                                : 'hidden',
                        }}
                    >
                        <Hourglass size={32} />
                    </div>
                    <div className="game__stats">
                        <Counter
                            value={Math.max(
                                gameEngine.current?.minesLeft || 0,
                                0
                            )}
                            minLength={
                                String(gameEngine.current?.minesNum || '  ')
                                    .length + 1
                            }
                        />
                        <Button
                            ref={startGameButtonRef}
                            size="lg"
                            onClick={onGameCreate}
                        >
                            {gameState.state === 'PLAYING' && 'Restart'}
                            {gameState.state === 'DEAD' &&
                                'You dead! Try again'}
                            {gameState.state === 'WIN' && 'You won! Restart'}
                        </Button>
                    </div>
                    <VirtualGrid
                        updateGrid={updateGrid}
                        data={data}
                        Item={TileView}
                        sharedItemData={{
                            onFlag,
                            onReveal,
                            gameState,
                        }}
                        width={gameEngine.current?.width || width}
                        height={gameEngine.current?.height || height}
                        cellSize={TILE_SIZE}
                        cellsInViewportWidth={cellsInViewportWidth}
                        cellsInViewportHeight={cellsInViewportHeight}
                    />
                </main>
            );
        }
    )
);
