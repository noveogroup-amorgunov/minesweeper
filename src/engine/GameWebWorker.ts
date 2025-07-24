import { generateMines } from './generateMines'

declare const self: DedicatedWorkerGlobalScope
export {}

export interface WorkerMessage {
  type: 'GENERATE_BOARD_REQUEST'
  payload: {
    array: Uint8Array
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

    self.postMessage(
      { type: 'GENERATE_BOARD_RESPONSE', data: { buffer: array.buffer, emptyTileIndex } } as MainThreadMessage,
      [array.buffer],
    )
  }
}
