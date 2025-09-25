// import type { GameState, TileValue } from './types'

import type { AbstractScheduler } from '../core/AbstractScheduler'
import type { MainThreadMessage, WorkerMessage } from './GameWebWorker'
import { PubSub } from '../core/PubSub'
import { EXPLODED_CODE, FLAG_ENUMS, HIDDEN_ENUMS, HIDDEN_MINE_CODE, INITIAL_BOARD_HEIGHT, INITIAL_BOARD_WIDTH, INITIAL_MINES, MINE_ENUMS } from './consts'

interface InitArgs {
  width?: number
  height?: number
  minesNum?: number
}

export type GameStatus = 'READY' | 'PENDING' | 'PLAYING' | 'DEAD' | 'WIN'

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

  private _gameUpdatePubSub: PubSub = new PubSub('game_update')

  private scheduler: AbstractScheduler

  public offsetX = 0
  public offsetY = 0
  public visibleBoard: Array<{ value: number, index: number }> = []

  private worker: Worker = new Worker(new URL('./GameWebWorker.ts', import.meta.url), { type: 'module' })

  /** Game time in seconds */
  private _gameTimeSeconds = 0

  private _gameTimeoutId: ReturnType<typeof setTimeout> | null = null

  constructor({
    width = INITIAL_BOARD_WIDTH,
    height = INITIAL_BOARD_HEIGHT,
    minesNum = INITIAL_MINES,
    scheduler,
  }: {
    width?: number
    height?: number
    minesNum?: number
    scheduler: AbstractScheduler
  }) {
    this.scheduler = scheduler

    this.worker.onmessage = (event: MessageEvent<MainThreadMessage>) => {
      if (event.data.type === 'GENERATE_BOARD_RESPONSE') {
        this.gameStatus = 'PLAYING'

        this._boardBuffer = event.data.data.buffer
        this._uInt8Array = new Uint8Array(this._boardBuffer)
        this._emptyTileIndex = event.data.data.emptyTileIndex

        this.updateVisibleBoard()
      }
    }

    this.restart({ width, height, minesNum })
  }

  runGameLoopTimer() {
    this._gameTimeoutId = setTimeout(() => {
      this._gameTimeSeconds += 1
      this._gameUpdatePubSub.emit()
      this.runGameLoopTimer()
    }, 1000)
  }

  restart({ width, height, minesNum }: InitArgs = {}) {
    this.scheduler.clear()

    clearTimeout(this._gameTimeoutId!)
    this._gameTimeoutId = null
    this._gameTimeSeconds = 0

    this._width = width ?? this._width
    this._height = height ?? this._height
    this._minesNum = minesNum ?? this._minesNum

    this._minesLeft = this._minesNum
    this._tilesLeft = this._width * this._height - this._minesNum

    this._userDidFirstMove = false

    this._boardBuffer = new ArrayBuffer(this._width * this._height)
    this._uInt8Array = new Uint8Array(this._boardBuffer)

    this.gameStatus = 'PENDING'

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

    if (!this._gameTimeoutId) {
      this.runGameLoopTimer()
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
      gameTimeSeconds: this._gameTimeSeconds,
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

    this._gameUpdatePubSub.emit()
  }

  reveal(index: number) {
    if (this.gameStatus !== 'PLAYING') {
      return
    }

    if (!this._gameTimeoutId) {
      this.runGameLoopTimer()
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
      clearTimeout(this._gameTimeoutId!)
      this.updateVisibleBoard()

      return
    }

    if (HIDDEN_ENUMS.has(tile)) {
      this._tilesLeft -= 1

      const neighborMinesNum = [...this.getNeighborsIndexes(index, MINE_ENUMS)].length

      this._uInt8Array[index] = neighborMinesNum

      if (neighborMinesNum === 0) {
        for (const neighborIndex of this.getNeighborsIndexes(index, HIDDEN_ENUMS)) {
          this.scheduler.postTask(() => {
            this.reveal(neighborIndex)
          })
        }
      }
    }

    if (this._tilesLeft === 0) {
      this._minesLeft = 0
      this.gameStatus = 'WIN'
      clearTimeout(this._gameTimeoutId!)

      this.updateVisibleBoard()

      return
    }

    this.updateVisibleBoard()
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

  subscribe(callback: () => void) {
    return this._gameUpdatePubSub.subscribe(callback)
  }
}
