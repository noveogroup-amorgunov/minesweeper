import React, {useEffect, useState, useCallback, useRef, useMemo} from 'react';
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

    const cellsInViewportWidth = Math.min(
        gameEngine.current?.width || width,
        10
    );
    const cellsInViewportHeight = Math.min(
        gameEngine.current?.height || height,
        10
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
        [cellsInViewportHeight, cellsInViewportWidth]
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

    const buttonLabel = useMemo(() => {
        if (gameState.state === 'PLAYING') {
            return 'Restart';
        }
        if (gameState.state === 'DEAD') {
            return 'You dead! Try again';
        }
        if (gameState.state === 'WIN') {
            return 'You won! Restart';
        }
    }, [gameState]);

    const onFlag = (index: number) => gameEngine.current.flag(index);
    const onReveal = (index: number) => gameEngine.current.reveal(index);
    const sharedItemData = useMemo(
        () => ({
            onFlag,
            onReveal,
            gameState,
        }),
        [gameState]
    );

    return {
        data,
        gameState,
        gameEngine,
        cellsInViewportWidth,
        cellsInViewportHeight,
        onGameCreate,
        updateGrid,
        buttonLabel,
        sharedItemData,
    };
};

type GameTopPanelProps = {
    minesLeft?: number;
    minesNum?: number;
    startGameButtonRef: React.Ref<HTMLButtonElement>;
    onGameCreate: (e: React.MouseEvent) => void;
    buttonLabel: string;
};

const GameTopPanel = React.memo(function GameTopPanel({
    minesLeft = 0,
    minesNum = 99,
    startGameButtonRef,
    onGameCreate,
    buttonLabel,
}: GameTopPanelProps) {
    return (
        <div className="game__stats">
            <Counter
                value={Math.max(minesLeft, 0)}
                minLength={String(minesNum).length + 1}
            />
            <Button ref={startGameButtonRef} size="lg" onClick={onGameCreate}>
                {buttonLabel}
            </Button>
        </div>
    );
});

type GameLoaderProps = {isVisible: boolean};

const GameLoader = React.memo(function GameLoader({
    isVisible = false,
}: GameLoaderProps) {
    return (
        <div
            className="game__loader"
            style={{visibility: isVisible ? 'visible' : 'hidden'}}
        >
            <Hourglass size={32} />
        </div>
    );
});

type GameViewProps = {
    width: number;
    height: number;
    minesNum: number;
};

export const GameView = withGameWindow(
    React.forwardRef<HTMLButtonElement, GameViewProps>(function GameView(
        {width, height, minesNum}: GameViewProps,
        startGameButtonRef
    ) {
        const {
            data,
            gameState,
            gameEngine,
            cellsInViewportWidth,
            cellsInViewportHeight,
            onGameCreate,
            updateGrid,
            buttonLabel,
            sharedItemData,
        } = useEnhance({width, height, minesNum});

        return (
            <main className="game">
                <GameLoader isVisible={gameState.isProcessing} />
                <GameTopPanel
                    minesLeft={gameEngine.current?.minesLeft}
                    minesNum={minesNum}
                    startGameButtonRef={startGameButtonRef}
                    onGameCreate={onGameCreate}
                    buttonLabel={buttonLabel}
                />
                <VirtualGrid
                    updateGrid={updateGrid}
                    data={data}
                    Item={TileView}
                    sharedItemData={sharedItemData}
                    width={gameEngine.current?.width || width}
                    height={gameEngine.current?.height || height}
                    cellSize={TILE_SIZE}
                    cellsInViewportWidth={cellsInViewportWidth}
                    cellsInViewportHeight={cellsInViewportHeight}
                />
            </main>
        );
    })
);
