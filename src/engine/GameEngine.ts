// import type { GameState, TileValue } from './types'

import type { MainThreadMessage, WorkerMessage } from './GameWebWorker'
import { EventEmitter } from '../core/EventEmitter'
import { Scheduler } from '../core/Scheduler'
import { EXPLODED_CODE, FLAG_ENUMS, HIDDEN_ENUMS, HIDDEN_MINE_CODE, INITIAL_BOARD_HEIGHT, INITIAL_BOARD_WIDTH, INITIAL_MINES, MINE_ENUMS } from './consts'

type Values<T> = T[keyof T]
interface InitArgs {
  width?: number
  height?: number
  minesNum?: number
}

export type GameStatus = 'READY' | 'PENDING' | 'PLAYING' | 'DEAD' | 'WIN'

export const GAME_ENGINE_EVENTS = {
  UPDATE: 'game_update',
} as const

export class GameEngine {
  private _width: number = INITIAL_BOARD_WIDTH
  private _height: number = INITIAL_BOARD_HEIGHT
  private _minesNum: number = INITIAL_MINES

  // TODO: pass this values to constructor from view layer
  private _viewportHeight = 10
  private _viewportWidth = 10

  /** Number of unrevealed mines  */
  private _minesLeft = 0

  /** Number of unrevealed tiles  */
  private _tilesLeft = 0

  /** Tiles storage, allocate width*height bytes */
  _boardBuffer: ArrayBuffer = new ArrayBuffer(0)

  /** Unsigned int8 array view presenter */
  _uInt8Array: Uint8Array = new Uint8Array(0)

  /** Game status */
  public gameStatus: GameStatus = 'READY'

  /** Store any empty title to handle first user click */
  private _emptyTileIndex = -1

  /** User start game */
  private _userDidFirstMove = false

  private _eventEmitter: EventEmitter = new EventEmitter()

  public scheduler: Scheduler = new Scheduler()

  public offsetX = 0
  public offsetY = 0
  public visibleBoard: Array<{ value: number, index: number }> = []

  // public abortTaskController = new TaskController()

  private worker: Worker = new Worker(new URL('./GameWebWorker.ts', import.meta.url), { type: 'module' })

  constructor(
    width = INITIAL_BOARD_WIDTH,
    height = INITIAL_BOARD_HEIGHT,
    minesNum = INITIAL_MINES,
  ) {
    this.worker.onmessage = (event: MessageEvent<MainThreadMessage>) => {
      if (event.data.type === 'GENERATE_BOARD_RESPONSE') {
        this.gameStatus = 'PLAYING'

        this._boardBuffer = event.data.data.buffer
        this._uInt8Array = new Uint8Array(this._boardBuffer)
        this._emptyTileIndex = event.data.data.emptyTileIndex

        // this._eventEmitter.emit(GAME_ENGINE_EVENTS.UPDATE)
        this.updateVisibleBoard()
      }
    }

    this.restart({ width, height, minesNum })
  }

  restart({ width, height, minesNum }: InitArgs = {}) {
    this.scheduler.clear()
    // this.abortTaskController.abort()
    // this.abortTaskController = new TaskController()

    this._width = width ?? this._width
    this._height = height ?? this._height
    this._minesNum = minesNum ?? this._minesNum

    this._minesLeft = this._minesNum
    this._tilesLeft = this._width * this._height - this._minesNum

    this._userDidFirstMove = false

    this._boardBuffer = new ArrayBuffer(this._width * this._height)
    this._uInt8Array = new Uint8Array(this._boardBuffer)

    this.gameStatus = 'PENDING'

    // this.generateBoard()
    // this.gameStatus = 'PLAYING'

    // this._eventEmitter.emit(GAME_ENGINE_EVENTS.UPDATE)
    this.updateVisibleBoard()

    this.worker.postMessage(
      { type: 'GENERATE_BOARD_REQUEST', payload: { array: this._uInt8Array, minesNum: this._minesNum } } as WorkerMessage,
      [this._boardBuffer],
    )
  }

  flag(index: number) {
    if (this.gameStatus !== 'PLAYING') {
      return
    }

    const tile = this._uInt8Array[index]

    if (FLAG_ENUMS.has(tile)) {
      this._uInt8Array[index] += 2
      this._minesLeft += 1
    }
    else if (HIDDEN_ENUMS.has(tile) && this._minesLeft > 0) {
      this._uInt8Array[index] -= 2
      this._minesLeft -= 1
    }

    // this._eventEmitter.emit(GAME_ENGINE_EVENTS.UPDATE)
    this.updateVisibleBoard()
  }

  getGameState() {
    return {
      visibleBoard: this.visibleBoard,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      gameStatus: this.gameStatus,
      minesLeft: this._minesLeft,
      minesNum: this._minesNum,
      tilesLeft: this._tilesLeft,
      boardByteLength: this._boardBuffer.byteLength,
      height: this._height,
      width: this._width,
    }
  }

  updateVisibleBoard(offsetX?: number, offsetY?: number) {
    this.offsetX = offsetX ?? this.offsetX
    this.offsetY = offsetY ?? this.offsetY

    const res: Array<{ value: number, index: number }> = []

    const lastY = Math.min(this.offsetY + this._viewportHeight, this._height)
    const lastX = Math.min(this.offsetX + this._viewportWidth, this._width)

    for (let i = this.offsetY; i < lastY; i++) {
      for (let j = this.offsetX; j < lastX; j++) {
        const idx = j + i * this._width
        res.push({
          value: this._uInt8Array[idx] as number, // as TileValue
          index: idx,
        })
      }
    }

    this.visibleBoard = res

    this._eventEmitter.emit(GAME_ENGINE_EVENTS.UPDATE)
  }

  reveal(index: number) {
    if (this.gameStatus !== 'PLAYING') {
      return
    }

    const tile = this._uInt8Array[index]

    if (!HIDDEN_ENUMS.has(tile)) {
      return
    }

    if (MINE_ENUMS.has(tile) && !this._userDidFirstMove) {
      this._uInt8Array[index] = this._uInt8Array[this._emptyTileIndex]
      this._uInt8Array[this._emptyTileIndex] = HIDDEN_MINE_CODE
      this.reveal(index)
      return
    }

    this._userDidFirstMove = true

    if (MINE_ENUMS.has(tile)) {
      this._uInt8Array[index] = EXPLODED_CODE
      this.gameStatus = 'DEAD'
      this._minesLeft = Math.min(0, this._minesLeft - 1) // FIXME: always 0

      this.updateVisibleBoard()
      // this._eventEmitter.emit(GAME_ENGINE_EVENTS.UPDATE)

      return
    }

    if (HIDDEN_ENUMS.has(tile)) {
      // console.log('reveal::CLICK_TO_HIDDEN')

      this._tilesLeft -= 1

      const neighborMinesNum = [...this.getNeighborsIndexes(index, MINE_ENUMS)].length

      this._uInt8Array[index] = neighborMinesNum

      if (neighborMinesNum === 0) {
        for (const neighborIndex of this.getNeighborsIndexes(index, HIDDEN_ENUMS)) {
          // @ts-expect-erro1r 123
          // scheduler.postTask(() => {
          //   this.reveal(neighborIndex)
          // }, { priority: 'background', signal: this.abortTaskController.signal })

          this.scheduler.scheduleLowPriority(() => {
            this.reveal(neighborIndex)
          })
        }
      }
    }

    if (this._tilesLeft === 0) {
      this._minesLeft = 0
      this.gameStatus = 'WIN'

      this.updateVisibleBoard()
      // this._eventEmitter.emit(GAME_ENGINE_EVENTS.UPDATE)

      return
    }

    this.updateVisibleBoard()
    // this._eventEmitter.emit(GAME_ENGINE_EVENTS.UPDATE)
  }

  private getNeighborsIndexes(index: number, _set: Set<number>) {
    const x = index % this._width
    const y = Math.floor(index / this._width)
    const res = []

    for (let dx = -1; dx < 2; dx++) {
      for (let dy = -1; dy < 2; dy++) {
        if (dx !== 0 || dy !== 0) {
          const x2 = x + dx
          const y2 = y + dy
          if (
            x2 >= 0
            && x2 < this._width
            && y2 >= 0
            && y2 < this._height
          ) {
            const i = this._width * y2 + x2
            if (_set.has(this._uInt8Array[i]) && i !== index) {
              res.push(i)
            }
          }
        }
      }
    }

    return res
  }

  on(event: Values<typeof GAME_ENGINE_EVENTS>, callback: () => void) {
    this._eventEmitter.on(event, callback)
  }

  off(event: Values<typeof GAME_ENGINE_EVENTS>, callback: () => void) {
    this._eventEmitter.off(event, callback)
  }
}
