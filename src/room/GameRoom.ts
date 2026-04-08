import type { AbstractScheduler } from '../core/AbstractScheduler'
import type { GameState } from '../engine/GameEngine'
import type { GameOperation, JoinGameOperation, LeftClickOperation, RightClickOperation } from './CrdtManager'
import type { SyncProvider, SyncProviderFactory } from './SyncProvider'
import { GameEngine } from '../engine/GameEngine'
import { generateRoomId } from '../utils/generateRandomId'
import { CrdtManager } from './CrdtManager'
import { GamePlayer } from './GamePlayer'

export interface GameRoomConfig {
  /** ID комнаты (опционально — генерируется автоматически при создании игры) */
  roomId?: string
  /** Имя игрока (опционально) */
  playerName?: string
  /** Начальные параметры игры (для создания новой игры) */
  gameParams?: {
    width: number
    height: number
    minesNum: number
  }
  /** Фабрика для создания провайдера синхронизации */
  syncProviderFactory?: SyncProviderFactory
  /** Scheduler для задач */
  scheduler: AbstractScheduler
}

export { GameState }

/**
 * GameRoom является центральной абстракцией для всех игровых операций.
 * UI работает только с GameRoom, не напрямую с GameEngine.
 */
export class GameRoom {
  private gameEngine: GameEngine
  private crdtManager: CrdtManager
  private currentPlayer: GamePlayer
  private syncProvider: SyncProvider | null = null
  private scheduler: AbstractScheduler
  private roomId: string | null = null
  private processedOps: Set<string> = new Set()
  private syncProviderFactory?: SyncProviderFactory

  constructor({
    roomId,
    playerName,
    syncProviderFactory,
    scheduler,
  }: GameRoomConfig) {
    this.scheduler = scheduler
    this.syncProviderFactory = syncProviderFactory
    this.currentPlayer = new GamePlayer({ name: playerName })

    // Создаём CrdtManager с подпиской на внешние операции
    this.crdtManager = new CrdtManager({
      onExternalOperations: (ops) => {
        // Применяем операции от других клиентов
        this.handleExternalOperations(ops)
      },
    })

    // Создаём GameEngine с дефолтными параметрами
    // GameRoom всегда использует mode: 'seeded' для детерминированной генерации
    // Параметры игры будут установлены при createGame/joinGame
    const engineRoomId = roomId ?? generateRoomId()
    this.gameEngine = new GameEngine({
      scheduler: this.scheduler,
      mode: 'seeded',
      roomId: engineRoomId,
    })

    // Сохраняем roomId если передан
    if (roomId) {
      this.roomId = roomId
    }

    // Подключаем синхронизацию если есть roomId и фабрика
    if (roomId && syncProviderFactory) {
      this.syncProvider = syncProviderFactory(
        roomId,
        this.crdtManager.getDoc(),
      )

      // Подписываемся на синхронизацию
      this.syncProvider.onSync = () => {
        // При получении обновления от других клиентов
        // Применяем новые операции
        this.applyPendingOperations()
      }
    }
  }

  /**
   * Создать новую игру
   */
  async createGame(params: { width: number, height: number, minesNum: number }): Promise<void> {
    // Генерируем roomId если не передан
    this.roomId = this.roomId ?? generateRoomId()

    // Seed генерируется на основе roomId
    // GameEngine использует roomId как seed для детерминированной генерации
    const seed = this.roomId

    // Добавляем операцию join в CRDT
    const joinOp: JoinGameOperation = {
      type: 'join',
      roomId: this.roomId,
      playerId: this.currentPlayer.id,
      width: params.width,
      height: params.height,
      minesNum: params.minesNum,
      seed,
      timestamp: Date.now(),
    }

    // Добавляем операцию с origin: 'local' (не вызовет callback внешних операций)
    this.crdtManager.addOperation(joinOp, 'local')

    // Перезапускаем GameEngine с новыми параметрами
    // GameEngine использует seed (roomId) для генерации поля
    this.gameEngine.restart({
      width: params.width,
      height: params.height,
      minesNum: params.minesNum,
    })

    // Подключаем синхронизацию если есть фабрика
    if (this.syncProviderFactory && !this.syncProvider) {
      this.syncProvider = this.syncProviderFactory(
        this.roomId,
        this.crdtManager.getDoc(),
      )

      this.syncProvider.onSync = () => {
        this.applyPendingOperations()
      }
    }
  }

  /**
   * Присоединиться к существующей игре
   */
  async joinGame(roomId: string): Promise<void> {
    this.roomId = roomId

    // Если есть старый провайдер - уничтожаем его
    if (this.syncProvider) {
      this.syncProvider.destroy()
      this.syncProvider = null
    }

    // Создаём нового провайдера если есть фабрика
    if (this.syncProviderFactory) {
      this.syncProvider = this.syncProviderFactory(
        roomId,
        this.crdtManager.getDoc(),
      )

      this.syncProvider.onSync = () => {
        this.applyPendingOperations()
      }
    }

    // Даём время на синхронизацию (для LocalSyncProvider это мгновенно)
    await new Promise(resolve => setTimeout(resolve, 0))

    // Получаем все операции
    const operations = this.crdtManager.getOperations()

    // Находим первую операцию join
    const firstJoinOp = operations.find(op => op.type === 'join') as JoinGameOperation | undefined

    if (!firstJoinOp) {
      throw new Error('Game not found: no join operation in document')
    }

    // Перезапускаем GameEngine с параметрами из первой join
    this.gameEngine.restart({
      width: firstJoinOp.width,
      height: firstJoinOp.height,
      minesNum: firstJoinOp.minesNum,
    })

    // Добавляем свою операцию join
    const myJoinOp: JoinGameOperation = {
      type: 'join',
      roomId: firstJoinOp.roomId,
      playerId: this.currentPlayer.id,
      width: firstJoinOp.width,
      height: firstJoinOp.height,
      minesNum: firstJoinOp.minesNum,
      seed: firstJoinOp.seed,
      timestamp: Date.now(),
    }

    this.crdtManager.addOperation(myJoinOp, 'local')

    // Применяем все предыдущие операции (кроме join)
    for (const op of operations) {
      if (op.type === 'leftClick' || op.type === 'rightClick') {
        this.applyOperation(op)
      }
    }
  }

  /**
   * Левый клик по ячейке (вызывается из UI)
   */
  handleLeftClick(x: number, y: number): void {
    // Создаём операцию
    const op: LeftClickOperation = {
      type: 'leftClick',
      x,
      y,
      playerId: this.currentPlayer.id,
      timestamp: Date.now(),
    }

    // Добавляем в CRDT с origin: 'local'
    // Синхронизация происходит автоматически через SyncProvider
    this.crdtManager.addOperation(op, 'local')

    // Применяем к GameEngine локально
    this.applyOperation(op)
  }

  /**
   * Правый клик по ячейке (вызывается из UI)
   */
  handleRightClick(x: number, y: number): void {
    // Создаём операцию
    const op: RightClickOperation = {
      type: 'rightClick',
      x,
      y,
      playerId: this.currentPlayer.id,
      timestamp: Date.now(),
    }

    // Добавляем в CRDT с origin: 'local'
    this.crdtManager.addOperation(op, 'local')

    // Применяем к GameEngine локально
    this.applyOperation(op)
  }

  /**
   * Применить операцию к GameEngine с дедупликацией
   */
  private applyOperation(op: GameOperation): void {
    // Дедупликация: проверяем, была ли операция уже применена
    const key = this.getOpKey(op)
    if (this.processedOps.has(key)) {
      return // Пропускаем дубликат
    }

    // Правила разрешения конфликтов
    if (op.type === 'leftClick' || op.type === 'rightClick') {
      const index = op.y * this.gameEngine.getGameState().width + op.x
      const tile = this.gameEngine._uInt8Array[index]

      // Если клетка уже открыта — игнорируем любую операцию
      if (!this.isHiddenTile(tile)) {
        return
      }

      // LeftClick имеет приоритет над RightClick
      if (op.type === 'rightClick') {
        // Проверяем, не стоит ли уже флаг (для определения - переключение или игнорирование)
        // Если мы дошли сюда, значит клетка скрыта
        // Применяем флаг через gameEngine
      }
    }

    // Применяем операцию через движок
    if (op.type === 'leftClick' || op.type === 'rightClick') {
      this.applyOperationToEngine(op)
    }

    // Помечаем операцию как обработанную
    this.processedOps.add(key)
  }

  /**
   * Проверить, является ли плитка скрытой
   */
  private isHiddenTile(tile: number): boolean {
    // HIDDEN_ENUMS содержит коды скрытых плиток
    // Импортируем из consts
    return tile >= 9 && tile <= 11
  }

  /**
   * Применить операцию к GameEngine
   * GameRoom вызывает этот метод для всех операций.
   *
   * @param op - Операция для применения
   */
  private applyOperationToEngine(op: LeftClickOperation | RightClickOperation): void {
    const state = this.gameEngine.getGameState()
    const index = op.y * state.width + op.x

    if (op.type === 'leftClick') {
      this.gameEngine.reveal(index)
    }
    else if (op.type === 'rightClick') {
      this.gameEngine.flag(index)
    }
  }

  /**
   * Обработать внешние операции (от других клиентов)
   * Вызывается из CrdtManager.onExternalOperations
   */
  private handleExternalOperations(ops: GameOperation[]): void {
    ops.forEach(op => this.applyOperation(op))
  }

  /**
   * Применить ожидающие операции (вызывается при получении sync)
   */
  private applyPendingOperations(): void {
    const operations = this.crdtManager.getOperations()
    for (const op of operations) {
      if (op.type === 'leftClick' || op.type === 'rightClick') {
        this.applyOperation(op)
      }
    }
  }

  /**
   * Генерация ключа для дедупликации
   * Две операции считаются дубликатами если: тип и координаты совпадают
   */
  private getOpKey(op: GameOperation): string {
    if (op.type === 'join') {
      return `join-${op.playerId}-${op.timestamp}`
    }
    return `${op.type}-${op.x}-${op.y}`
  }

  /**
   * Получить текущее состояние игры
   */
  getGameState(): GameState {
    return this.gameEngine.getGameState()
  }

  /**
   * Подписаться на изменения состояния игры
   */
  subscribe(callback: (state: GameState) => void): () => void {
    // Обертка для преобразования callback
    const wrappedCallback = () => {
      callback(this.getGameState())
    }
    return this.gameEngine.subscribe(wrappedCallback)
  }

  /**
   * Получить ID текущего игрока
   */
  getCurrentPlayerId(): string {
    return this.currentPlayer.id
  }

  /**
   * Получить ID комнаты
   */
  getRoomId(): string | null {
    return this.roomId
  }

  /**
   * Перезапустить игру (только для single-player)
   */
  restart(): void {
    this.processedOps.clear()
    this.crdtManager.clear()
    // Перезапуск с текущими параметрами
    this.gameEngine.restart()
  }
}
