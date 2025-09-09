import { generateMines } from './generateMines'
// import { generateMines_arraySort } from './generateMines_arraySort'
// import { generateMines_fisherYatesShuffle } from './generateMines_fisherYatesShuffle'

declare const self: DedicatedWorkerGlobalScope
export {}

export interface WorkerMessage {
  type: 'GENERATE_BOARD_REQUEST'
  payload: {
    array: Uint8Array<ArrayBuffer>
    minesNum: number
  }
}

export interface MainThreadMessage {
  type: 'GENERATE_BOARD_RESPONSE'
  data: {
    buffer: ArrayBuffer
    emptyTileIndex: number
  }
}

self.onmessage = function (event: MessageEvent<WorkerMessage>) {
  if (event.data.type === 'GENERATE_BOARD_REQUEST') {
    const { array, minesNum } = event.data.payload
    const emptyTileIndex = generateMines(array, minesNum)
    // const emptyTileIndex = generateMines_arraySort(array, minesNum)
    // const emptyTileIndex = generateMines_fisherYatesShuffle(array, minesNum)

    const sendEvent: MainThreadMessage = {
      type: 'GENERATE_BOARD_RESPONSE',
      data: { buffer: array.buffer, emptyTileIndex },
    }

    self.postMessage(sendEvent, [array.buffer])
  }
}
