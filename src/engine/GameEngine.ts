// import type { GameState, TileValue } from './types'

import type { MainThreadMessage, WorkerMessage } from './GameWebWorker'
import { EventEmitter } from '../core/EventEmitter'
import { Scheduler } from '../core/Scheduler'
import { EXPLODED_CODE, FLAG_ENUMS, HIDDEN_ENUMS, HIDDEN_MINE_CODE, INITIAL_BOARD_HEIGHT, INITIAL_BOARD_WIDTH, INITIAL_MINES, MINE_ENUMS } from './consts'

interface InitArgs {
  width?: number
  height?: number
  minesNum?: number
}

type GameStatus = 'READY' | 'PENDING' | 'PLAYING' | 'DEAD' | 'WIN'

declare global {
  interface Window {
    scheduler: {
      postTask: (task: () => void, options: { priority: 'background', signal: AbortSignal }) => void
    }
  }

  class TaskController {
    signal: AbortSignal
    abort: () => void
  }
}

// TODO: rename to GAME_ENGINE_EVENTS
export const GAME_EVENTS = {
  UPDATE: 'game_update',
} as const

export class GameEngine {
  // TODO: make private
  public _width: number = 0
  public _height: number = 0
  public _minesNum: number = 0

  /** Number of unrevealed mines  */
  public minesLeft = 0

  /** Number of unrevealed tiles  */
  public tilesLeft = 0

  /** Tiles storage, allocate width*height bytes */
  _boardBuffer: ArrayBuffer = new ArrayBuffer(0)

  /** Unsigned int8 array view presenter */
  _uInt8Array: Uint8Array = new Uint8Array(0)

  /** Game state */
  public gameStatus: GameStatus = 'READY'

  /** Store any empty title to handle first user click */
  private _emptyTileIndex = -1

  /** User start game */
  private _userDidFirstMove = false

  // TODO: make private
  public eventEmitter: EventEmitter = new EventEmitter()

  public scheduler: Scheduler = new Scheduler()

  public offsetX = 0
  public offsetY = 0
  public visibleBoard: Array<{ value: number, index: number }> = []

  // public abortTaskController = new TaskController()

  private worker: Worker = new Worker(new URL('./GameWebWorker.ts', import.meta.url), { type: 'module' })

  /** Tiles to reveal */
  // private revealStack: number[] = []

  // Normal signature with defaults
  constructor(
    width = INITIAL_BOARD_WIDTH,
    height = INITIAL_BOARD_HEIGHT,
    minesNum = INITIAL_MINES,
  ) {
    this.worker.onmessage = (event: MessageEvent<MainThreadMessage>) => {
      // console.log('🤮🤮🤮🤮🤮🤮 worker.onmessage:::', event)

      if (event.data.type === 'GENERATE_BOARD_RESPONSE') {
        this.gameStatus = 'PLAYING'

        this._boardBuffer = event.data.data.buffer
        this._uInt8Array = new Uint8Array(this._boardBuffer)
        this._emptyTileIndex = event.data.data.emptyTileIndex

        this.eventEmitter.emit(GAME_EVENTS.UPDATE)
        this.updateVisibleBoard()
        this.onUpdate()
      }
    }

    this.restart({ width, height, minesNum })
  }

  restart({ width, height, minesNum }: InitArgs = {}) {
    this.scheduler.clear()
    // this.abortTaskController.abort()
    // this.abortTaskController = new TaskController()

    this._width = width ?? this._width ?? INITIAL_BOARD_WIDTH
    this._height = height ?? this._height ?? INITIAL_BOARD_HEIGHT
    this._minesNum = minesNum ?? this._minesNum ?? INITIAL_MINES

    this.minesLeft = this._minesNum
    this.tilesLeft = this._width * this._height - this._minesNum

    this._userDidFirstMove = false
    // this.revealStack = []

    this._boardBuffer = new ArrayBuffer(this._width * this._height)
    this._uInt8Array = new Uint8Array(this._boardBuffer)

    this.gameStatus = 'PENDING'

    // this.eventEmitter = new EventEmitter()

    // this.generateBoard()
    // this.gameStatus = 'PLAYING'

    this.eventEmitter.emit(GAME_EVENTS.UPDATE)
    this.updateVisibleBoard()
    this.onUpdate()

    this.worker.postMessage(
      { type: 'GENERATE_BOARD_REQUEST', payload: { array: this._uInt8Array, minesNum: this._minesNum } } as WorkerMessage,
      // [this._uInt8Array.buffer],
      [this._boardBuffer],
    )

    console.log('restart:::emptyTileIndex', this._emptyTileIndex)
  }

  /* private async generateBoard() {
    console.log('✅✅ not generated')

    // @ts-expect-error 123
    await scheduler.postTask(() => {
      this._emptyTileIndex = generateMines(this._uInt8Array, this._minesNum)
      // this.reveal(neighborIndex)
    }, { priority: 'user-visible', signal: this.abortTaskController.signal })

    console.log('✅✅ generated')

    this.eventEmitter.emit(GAME_EVENTS.UPDATE)
    this.updateVisibleBoard()
    this.onUpdate()

    return

    // const numbers = Array(size).fill().map((_, index) => index + 1);
    // numbers.sort(() => Math.random() - 0.5);
    // console.log(numbers.slice(0, 8));

    const size = this._width * this._height

    for (let i = 0; i < size; i++) {
      this._uInt8Array[i] = HIDDEN_CODE
    }

    const nums = new Set<number>()

    while (nums.size !== this._minesNum) {
      nums.add(Math.floor(Math.random() * size))
    }

    const mineCells: number[] = [...nums]

    for (let i = 0; i < this._minesNum; i++) {
      this._uInt8Array[mineCells[i]] = HIDDEN_MINE_CODE
    }

    for (let i = 0; i < size; i++) {
      if (this._uInt8Array[i] !== HIDDEN_MINE_CODE) {
        this._emptyTileIndex = i
        break
      }
    }
  } */

  /* public getBoard() {
    const board = []

    for (let i = 0; i < this._width * this._height; i++) {
      board.push(this._uInt8Array[i])
    }

    return board
  } */

  flag(index: number) {
    console.log('flag:::', 'start')
    if (this.gameStatus !== 'PLAYING') {
      console.log('flag:::gameState is not PLAYING')
      return
    }

    const tile = this._uInt8Array[index]

    if (FLAG_ENUMS.has(tile)) {
      console.log('flag:::FLAG_ENUMS.has(tile)')
      this._uInt8Array[index] += 2
      this.minesLeft += 1
    }
    else if (HIDDEN_ENUMS.has(tile) && this.minesLeft > 0) {
      console.log('flag:::HIDDEN_ENUMS.has(tile) && this.minesLeft > 0')
      this._uInt8Array[index] -= 2
      this.minesLeft -= 1
    }

    this.eventEmitter.emit(GAME_EVENTS.UPDATE)
    this.updateVisibleBoard()
    this.onUpdate()
  }

  // TODO: remake to event emitter
  onUpdate = () => {}

  getGameState() {
    return {
      // board: this.getBoard(),
      visibleBoard: this.visibleBoard,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      gameStatus: this.gameStatus,
      minesLeft: this.minesLeft,
      tilesLeft: this.tilesLeft,
    }
  }

  updateVisibleBoard(offsetX?: number, offsetY?: number) {
    this.offsetX = offsetX ?? this.offsetX
    this.offsetY = offsetY ?? this.offsetY

    const res: Array<{ value: number, index: number }> = []

    const viewportHeight = 10
    const viewportWidth = 10

    const lastY = Math.min(this.offsetY + viewportHeight, this._height)
    const lastX = Math.min(this.offsetX + viewportWidth, this._width)

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

    const bytes = this._boardBuffer.byteLength

    console.log('bytes', bytes)
    console.log('kilobytes', bytes / 1024)
    console.log('megabytes', bytes / 1024 / 1024)

    this.eventEmitter.emit(GAME_EVENTS.UPDATE)
  }

  reveal(index: number) {
    // console.log('reveal:::', index)

    if (this.gameStatus !== 'PLAYING') {
      return
    }

    const tile = this._uInt8Array[index]

    if (!HIDDEN_ENUMS.has(tile)) {
      return
    }

    if (MINE_ENUMS.has(tile)) {
      // console.log('reveal::CLICK_TO_MINE')
      if (!this._userDidFirstMove) {
        // console.log('reveal::FIRST MOVE')

        this._uInt8Array[index] = this._uInt8Array[this._emptyTileIndex]
        this._uInt8Array[this._emptyTileIndex] = HIDDEN_MINE_CODE
        this.reveal(index)
        return
      }

      this._uInt8Array[index] = EXPLODED_CODE
      this.gameStatus = 'DEAD'
      this.minesLeft = Math.min(0, this.minesLeft - 1)

      this.onUpdate()
      this.updateVisibleBoard()
      this.eventEmitter.emit(GAME_EVENTS.UPDATE)

      return
    }

    this._userDidFirstMove = true

    if (HIDDEN_ENUMS.has(tile)) {
      // console.log('reveal::CLICK_TO_HIDDEN')

      this.tilesLeft -= 1

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

    if (this.tilesLeft === 0) {
      this.minesLeft = 0
      this.gameStatus = 'WIN'

      this.onUpdate()
      this.updateVisibleBoard()
      this.eventEmitter.emit(GAME_EVENTS.UPDATE)

      return
    }

    this.onUpdate()
    this.updateVisibleBoard()
    this.eventEmitter.emit(GAME_EVENTS.UPDATE)
  }

  // private revealingStack() {
  //   if (this.revealStack.length !== 0) {
  //     const index = this.revealStack.shift() as number

  //     if (HIDDEN_ENUMS.has(this.uInt8Array[index])) {
  //       this.tilesLeft -= 1

  //       const neighborMinesNum = [
  //         ...this.getNeighborsIndexes(index, MINE_ENUMS),
  //       ].length

  //       this.uInt8Array[index] = neighborMinesNum

  //       if (neighborMinesNum === 0) {
  //         for (const neighborIndex of this.getNeighborsIndexes(
  //           index,
  //           HIDDEN_ENUMS,
  //         )) {
  //           this.revealStack.push(neighborIndex)
  //         }
  //       }
  //     }

  //     if (this.tilesLeft === 0) {
  //       this.minesLeft = 0
  //       this.setGameState('WIN')
  //       this.requestViewportGrid()
  //       return
  //     }

  //     this.requestViewportGrid()
  //   }
  //   window.requestIdleCallback(() => this.revealingStack())
  // }

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
}
