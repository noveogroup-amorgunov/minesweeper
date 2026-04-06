import type { GenerationMode } from './types'
import { createSeededRandom, generateMines } from './generateMines'

declare const self: DedicatedWorkerGlobalScope
export {}

export interface WorkerMessage {
  type: 'GENERATE_BOARD_REQUEST'
  payload: {
    array: Uint8Array
    minesNum: number
    mode?: GenerationMode
    seed?: string
  }
}

export interface MainThreadMessage {
  type: 'GENERATE_BOARD_RESPONSE'
  data: {
    buffer: ArrayBufferLike
    emptyTileIndex: number
  }
}

self.onmessage = function (event: MessageEvent<WorkerMessage>) {
  if (event.data.type === 'GENERATE_BOARD_REQUEST') {
    const { array, minesNum, mode, seed } = event.data.payload

    // Choose random generator based on mode
    let random: (() => number) | undefined
    if (mode === 'seeded' && seed) {
      random = createSeededRandom(seed)
    }
    // If mode is 'random' or undefined, use default Math.random

    const emptyTileIndex = generateMines(array, minesNum, random)

    const sendEvent: MainThreadMessage = {
      type: 'GENERATE_BOARD_RESPONSE',
      data: { buffer: array.buffer, emptyTileIndex },
    }

    self.postMessage(sendEvent, [array.buffer])
  }
}
