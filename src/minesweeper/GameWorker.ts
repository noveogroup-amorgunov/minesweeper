declare const self: DedicatedWorkerGlobalScope;

import {HIDDEN_MINE_ENUM, HIDDEN_ENUM} from './constants';
import {EVENTS} from './eventTransport';

export function generateMines(array: Uint8Array, minesNum: number): number {
    const probability = minesNum / array.length;
    let generatedMines = 0;

    /**
     * Save hidden tile index to handle first user click.
     * It help us to swap this tile with first clicked one
     * if user click to mine.
     */
    let emptyTileIndex = 0;

    /**
     * Shuffle big array is very expensive,
     * so using simple Math.random() probability with O(2N)
     * in the worst case.
     */
    for (let i = 0; i < array.length; i++) {
        if (generatedMines >= minesNum) {
            for (let j = i; j < array.length; j++) {
                array[j] = HIDDEN_ENUM;
                emptyTileIndex = i;
            }
            break;
        }
        const isMine = Math.random() < probability;
        if (isMine) {
            generatedMines += 1;
            array[i] = HIDDEN_MINE_ENUM;
        } else {
            array[i] = HIDDEN_ENUM;
            emptyTileIndex = i;
        }
    }

    /**
     * If loop above generated mines less than specified value
     * add mines
     */
    if (minesNum > generatedMines) {
        for (let i = 0; i < array.length; i++) {
            if (array[i] === HIDDEN_MINE_ENUM || i === emptyTileIndex) {
                continue;
            }

            generatedMines += 1;
            array[i] = HIDDEN_MINE_ENUM;

            if (minesNum === generatedMines) {
                break;
            }
        }
    }

    return emptyTileIndex;
}

function initGrid({array, minesNum}: {array: Uint8Array; minesNum: number}) {
    const emptyTileIndex = generateMines(array, minesNum);
    return {inited: true, emptyTileIndex};
}

type IterableType<T = unknown> = {[key: string]: T};

function transferDataToMainThreadWithBuffer<T extends IterableType>(
    array: Uint8Array,
    result: T
) {
    self.postMessage({buffer: array.buffer, ...(result || {})}, [array.buffer]);
}

const eventToHandlerMap = {
    [EVENTS.INIT_BOARD]: initGrid,
};

if (typeof self === 'undefined') {
    // @ts-expect-error fix self error for jest
    global.self = {onmessage: e => e};
}

self.onmessage = function (e) {
    if (!Object.values(EVENTS).includes(e.data.type)) {
        // console.warn('Unknown event to worker', e);
        return;
    }

    const handler = eventToHandlerMap[e.data.type];
    const result = handler(e.data.payload as Parameters<typeof handler>[0]);
    transferDataToMainThreadWithBuffer(e.data.payload.array, result);
};
