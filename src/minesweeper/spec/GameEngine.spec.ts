import {GameEngine} from '../GameEngine';
import {generateMines} from '../GameWorker';
import {Worker} from './__mocks__/Worker';
import {requestIdleCallback} from './__mocks__/requestIdleCallback';

// @ts-expect-error Worker is not provided in jest
window.Worker = Worker;
// @ts-expect-error requestIdleCallback is not provided in jest
window.requestIdleCallback = requestIdleCallback;

/** Copy from ../constants.ts to check real code */
const FLAG_ENUM = 10;
const FLAG_MINE_ENUM = 9;
const HIDDEN_ENUM = 12;
const HIDDEN_MINE_ENUM = 11;
const EXPLODED_ENUM = 13;
const HIDDEN_ENUMS = new Set([HIDDEN_MINE_ENUM, HIDDEN_ENUM]);

let gameEngine: GameEngine;

describe('minesweeper/GameEngine', () => {
    beforeEach(() => {
        gameEngine = new GameEngine({
            width: 100,
            height: 100,
            minesNum: 10,
        });

        generateMines(gameEngine.uInt8Array, 10);
    });

    describe('requestViewportGrid', () => {
        it('should emit viewport array', () => {
            const mockFn = jest.fn();
            gameEngine.addUpdateGridListener(mockFn);
            gameEngine.requestViewportGrid({
                startNodeX: 8,
                startNodeY: 10,
                viewportHeight: 2,
                viewportWidth: 2,
            });

            expect(mockFn).toBeCalledWith([
                {index: 8 + 100 * 10, value: 12},
                {index: 8 + 1 + 100 * 10, value: 12},
                {index: 8 + 100 * (10 + 1), value: 12},
                {index: 8 + 1 + 100 * (10 + 1), value: 12},
            ]);
        });

        it('should use last viewport offset if it is not passed', () => {
            const mockFn = jest.fn();

            gameEngine.uInt8Array[0] = 12;
            gameEngine.uInt8Array[1] = 12;
            gameEngine.uInt8Array[100] = 12;
            gameEngine.uInt8Array[101] = 12;

            gameEngine.addUpdateGridListener(mockFn);

            // @ts-expect-error private prop
            gameEngine.lastRequestViewportGridArgs = {
                startNodeX: 0,
                startNodeY: 0,
                viewportHeight: 2,
                viewportWidth: 2,
            };

            gameEngine.requestViewportGrid();

            expect(mockFn).toBeCalledWith([
                {index: 0, value: 12},
                {index: 1, value: 12},
                {index: 100, value: 12},
                {index: 101 * 1, value: 12},
            ]);
        });
    });

    describe('flag', () => {
        it('should flag mine by index', () => {
            let index = 0;

            for (let i = 0; i < gameEngine.uInt8Array.length; i++) {
                if (gameEngine.uInt8Array[i] === HIDDEN_MINE_ENUM) {
                    index = i;
                    break;
                }
            }

            gameEngine.flag(index);

            expect(gameEngine.uInt8Array[index]).toEqual(FLAG_MINE_ENUM);
        });

        it('should flag hint by index', () => {
            let index = 0;

            for (let i = 0; i < gameEngine.uInt8Array.length; i++) {
                if (gameEngine.uInt8Array[i] === HIDDEN_ENUM) {
                    index = i;
                    break;
                }
            }

            gameEngine.flag(index);

            expect(gameEngine.uInt8Array[index]).toEqual(FLAG_ENUM);
        });

        it('should unflag hint by index', () => {
            const index = 0;

            gameEngine.uInt8Array[index] = FLAG_ENUM;
            gameEngine.flag(index);

            expect(gameEngine.uInt8Array[index]).toEqual(HIDDEN_ENUM);
        });
    });

    describe('reveal', () => {
        it('should put empty hidden tile to stack', () => {
            const index = 1333;
            gameEngine.uInt8Array[index] = HIDDEN_ENUM;

            gameEngine.reveal(index);

            expect(gameEngine.getRevealStack()).toEqual([index]);
        });

        it('should handle case if user click to mine in first move', () => {
            const index = 1333;
            const emptyIndex = 1500;

            gameEngine.emptyTileIndex = emptyIndex;
            gameEngine.uInt8Array[emptyIndex] = HIDDEN_ENUM;
            gameEngine.uInt8Array[index] = HIDDEN_MINE_ENUM;

            gameEngine.reveal(index);

            expect(gameEngine.state).toEqual('PLAYING');
            expect(gameEngine.uInt8Array[index]).toEqual(HIDDEN_ENUM);
            expect(gameEngine.uInt8Array[emptyIndex]).toEqual(HIDDEN_MINE_ENUM);
        });

        it('should end game if user click to mine', () => {
            const index = 1333;
            gameEngine.uInt8Array[index] = HIDDEN_MINE_ENUM;

            gameEngine.reveal(index - 1);
            gameEngine.reveal(index);

            expect(gameEngine.state).toEqual('DEAD');
            expect(gameEngine.uInt8Array[index]).toEqual(EXPLODED_ENUM);
        });

        it('should do nothing if game state is not started', () => {
            const index = 1333;
            gameEngine.state = 'DEAD';

            gameEngine.reveal(index);

            expect(gameEngine.getRevealStack()).toEqual([]);
        });

        it('should do nothing if tile is not hidden', () => {
            const index = 1333;
            gameEngine.uInt8Array[index] = 5;

            gameEngine.reveal(index);

            expect(gameEngine.getRevealStack()).toEqual([]);
        });
    });

    describe('revealingStack', () => {
        it('should put all empty neighbors to stack if tile is 0', () => {
            const mockFn = jest.fn();
            const index = 1333;
            gameEngine.addUpdateGridListener(mockFn);
            gameEngine.uInt8Array[index] = HIDDEN_ENUM;
            gameEngine.setRevealStack([index]);
            // @ts-expect-error private method
            gameEngine.revealingStack();

            expect(mockFn).toBeCalledTimes(1);
            expect(gameEngine.getRevealStack().length).toEqual(8);
        });

        it('should put nothing to stack if tile is not 0', () => {
            const mockFn = jest.fn();
            const index = 1333;
            gameEngine.addUpdateGridListener(mockFn);
            gameEngine.uInt8Array[index] = HIDDEN_ENUM;
            gameEngine.uInt8Array[index + 1] = HIDDEN_MINE_ENUM;
            gameEngine.setRevealStack([index]);
            // @ts-expect-error private method
            gameEngine.revealingStack();

            expect(mockFn).toBeCalledTimes(1);
            expect(gameEngine.getRevealStack()).toEqual([]);
        });

        it('should finish game if empty tiles are not left', () => {
            const mockFn = jest.fn();
            const index = 1333;
            gameEngine.addUpdateGridListener(mockFn);
            gameEngine.tilesLeft = 1;
            gameEngine.uInt8Array[index] = HIDDEN_ENUM;
            gameEngine.setRevealStack([index]);
            // @ts-expect-error private method
            gameEngine.revealingStack();

            expect(mockFn).toBeCalledTimes(1);
            expect(gameEngine.state).toEqual('WIN');
            expect(gameEngine.tilesLeft).toEqual(0);
            expect(gameEngine.minesLeft).toEqual(0);
        });

        it('should do nothing if stack is empty', () => {
            const mockFn = jest.fn();
            gameEngine.addUpdateGridListener(mockFn);
            // @ts-expect-error private method
            gameEngine.revealingStack();

            expect(mockFn).toBeCalledTimes(0);
        });
    });

    describe('*getNeighbors', () => {
        it('should yield a tile neighbors with exact type', () => {
            const index = 155;
            const actualIndexes = [];
            const expected = [54, 154, 254, 55, 255, 56, 156, 256];

            // @ts-expect-error private method
            for (const neighborIndex of gameEngine.getNeighborsIndexes(
                index,
                HIDDEN_ENUMS
            )) {
                actualIndexes.push(neighborIndex);
            }

            expect(actualIndexes).toEqual(expected);
        });
    });
});
