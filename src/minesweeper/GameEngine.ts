import {initBoard} from './eventTransport';
import {
    FLAG_ENUMS,
    HIDDEN_ENUMS,
    MINE_ENUMS,
    EXPLODED_ENUM,
    HIDDEN_MINE_ENUM,
    INITIAL_BOARD_HEIGHT,
    INITIAL_BOARD_WIDTH,
    INITIAL_MINES,
} from './constants';
import type {GameState, TileValue} from './types';

type InitArgs = {
    width: number;
    height: number;
    minesNum: number;
};

type RequestViewportGridArgs = {
    startNodeX: number;
    startNodeY: number;
    viewportHeight: number;
    viewportWidth: number;
};

type UpdateGridListener = (
    grid: Array<{value: TileValue; index: number}>
) => void;
type UpdateGameStateListener = (gameState: {
    state: GameState;
    isProcessing: boolean;
}) => void;

export class GameEngine {
    /** Rows */
    width = INITIAL_BOARD_WIDTH;

    /** Columns */
    height = INITIAL_BOARD_HEIGHT;

    /** Num of the mines */
    minesNum = INITIAL_MINES;

    /** Game state */
    state: GameState = 'PLAYING';

    /** Number of unrevealed mines  */
    minesLeft = 0;

    /** Number of unrevealed tiles  */
    tilesLeft = 0;

    /** Listeners which call after updating game grid */
    updateGridListeners: UpdateGridListener[] = [];

    /** Listeners which call after updating game state */
    updateGameStateListeners: UpdateGameStateListener[] = [];

    /** Tiles storage, allocate width*height bytes */
    boardBuffer: ArrayBuffer;

    /** Unsigned int8 array view presenter */
    uInt8Array: Uint8Array;

    /** Store any empty title to handle first user click */
    emptyTileIndex = -1;

    /** User start game */
    userDidFirstMove = false;

    /** Processing data in worker */
    isProcessing = false;

    /** Temporary storage for viewport grid args */
    private lastRequestViewportGridArgs: RequestViewportGridArgs =
        {} as RequestViewportGridArgs;

    /** Tiles to reveal */
    private revealStack: number[] = [];

    private worker: Worker = new Worker('./worker.js');

    constructor({width, height, minesNum}: InitArgs) {
        this.boardBuffer = new ArrayBuffer(this.width * this.height);
        this.uInt8Array = new Uint8Array(this.boardBuffer);

        this.restart({width, height, minesNum});

        this.worker.addEventListener('message', event => {
            if (event.data.inited) {
                this.setProcessing(false);
                this.boardBuffer = event.data.buffer;
                this.uInt8Array = new Uint8Array(this.boardBuffer);
                this.emptyTileIndex = event.data.emptyTileIndex;
                this.requestViewportGrid();
            }
        });
    }

    getRevealStack(): number[] {
        return this.revealStack;
    }

    setRevealStack(nextRevealStack: number[]) {
        this.revealStack = nextRevealStack;
    }

    private setProcessing(isProcessing: boolean) {
        this.isProcessing = isProcessing;
        this.emitChangeGameState();
    }

    private setGameState(gameState: GameState) {
        this.state = gameState;
        this.emitChangeGameState();
    }

    private emitChangeGameState() {
        const {state, isProcessing} = this;
        this.updateGameStateListeners.forEach(listener =>
            listener({state, isProcessing})
        );
    }

    restart({width, height, minesNum}: InitArgs) {
        this.width = width;
        this.height = height;
        this.minesNum = minesNum;
        this.minesLeft = this.minesNum;
        this.tilesLeft = this.width * this.height - this.minesNum;
        this.userDidFirstMove = false;
        this.revealStack = [];

        this.boardBuffer = new ArrayBuffer(this.width * this.height);
        this.uInt8Array = new Uint8Array(this.boardBuffer);

        this.setGameState('PLAYING');
        this.setProcessing(true);
        this.revealingStack();
        this.worker.postMessage(
            initBoard({array: this.uInt8Array, width, height, minesNum}),
            [this.boardBuffer]
        );
    }

    addUpdateGridListener(fn: UpdateGridListener) {
        this.updateGridListeners.push(fn);

        return () => {
            this.updateGridListeners = this.updateGridListeners.filter(
                listener => listener !== fn
            );
        };
    }

    addUpdateGameStateListener(fn: UpdateGameStateListener) {
        this.updateGameStateListeners.push(fn);

        return () => {
            this.updateGameStateListeners =
                this.updateGameStateListeners.filter(
                    listener => listener !== fn
                );
        };
    }

    requestViewportGrid(nextProps?: RequestViewportGridArgs) {
        if (nextProps) {
            this.lastRequestViewportGridArgs = nextProps;
        }

        /**
         * If this.uInt8Array is empty and data is requested, buffer could transfer
         * to worker and isn't available here. Try request after after 10ms
         */
        if (this.uInt8Array.byteLength === 0) {
            return setTimeout(() => {
                this.requestViewportGrid();
            }, 10);
        }

        const {
            startNodeX: offsetX,
            startNodeY: offsetY,
            viewportWidth,
            viewportHeight,
        } = this.lastRequestViewportGridArgs;
        const {width, height} = this;
        const res: Array<{value: TileValue; index: number}> = [];

        const lastY = Math.min(offsetY + viewportHeight, height);
        const lastX = Math.min(offsetX + viewportWidth, width);

        for (let i = offsetY; i < lastY; i++) {
            for (let j = offsetX; j < lastX; j++) {
                const idx = j + i * width;
                res.push({
                    value: this.uInt8Array[idx] as TileValue,
                    index: idx,
                });
            }
        }

        this.updateGridListeners.forEach(listener => listener(res));
    }

    flag(index: number) {
        if (this.state !== 'PLAYING') {
            return;
        }

        const tile = this.uInt8Array[index];

        if (FLAG_ENUMS.has(tile)) {
            this.uInt8Array[index] += 2;
            this.minesLeft += 1;
        } else if (HIDDEN_ENUMS.has(tile) && this.minesLeft > 0) {
            this.uInt8Array[index] -= 2;
            this.minesLeft -= 1;
        }

        this.requestViewportGrid();
    }

    reveal(index: number) {
        if (this.state !== 'PLAYING') {
            return;
        }

        const tile = this.uInt8Array[index];

        if (!HIDDEN_ENUMS.has(tile)) {
            return;
        }

        if (MINE_ENUMS.has(tile)) {
            if (!this.userDidFirstMove) {
                this.uInt8Array[index] = this.uInt8Array[this.emptyTileIndex];
                this.uInt8Array[this.emptyTileIndex] = HIDDEN_MINE_ENUM;
                this.reveal(index);
                return;
            }

            this.uInt8Array[index] = EXPLODED_ENUM;
            this.setGameState('DEAD');
            this.minesLeft = Math.min(0, this.minesLeft - 1);
            this.requestViewportGrid();
            return;
        }

        this.userDidFirstMove = true;

        this.revealStack.push(index);
    }

    private revealingStack() {
        if (this.revealStack.length !== 0) {
            const index = this.revealStack.shift() as number;

            if (HIDDEN_ENUMS.has(this.uInt8Array[index])) {
                this.tilesLeft -= 1;

                const neighborMinesNum = [
                    ...this.getNeighborsIndexes(index, MINE_ENUMS),
                ].length;

                this.uInt8Array[index] = neighborMinesNum;

                if (neighborMinesNum === 0) {
                    for (const neighborIndex of this.getNeighborsIndexes(
                        index,
                        HIDDEN_ENUMS
                    )) {
                        this.revealStack.push(neighborIndex);
                    }
                }
            }

            if (this.tilesLeft === 0) {
                this.minesLeft = 0;
                this.setGameState('WIN');
                this.requestViewportGrid();
                return;
            }

            this.requestViewportGrid();
        }
        window.requestIdleCallback(() => this.revealingStack());
    }

    private getNeighborsIndexes(index: number, _set: Set<number>) {
        const x = index % this.width;
        const y = Math.floor(index / this.width);
        const res = [];

        for (let dx = -1; dx < 2; dx++) {
            for (let dy = -1; dy < 2; dy++) {
                if (dx !== 0 || dy !== 0) {
                    const x2 = x + dx;
                    const y2 = y + dy;
                    if (
                        x2 >= 0 &&
                        x2 < this.width &&
                        y2 >= 0 &&
                        y2 < this.height
                    ) {
                        const i = this.width * y2 + x2;
                        if (_set.has(this.uInt8Array[i]) && i != index) {
                            res.push(i);
                        }
                    }
                }
            }
        }

        return res;
    }
}
