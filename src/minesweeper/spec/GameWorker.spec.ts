import {generateMines} from '../GameWorker';

/** Copy from ../constants.ts to check real code */
const HIDDEN_MINE_ENUM = 11;
const HIDDEN_ENUM = 12;

describe('minesweeper/GameWorker', () => {
    describe('generateMines', () => {
        it('should generate exact count of mines', () => {
            const array = new Uint8Array(new ArrayBuffer(100));
            const minesNum = 10;

            generateMines(array, minesNum);

            let actualMinesNum = 0;
            for (let i = 0; i < array.length; i++) {
                if (array[i] === HIDDEN_MINE_ENUM) {
                    actualMinesNum += 1;
                }
            }

            expect(actualMinesNum).toEqual(minesNum);
        });

        it('should generate exact count of mines in very large field', () => {
            const array = new Uint8Array(new ArrayBuffer(10 ** 8));
            const minesNum = 10 ** 8 - 1;

            generateMines(array, minesNum);

            let actualMinesNum = 0;
            for (let i = 0; i < array.length; i++) {
                if (array[i] === HIDDEN_MINE_ENUM) {
                    actualMinesNum += 1;
                }
            }

            expect(actualMinesNum).toEqual(minesNum);
        });

        it('should return index of empty tile', () => {
            const array = new Uint8Array(new ArrayBuffer(100));
            const minesNum = 99;

            const emptyTileIndex = generateMines(array, minesNum);

            expect(array[emptyTileIndex]).toEqual(HIDDEN_ENUM);
        });
    });
});
