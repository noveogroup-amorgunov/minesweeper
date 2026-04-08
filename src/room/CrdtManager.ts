import * as Y from 'yjs'

/**
 * Базовый интерфейс для всех операций
 */
export interface BaseOperation {
  /** Timestamp операции (Date.now()) */
  timestamp: number
  /** ID игрока, выполнившего операцию */
  playerId: string
}

/**
 * Операция присоединения к игре / создания игры
 */
export interface JoinGameOperation extends BaseOperation {
  type: 'join'
  roomId: string
  width: number
  height: number
  minesNum: number
  seed: string
}

/**
 * Операция левого клика (открытие ячейки)
 */
export interface LeftClickOperation extends BaseOperation {
  type: 'leftClick'
  x: number
  y: number
}

/**
 * Операция правого клика (флаг)
 */
export interface RightClickOperation extends BaseOperation {
  type: 'rightClick'
  x: number
  y: number
}

/**
 * Объединённый тип всех операций
 */
export type GameOperation
  = | JoinGameOperation
    | LeftClickOperation
    | RightClickOperation

/**
 * Тип операции для type guard
 */
export type OperationType = GameOperation['type']

/**
 * Конвертирует Y.Map в GameOperation
 */
function yMapToOperation(yMap: Y.Map<unknown>): GameOperation {
  const type = yMap.get('type') as string
  const playerId = yMap.get('playerId') as string
  const timestamp = yMap.get('timestamp') as number

  switch (type) {
    case 'join': {
      return {
        type: 'join',
        roomId: yMap.get('roomId') as string,
        width: yMap.get('width') as number,
        height: yMap.get('height') as number,
        minesNum: yMap.get('minesNum') as number,
        seed: yMap.get('seed') as string,
        playerId,
        timestamp,
      }
    }
    case 'leftClick': {
      return {
        type: 'leftClick',
        x: yMap.get('x') as number,
        y: yMap.get('y') as number,
        playerId,
        timestamp,
      }
    }
    case 'rightClick': {
      return {
        type: 'rightClick',
        x: yMap.get('x') as number,
        y: yMap.get('y') as number,
        playerId,
        timestamp,
      }
    }
    default:
      throw new Error(`Unknown operation type: ${type}`)
  }
}

export interface CrdtManagerConfig {
  /** Callback при получении внешних операций (от других клиентов) */
  onExternalOperations?: (ops: GameOperation[]) => void
}

/**
 * Обёртка над Yjs документом для работы с игровыми операциями
 *
 * Структура документа:
 * Y.Doc
 * └── root: Y.Map {
 *       operations: Y.Array<Y.Map>  // Массив операций
 *       meta: Y.Map {               // Метаданные игры
 *         createdAt: number
 *         roomId: string
 *         seed: string
 *       }
 *     }
 */
export class CrdtManager {
  private doc: Y.Doc
  private operations: Y.Array<Y.Map<unknown>>
  private meta: Y.Map<unknown>
  private onExternalOperations?: (ops: GameOperation[]) => void

  constructor(config?: CrdtManagerConfig) {
    this.doc = new Y.Doc()
    this.onExternalOperations = config?.onExternalOperations

    // Создаём корневую структуру документа
    const root = this.doc.getMap<unknown>()
    this.operations = new Y.Array<Y.Map<unknown>>()
    this.meta = new Y.Map<unknown>()
    root.set('operations', this.operations)
    root.set('meta', this.meta)

    // Подписываемся на изменения массива операций
    this.operations.observe((event, transaction) => {
      // Фильтруем только внешние изменения (origin !== 'local')
      if (transaction.origin !== 'local' && this.onExternalOperations) {
        const newOps: GameOperation[] = []
        event.changes.added.forEach((item) => {
          const content = item.content.getContent()
          content.forEach((yMap) => {
            if (yMap instanceof Y.Map) {
              newOps.push(yMapToOperation(yMap))
            }
          })
        })
        if (newOps.length > 0) {
          this.onExternalOperations(newOps)
        }
      }
    })
  }

  /**
   * Добавить операцию в документ
   * @param op - операция для добавления
   * @param origin - 'local' для локальных операций, undefined для внешних
   */
  addOperation(op: GameOperation, origin?: 'local'): void {
    this.doc.transact(() => {
      const yMap = new Y.Map<unknown>()
      Object.entries(op).forEach(([key, value]) => {
        yMap.set(key, value)
      })
      this.operations.push([yMap])
    }, origin)
  }

  /**
   * Получить все операции
   */
  getOperations(): GameOperation[] {
    const ops: GameOperation[] = []
    this.operations.forEach((yMap) => {
      ops.push(yMapToOperation(yMap))
    })
    return ops
  }

  /**
   * Получить Yjs документ для синхронизации
   */
  getDoc(): Y.Doc {
    return this.doc
  }

  /**
   * Получить state update для сохранения
   */
  getStateUpdate(): Uint8Array {
    return Y.encodeStateAsUpdate(this.doc)
  }

  /**
   * Загрузить состояние из state update
   */
  applyStateUpdate(update: Uint8Array): void {
    Y.applyUpdate(this.doc, update)
  }

  /**
   * Очистить все операции
   */
  clear(): void {
    this.doc.transact(() => {
      // Удаляем все элементы из массива
      while (this.operations.length > 0) {
        this.operations.delete(0, 1)
      }
      // Очищаем метаданные
      this.meta.clear()
    })
  }

  /**
   * Уничтожить документ
   */
  destroy(): void {
    this.doc.destroy()
  }
}
