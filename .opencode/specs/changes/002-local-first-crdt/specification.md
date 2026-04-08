# Техническая спецификация: Local-first CRDT для Minesweeper

## 1. Архитектура модулей

### 1.1 Схема изменений

```
src/
├── core/
│   ├── eventBus.ts                    # NEW: Простой EventBus для тестов
│   ├── PubSub.ts                      # EXISTING
│   └── Scheduler.ts                   # EXISTING
│
├── engine/
│   ├── GameEngine.ts                  # MODIFIED: Добавить applyOperation()
│   ├── GameEngine.spec.ts             # EXISTING
│   ├── GameWebWorker.ts               # EXISTING
│   ├── generateMines.ts               # EXISTING
│   └── SaveManager.ts                 # MODIFIED: Новый формат сохранения
│
├── room/                              # NEW FOLDER
│   ├── GameRoom.ts                    # NEW: Центральная абстракция
│   ├── GameRoom.spec.ts               # NEW: Тесты GameRoom
│   ├── GamePlayer.ts                  # NEW: Класс игрока
│   ├── CrdtManager.ts                 # NEW: Обёртка над Yjs документом
│   ├── CrdtManager.spec.ts            # NEW: Тесты CrdtManager
│   ├── SyncProvider.ts                # NEW: Интерфейс провайдера
│   └── LocalSyncProvider.ts           # NEW: Локальный провайдер для тестов
│
├── types/
│   └── operations.ts                  # NEW: TypeScript интерфейсы операций
│
├── utils/
│   └── generateRandomId.ts            # EXISTING
│
└── view/                              # EXISTING (UI адаптируется под GameRoom)
```

### 1.2 Диаграмма взаимодействия компонентов

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GameRoom (Единая точка входа)                   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  GamePlayer  │  │ CrdtManager  │  │   GameEngine │  │SyncProvider  │     │
│  │ (current     │  │   (Y.Doc)    │  │  (логика игры)│  │(WebRTC/local)│    │
│  │  player)     │  │              │  │              │  │              │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │                 │              │
│         │ get playerId    │ addOperation()  │ applyOperation()│ sync         │
│         │                 │ getOperations() │ getGameState()  │              │
│         │                 │                 │ restart()       │              │
│         ▼                 ▼                 ▼                 ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Yjs Document                                  │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │  Y.Array<Operation> operations                               │  │    │
│  │  │  └── [{type: 'join', roomId, width, height, ...},           │  │    │
│  │  │      {type: 'leftClick', x: 5, y: 10, playerId, timestamp}, │  │    │
│  │  │      {type: 'rightClick', x: 3, y: 7, playerId, timestamp}, │  │    │
│  │  │      ...]                                                    │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                     ┌──────────────────┴──────────────────┐
                     │                                     │
                     ▼                                     ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│      GameRoom (Client 1)     │          │      GameRoom (Client 2)     │
│  ┌────────────────────────┐  │          │  ┌────────────────────────┐  │
│  │  Y.Doc (operations)    │  │◄────────►│  │  Y.Doc (operations)    │  │
│  │  - join(roomId, seed)  │  │  merge   │  │  - join(roomId, seed)  │  │
│  │  - leftClick(x,y)      │  │          │  │  - leftClick(x,y)      │  │
│  │  - rightClick(x,y)     │  │          │  │  - rightClick(x,y)     │  │
│  └────────────────────────┘  │          │  └────────────────────────┘  │
└──────────────────────────────┘          └──────────────────────────────┘

FUTURE (y-webrtc):
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WebrtcProvider (y-webrtc)                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  WebRTC Signaling + Yjs awareness                                   │   │
│  │  └── roomId используется как signaling room                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. TypeScript интерфейсы

### 2.1 Игровые операции

```typescript
// src/types/operations.ts

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
 * Первая операция в последовательности создаёт игру
 * Последующие операции присоединяют новых игроков
 */
export interface JoinGameOperation extends BaseOperation {
  type: 'join'
  /** ID комнаты/игры */
  roomId: string
  /** Ширина поля */
  width: number
  /** Высота поля */
  height: number
  /** Количество мин */
  minesNum: number
  /** Seed для генерации поля */
  seed: string
}

/**
 * Операция левого клика (открытие ячейки)
 */
export interface LeftClickOperation extends BaseOperation {
  type: 'leftClick'
  /** Координата X */
  x: number
  /** Координата Y */
  y: number
}

/**
 * Операция правого клика (флаг)
 */
export interface RightClickOperation extends BaseOperation {
  type: 'rightClick'
  /** Координата X */
  x: number
  /** Координата Y */
  y: number
}

/**
 * Объединённый тип всех операций
 */
export type GameOperation =
  | JoinGameOperation
  | LeftClickOperation
  | RightClickOperation

/**
 * Тип операции для type guard
 */
export type OperationType = GameOperation['type']
```

### 2.2 Класс GameRoom

```typescript
// src/room/GameRoom.ts

import type { AbstractScheduler } from '../core/AbstractScheduler'
import type { GameEngine } from '../engine/GameEngine'
import type { CrdtManager } from './CrdtManager'
import type { GamePlayer } from './GamePlayer'
import type { SyncProvider, SyncProviderFactory } from './SyncProvider'
import type { GameOperation, LeftClickOperation, RightClickOperation } from '../types/operations'

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

/**
 * GameState использует существующий интерфейс из GameEngine
 * Без изменений для совместимости с существующим UI
 */
export interface GameState {
  visibleBoard: Array<{ value: number; index: number }>
  offsetX: number
  offsetY: number
  gameStatus: 'READY' | 'PENDING' | 'PLAYING' | 'DEAD' | 'WIN'
  minesLeft: number
  minesNum: number
  tilesLeft: number
  boardByteLength: number
  height: number
  width: number
  gameTimeSeconds: number
}

/**
 * Примечание: GameRoom.getGameState() проксирует вызов к GameEngine.getGameState()
 * Интерфейс полностью совместим с существующей реализацией
 */

export class GameRoom {
  private gameEngine: GameEngine
  private crdtManager: CrdtManager
  private currentPlayer: GamePlayer
  private syncProvider: SyncProvider | null = null
  private scheduler: AbstractScheduler
  private roomId: string | null = null
  private processedOps: Set<string> = new Set()

  constructor(config: GameRoomConfig)

  /**
   * Создать новую игру
   * Генерирует roomId, добавляет операцию join, инициализирует GameEngine
   */
  async createGame(params: { width: number; height: number; minesNum: number }): Promise<void>

  /**
   * Присоединиться к существующей игре
   * Получает параметры из первой join операции, перезапускает GameEngine,
   * применяет все предыдущие операции
   */
  async joinGame(roomId: string): Promise<void>

  /**
   * Левый клик по ячейке (вызывается из UI)
   * Добавляет операцию в CRDT и применяет к GameEngine
   */
  handleLeftClick(x: number, y: number): void

  /**
   * Правый клик по ячейке (вызывается из UI)
   * Добавляет операцию в CRDT и применяет к GameEngine
   */
  handleRightClick(x: number, y: number): void

  /**
   * Получить текущее состояние игры из GameEngine
   */
  getGameState(): GameState

  /**
   * Подписаться на изменения состояния игры
   */
  subscribe(callback: (state: GameState) => void): () => void

  /**
   * Получить ID текущего игрока
   */
  getCurrentPlayerId(): string

  /**
   * Получить ID комнаты
   */
  getRoomId(): string | null

  /**
   * Перезапустить игру (только для single-player)
   */
  restart(): void

  /**
   * Обработать операцию извне (от других клиентов)
   * Вызывается при получении операции через SyncProvider
   */
  private handleExternalOperation(op: GameOperation): void

  /**
   * Применить операцию к GameEngine с дедупликацией
   */
  private applyOperation(op: GameOperation): void

  /**
   * Генерация ключа для дедупликации
   */
  private getOpKey(op: GameOperation): string
}
```

### 2.3 Класс GamePlayer

```typescript
// src/room/GamePlayer.ts

import { generateRandomId } from '../utils/generateRandomId'

export interface GamePlayerConfig {
  name?: string
}

export class GamePlayer {
  /** Уникальный ID игрока (8 символов, base62) */
  readonly id: string
  
  /** Отображаемое имя игрока */
  readonly name: string

  constructor(config?: GamePlayerConfig) {
    this.id = generateRandomId(8)
    this.name = config?.name ?? `Player ${this.id.slice(0, 4)}`
  }
}
```

### 2.4 CrdtManager

**Выбранное решение:** Observer на Y.Array с фильтрацией по origin (см. requirements.md раздел 13.2)

```typescript
// src/room/CrdtManager.ts

import * as Y from 'yjs'
import type { GameOperation } from '../types/operations'

/**
 * Структура Yjs документа:
 *
 * Y.Doc
 * └── root: Y.Map {
 *       operations: Y.Array<Y.Map>  // Массив операций
 *       meta: Y.Map {               // Метаданные игры
 *         createdAt: number
 *         roomId: string
 *         seed: string
 *       }
 *     }
 *
 * Каждая операция хранится как Y.Map с полями:
 * {
 *   type: string      // 'join' | 'leftClick' | 'rightClick'
 *   x: number?        // только для click операций
 *   y: number?        // только для click операций
 *   playerId: string
 *   timestamp: number
 *   ...другие поля в зависимости от типа
 * }
 */

export interface CrdtManagerConfig {
  /** Callback при получении внешних операций (от других клиентов) */
  onExternalOperations?: (ops: GameOperation[]) => void
}

export class CrdtManager {
  private doc: Y.Doc
  private operations: Y.Array<Y.Map>
  private meta: Y.Map
  
  constructor(config?: CrdtManagerConfig) {
    this.doc = new Y.Doc()
    const root = this.doc.getMap()
    this.operations = root.set('operations', new Y.Array())
    this.meta = root.set('meta', new Y.Map())
    
    // Подписываемся на изменения массива операций
    this.operations.observe((event, transaction) => {
      // Фильтруем только внешние изменения (origin !== 'local')
      if (transaction.origin !== 'local' && config?.onExternalOperations) {
        const newOps: GameOperation[] = []
        event.changes.added.forEach((item) => {
          const content = item.content.getContent()
          content.forEach((yMap: Y.Map) => {
            newOps.push(yMapToOperation(yMap))
          })
        })
        if (newOps.length > 0) {
          config.onExternalOperations(newOps)
        }
      }
    })
  }
  
  /** 
   * Добавить операцию в документ 
   * @param op - операция для добавления
   * @param origin - 'local' для локальных операций, undefined для внешних
   */
  addOperation(op: GameOperation, origin?: 'local'): void
  
  /** Получить все операции */
  getOperations(): GameOperation[]
  
  /** Получить Yjs документ для синхронизации */
  getDoc(): Y.Doc
  
  /** Получить state update для сохранения */
  getStateUpdate(): Uint8Array
  
  /** Загрузить состояние из state update */
  applyStateUpdate(update: Uint8Array): void
  
  /** Очистить все операции */
  clear(): void
  
  /** Уничтожить документ */
  destroy(): void
}
```

### 2.5 EventBus

```typescript
// src/core/eventBus.ts

export type EventCallback<T = unknown> = (data: T) => void

export class EventBus {
  private listeners: Map<string, Set<EventCallback>>
  private paused: boolean
  private queue: Array<{ event: string, data: unknown }>

  constructor()

  /** Подписаться на событие */
  on<T>(event: string, callback: EventCallback<T>): () => void

  /** Отписаться от события */
  off<T>(event: string, callback: EventCallback<T>): void

  /** Отправить событие всем подписчикам */
  emit<T>(event: string, data: T): void

  /** Приостановить обработку событий (накопление в очередь) */
  pause(): void

  /** Возобновить обработку событий */
  resume(): void

  /** Очистить очередь накопленных событий */
  clearQueue(): void
}
```

---

## 3. Формат сохранения игры

### 3.1 Текущий формат (Версия 1)

Текущий формат реализован в `GameSaveManager.ts`:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Файл сохранения (Версия 1)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐                                                    │
│  │   MAGIC HEADER      │  8 bytes - "MINESWP\0"                             │
│  └─────────────────────┘                                                    │
│  ┌─────────────────────┐                                                    │
│  │   VERSION           │  1 byte - 0x01                                     │
│  └─────────────────────┘                                                    │
│  ┌─────────────────────┐                                                    │
│  │   HEADER_LEN        │  4 bytes (uint32le)                                │
│  └─────────────────────┘                                                    │
│  ┌─────────────────────┐                                                    │
│  │   JSON_HEADER       │  N bytes - GameStateSnapshot.header               │
│  └─────────────────────┘                                                    │
│  ┌─────────────────────┐                                                    │
│  │   BOARD_DATA        │  M bytes - Uint8Array поля                        │
│  └─────────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Версия 1 сохраняет полное состояние поля (boardData)** — не совместимо с CRDT подходом.

---

### 3.2 Новый формат (Версия 2)

Новый формат для CRDT поддержки:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Файл сохранения (.mine)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │   MAGIC HEADER      │  8 bytes                                           │
│  │   "MINESCRD"        │  Фиксированная сигнатура                           │
│  └─────────────────────┘                                                    │
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │   VERSION           │  2 bytes (uint16le)                                │
│  │   0x0002            │  Версия формата = 2                                │
│  └─────────────────────┘                                                    │
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │   JSON_LEN          │  4 bytes (uint32le)                                │
│  │                     │  Размер JSON метаданных в байтах                   │
│  └─────────────────────┘                                                    │
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │   JSON_METADATA     │  N bytes (UTF-8 JSON)                              │
│  │                     │  {                                                 │
│  │                     │    width, height, minesNum,                        │
│  │                     │    seed, roomId, createdAt,                        │
│  │                     │    playerId, playerName                           │
│  │                     │  }                                                 │
│  └─────────────────────┘                                                    │
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │   YJS_UPDATE_LEN    │  4 bytes (uint32le)                                │
│  │                     │  Размер Yjs state update в байтах                  │
│  └─────────────────────┘                                                    │
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │   YJS_STATE_UPDATE  │  M bytes (binary)                                  │
│  │                     │  Y.encodeStateAsUpdate(doc)                        │
│  │                     │  Содержит все операции из Y.Doc                    │
│  └─────────────────────┘                                                    │
│                                                                             │
│  ┌─────────────────────┐                                                    │
│  │   CHECKSUM          │  4 bytes (uint32le)                                │
│  │                     │  CRC32 всего файла (опционально)                   │
│  └─────────────────────┘                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 TypeScript интерфейс сохранения

```typescript
// src/engine/GameSaveManager.ts

/**
 * Magic header для файлов сохранения версии 2
 * "MINESCRD" в ASCII = 0x4D494E4553435244
 */
export const SAVE_MAGIC_HEADER_V2 = new Uint8Array([
  0x4D, 0x49, 0x4E, 0x45, 0x53, 0x43, 0x52, 0x44
]) // "MINESCRD"

/**
 * Magic header для файлов сохранения версии 1 (устаревший)
 * "MINESWP\0" в ASCII
 */
export const SAVE_MAGIC_HEADER_V1 = new Uint8Array([
  0x4D, 0x49, 0x4E, 0x45, 0x53, 0x57, 0x50, 0x00
]) // "MINESWP\0"

/**
 * Текущая версия формата сохранения
 */
export const SAVE_VERSION_V2 = 2

/**
 * Метаданные сохранения версии 2 (JSON)
 */
export interface SaveMetadataV2 {
  /** Версия формата */
  version: number
  /** Ширина поля */
  width: number
  /** Высота поля */
  height: number
  /** Количество мин */
  minesNum: number
  /** Seed для генерации (детерминированная генерация) */
  seed: string
  /** ID комнаты (используется как seed) */
  roomId: string
  /** Время создания */
  createdAt: number
  /** ID игрока, создавшего сохранение */
  playerId: string
  /** Имя игрока */
  playerName: string
}

/**
 * Полная структура сохранения версии 2
 */
export interface SaveDataV2 {
  metadata: SaveMetadataV2
  /** Yjs state update (бинарные данные) - содержит все операции */
  yjsStateUpdate: Uint8Array
}

/**
 * Расширение существующего GameSaveManager для поддержки версии 2
 */
export class GameSaveManager {
  // ... существующие методы для версии 1 ...
  
  /**
   * Сериализовать данные версии 2 в бинарный формат
   */
  static serializeV2(data: SaveDataV2): Uint8Array

  /**
   * Десериализовать бинарные данные версии 2
   * @throws SaveVersionError если версия не 2
   */
  static deserializeV2(buffer: Uint8Array): SaveDataV2

  /**
   * Проверить версию сохранения
   */
  static detectVersion(buffer: Uint8Array): 1 | 2 | 'unknown'
}
```

### 3.3 Процесс загрузки игры

При загрузке сохраненной игры GameRoom выполняет тот же алгоритм, что и при присоединении к существующей игре:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Процесс загрузки игры (GameRoom.load)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Чтение файла .mine                                                      │
│     └── Десериализация: JSON metadata + Yjs state update                    │
│                                                                             │
│  2. Применение Yjs state update                                             │
│     └── CrdtManager.applyStateUpdate(yjsStateUpdate)                        │
│     └── Восстанавливаем все операции в Y.Doc                                │
│                                                                             │
│  3. Поиск операции join                                                     │
│     └── Находим первую операцию type: 'join' в массиве                      │
│     └── Извлекаем: width, height, minesNum, seed, roomId                    │
│                                                                             │
│  4. Перезапуск игры (GameEngine.restart)                                    │
│     └── Устанавливаем параметры из join операции                            │
│     └── Генерируем поле с тем же seed (детерминированно)                    │
│                                                                             │
│  5. Применение игровых операций                                             │
│     └── Проходим по всем операциям (кроме join)                             │
│     └── Применяем leftClick/rightClick через GameEngine.applyOperation()    │
│     └── Восстанавливаем состояние игры                                      │
│                                                                             │
│  6. Игра загружена и готова к продолжению                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Ключевые моменты:**

1. **Параметры из первой `join` операции:** Как и при `joinGame`, все параметры игры (width, height, minesNum, seed) берутся из первой операции `join`, а не из JSON metadata. JSON metadata используется только для быстрой проверки и совместимости.

2. **Детерминированное восстановление:** Тот же `seed` гарантирует идентичное поле на всех клиентах.

3. **Последовательность операций:** Важно сначала сделать `restart`, затем применять операции в порядке их следования в Yjs массиве.

---

## 4. Архитектура синхронизации

### 4.1 Абстрактный провайдер синхронизации

```typescript
// src/room/SyncProvider.ts

import type * as Y from 'yjs'

/**
 * Базовый интерфейс для всех провайдеров синхронизации.
 * 
 * Совместим с API y-webrtc:
 * @see https://github.com/yjs/y-webrtc
 * 
 * В будущем можно заменить LocalSyncProvider на WebrtcProvider
 * без изменений в GameRoom.
 */
export interface SyncProvider {
  /** Уникальный ID комнаты/документа */
  readonly roomId: string
  
  /** Yjs документ для синхронизации */
  readonly doc: Y.Doc
  
  /** Флаг подключения */
  readonly connected: boolean
  
  /** Callback при получении обновления */
  onSync?: (update: Uint8Array, origin: unknown) => void
  
  /** Callback при подключении */
  onConnect?: () => void
  
  /** Callback при отключении */
  onDisconnect?: () => void
  
  /** Разорвать соединение */
  destroy(): void
}

/**
 * Фабрика для создания провайдеров.
 * Позволяет инжектировать разные реализации (тестовую, webrtc и т.д.)
 */
export type SyncProviderFactory = (
  roomId: string,
  doc: Y.Doc
) => SyncProvider
```

### 4.2 Локальный провайдер (для тестирования)

```typescript
// src/room/LocalSyncProvider.ts

import * as Y from 'yjs'
import { EventBus } from '../core/eventBus'
import type { SyncProvider } from './SyncProvider'

/**
 * Локальный провайдер синхронизации через EventBus.
 * 
 * Используется для тестирования CRDT синхронизации в рамках
 * одного приложения без сетевого взаимодействия.
 * 
 * В будущем заменяется на WebrtcProvider из y-webrtc:
 * import { WebrtcProvider } from 'y-webrtc'
 * const provider = new WebrtcProvider(roomId, ydoc)
 */
export class LocalSyncProvider implements SyncProvider {
  readonly roomId: string
  readonly doc: Y.Doc
  readonly eventBus: EventBus
  
  private unsubscribe: (() => void) | null = null
  private _connected = false
  
  onSync?: (update: Uint8Array, origin: unknown) => void
  onConnect?: () => void
  onDisconnect?: () => void

  constructor(
    roomId: string,
    doc: Y.Doc,
    eventBus?: EventBus
  ) {
    this.roomId = roomId
    this.doc = doc
    this.eventBus = eventBus ?? new EventBus()
    
    // Подписываемся на изменения документа
    this.doc.on('update', (update: Uint8Array, origin: unknown) => {
      // Не отправляем свои собственные обновления
      if (origin !== this) {
        this.broadcast(update)
      }
    })
    
    // Подписываемся на внешние события
    this.unsubscribe = this.eventBus.on(
      `sync:${roomId}`,
      (data: { update: Uint8Array, origin: string }) => {
        // Применяем внешнее обновление
        Y.applyUpdate(this.doc, data.update, this)
        this.onSync?.(data.update, data.origin)
      }
    )
    
    this._connected = true
    this.onConnect?.()
  }

  get connected(): boolean {
    return this._connected
  }

  /**
   * Отправить update всем подписчикам
   */
  private broadcast(update: Uint8Array): void {
    this.eventBus.emit(`sync:${this.roomId}`, {
      update,
      origin: 'local'
    })
  }

  /**
   * Приостановить синхронизацию (для тестов offline режима)
   */
  pause(): void {
    this.eventBus.pause()
  }

  /**
   * Возобновить синхронизацию
   */
  resume(): void {
    this.eventBus.resume()
  }

  /**
   * Получить доступ к EventBus для тестов
   */
  getEventBus(): EventBus {
    return this.eventBus
  }

  destroy(): void {
    this._connected = false
    this.unsubscribe?.()
    this.onDisconnect?.()
  }
}
```

### 4.3 Интеграция в GameRoom

```typescript
// src/room/GameRoom.ts (фрагмент реализации)

export class GameRoom {
  private gameEngine: GameEngine
  private crdtManager: CrdtManager
  private currentPlayer: GamePlayer
  private syncProvider: SyncProvider | null = null
  private scheduler: AbstractScheduler
  private roomId: string | null = null
  private processedOps: Set<string> = new Set()

  constructor({
    roomId,
    playerName,
    gameParams,
    syncProviderFactory,
    scheduler,
  }: GameRoomConfig) {
    this.scheduler = scheduler
    this.currentPlayer = new GamePlayer({ name: playerName })
    
    // Создаём CrdtManager с подпиской на внешние операции
    this.crdtManager = new CrdtManager({
      onExternalOperations: (ops) => {
        // Применяем операции от других клиентов
        this.handleExternalOperations(ops)
      }
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
    
    // Подключаем синхронизацию если есть roomId
    if (roomId && syncProviderFactory) {
      this.syncProvider = syncProviderFactory(
        roomId,
        this.crdtManager.getDoc()
      )
      
      // Подписываемся на синхронизацию
      this.syncProvider.onSync = (update, origin) => {
        // При получении обновления от других клиентов
        // Применяем новые операции
        this.applyPendingOperations()
      }
    }
  }

  /**
   * Создать новую игру
   */
  async createGame(params: { width: number; height: number; minesNum: number }): Promise<void> {
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
  }

  /**
   * Присоединиться к существующей игре
   */
  async joinGame(roomId: string): Promise<void> {
    this.roomId = roomId
    
    // Устанавливаем статус ожидания
    // this.gameEngine.setGameStatus('PENDING') // Если нужен такой метод
    
    // Подключаемся к существующему Yjs документу через SyncProvider
    if (this.syncProvider) {
      this.syncProvider.destroy()
    }
    
    // В реальном сценарии здесь был бы async код подключения
    // Для LocalSyncProvider подключение мгновенное
    
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
    
    this.crdtManager.addOperation(myJoinOp)
    
    // Применяем все предыдущие операции (кроме join)
    for (const op of operations) {
      if (op.type === 'leftClick' || op.type === 'rightClick') {
        this.applyOperation(op)
      }
    }
    
    // Игра готова
    // this.gameEngine.setGameStatus('PLAYING')
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
      
      // Если клетка уже открыта — игнорируем любую операцию
      // Детали реализации: проверка через GameEngine._uInt8Array
      
      // LeftClick имеет приоритет над RightClick
      if (op.type === 'rightClick') {
        // Если ячейка уже открыта — нельзя поставить флаг
        // Реализация зависит от внутренней структуры GameEngine
      }
    }
    
    // Применяем операцию через GameEngine
    if (op.type === 'leftClick' || op.type === 'rightClick') {
      this.gameEngine.applyOperation(op)
    }
    
    // Помечаем операцию как обработанную
    this.processedOps.add(key)
  }

  /**
   * Обработать внешние операции (от других клиентов)
   * Вызывается из CrdtManager.onExternalOperations
   */
  private handleExternalOperations(ops: GameOperation[]): void {
    ops.forEach(op => this.applyOperation(op))
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
    return this.gameEngine.subscribe(callback)
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
}
```

### 4.4 Совместимость с y-webrtc

В будущем переход на реальную сетевую синхронизация выполняется заменой фабрики:

```typescript
// BEFORE (локальное тестирование)
const room = new GameRoom({
  scheduler: new Scheduler(),
  // Используется LocalSyncProvider по умолчанию
})

// AFTER (WebRTC синхронизация)
import { WebrtcProvider } from 'y-webrtc'

const room = new GameRoom({
  scheduler: new Scheduler(),
  syncProviderFactory: (roomId, doc) => {
    return new WebrtcProvider(roomId, doc, {
      signaling: ['wss://signaling-server.example.com']
    })
  }
})
```

**Требования к API провайдера (совместимость с y-webrtc):**
- Должен принимать `roomId` (string) и `doc` (Y.Doc) в конструкторе
- Должен иметь свойство `doc` для доступа к Yjs документу
- Должен иметь метод `destroy()` для очистки ресурсов
- Опционально: события `onConnect`, `onDisconnect` для мониторинга состояния

---

## 5. Изменения в GameEngine

### 5.1 Новый метод applyOperation()

```typescript
// src/engine/GameEngine.ts

export class GameEngine {
  // ... существующий код ...

  /**
   * Применить операцию от другого игрока (или себя при replay).
   * GameRoom вызывает этот метод для всех операций.
   * 
   * GameEngine не знает об источнике операции (локальная или удалённая).
   * Дедупликация и проверки выполняются в GameRoom.
   * 
   * @param op - Операция для применения
   */
  applyOperation(op: LeftClickOperation | RightClickOperation): void {
    const index = op.y * this._width + op.x
    
    if (op.type === 'leftClick') {
      this.reveal(index)
    } else if (op.type === 'rightClick') {
      this.flag(index)
    }
  }

  /**
   * Перезапустить игру с новыми параметрами.
   * Вызывается GameRoom при createGame/joinGame.
   */
  restart({ width, height, minesNum }: { 
    width?: number
    height?: number
    minesNum?: number
  } = {}): void {
    // Существующая реализация restart
    // Обновляет this._width, this._height, this._minesNum
    // Генерирует новое поле через Web Worker
  }
}
```

### 5.2 Примечания по реализации

**GameEngine.applyOperation():**
- Не сохраняет операцию в CRDT (это делает GameRoom)
- Не проверяет дубликаты (это делает GameRoom)
- Просто применяет операцию к текущему состоянию поля
- Использует существующие методы `reveal()` и `flag()`

**GameEngine.restart():**
- Уже существует в текущей реализации
- GameRoom использует его для перезапуска с параметрами из join операции
- Сохраняет roomId/seed для детерминированной генерации

---

## 6. Рекурсивное открытие ячеек (Flood Fill)

### 6.1 Использование существующего метода reveal

При клике на пустую ячейку (без соседних мин) в классическом сапёре автоматически открываются соседние ячейки. **Важно:**

1. **Существующий метод `reveal`** уже содержит логику flood fill — отдельно реализовывать не нужно
2. **Flood fill выполняется локально** на каждом клиенте, не сохраняется в Yjs
3. **В Yjs сохраняется только одна операция** — клик по начальной ячейке

```typescript
// Логика работы при reveal(x, y):
// 
// 1. Проверка на дубликат (в GameRoom)
// 2. Сохранение операции в Yjs (в GameRoom)
// 3. Вызов gameEngine.reveal(index), который:
//    - Открывает ячейку (x, y)
//    - Если ячейка пустая (0), рекурсивно открывает соседей
//    - Это уже реализовано в существующем GameEngine
// 4. Проверка на проигрыш (если мина)
```

### 6.2 Почему flood fill не сохраняется в Yjs

| Параметр | Значение |
|----------|----------|
| **Размер операции** | 1 клик = ~50 байт в Yjs |
| **Flood fill на 100 ячеек** | 100 операций = ~5000 байт |
| **Детерминизм** | Одинаковый seed = одинаковое поле = одинаковый flood fill |
| **Синхронизация** | Только клик синхронизируется, flood fill вычисляется локально |

**Пример:**
```
Игрок кликает на (50, 50):
├── В Yjs сохраняется: {type: 'leftClick', x: 50, y: 50}
├── Клиент 1 локально открывает: 50 ячеек через flood fill
├── Клиент 2 получает операцию и тоже локально открывает: 50 ячеек
└── Результат идентичен благодаря одинаковому seed
```

---

## 7. Интеграция с UI

### 7.1 Изменения в UI слое

UI должен работать только с GameRoom, не напрямую с GameEngine:

```typescript
// BEFORE (UI работает с GameEngine напрямую)
const engine = new GameEngine({ scheduler, ... })

// В обработчике клика:
engine.reveal(index)

// Подписка на изменения:
engine.subscribe(() => updateUI(engine.getGameState()))
```

```typescript
// AFTER (UI работает с GameRoom)
const room = new GameRoom({ 
  scheduler, 
  playerName: 'Alice',
  gameParams: { width: 100, height: 100, minesNum: 1000 }
})

await room.createGame({ width: 100, height: 100, minesNum: 1000 })

// В обработчике клика:
room.handleLeftClick(x, y)

// Подписка на изменения:
room.subscribe((state) => updateUI(state))
```

### 7.2 Сценарии использования

**Single-player:**
```typescript
const room = new GameRoom({ scheduler: new Scheduler() })
await room.createGame({ width: 50, height: 50, minesNum: 100 })
// GameRoom работает без синхронизации
```

**Multiplayer (Host):**
```typescript
const room = new GameRoom({ 
  scheduler: new Scheduler(),
  syncProviderFactory: createWebRtcProvider
})
await room.createGame({ width: 100, height: 100, minesNum: 1000 })
const roomId = room.getRoomId() // Поделиться с другими игроками
```

**Multiplayer (Client):**
```typescript
const room = new GameRoom({ 
  scheduler: new Scheduler(),
  playerName: 'Bob',
  syncProviderFactory: createWebRtcProvider
})
await room.joinGame(roomId) // roomId от хоста
```

---

## 8. Тестирование

### 8.1 Структура тестов

```
src/
├── room/
│   ├── GameRoom.spec.ts           # Интеграционные тесты GameRoom
│   ├── CrdtManager.spec.ts        # Тесты CRDT операций
│   └── LocalSyncProvider.spec.ts  # Тесты провайдера
├── engine/
│   └── GameEngine.spec.ts         # Существующие тесты (без изменений)
└── core/
    └── eventBus.spec.ts           # Тесты EventBus
```

### 8.2 Пример теста синхронизации

```typescript
// src/room/GameRoom.spec.ts

describe('GameRoom CRDT Synchronization', () => {
  it('should synchronize leftClick between two rooms', async () => {
    // Создаём общий EventBus для тестирования
    const eventBus = new EventBus()
    
    // Создаём фабрику провайдера
    const createProvider = (roomId: string, doc: Y.Doc) => {
      return new LocalSyncProvider(roomId, doc, eventBus)
    }
    
    // Создаём первую комнату (Host)
    const room1 = new GameRoom({
      scheduler: new Scheduler(),
      playerName: 'Alice',
      syncProviderFactory: createProvider,
    })
    
    await room1.createGame({ width: 10, height: 10, minesNum: 10 })
    const roomId = room1.getRoomId()!
    
    // Создаём вторую комнату (Client)
    const room2 = new GameRoom({
      scheduler: new Scheduler(),
      playerName: 'Bob',
      syncProviderFactory: createProvider,
    })
    
    await room2.joinGame(roomId)
    
    // Проверяем, что обе комнаты имеют одинаковое начальное состояние
    expect(room1.getGameState().tilesLeft).toBe(room2.getGameState().tilesLeft)
    
    // Игрок 1 открывает ячейку
    room1.handleLeftClick(5, 5)
    
    // Проверяем, что операция синхронизировалась
    const state1 = room1.getGameState()
    const state2 = room2.getGameState()
    
    expect(state1.tilesLeft).toBe(state2.tilesLeft)
    expect(state1.visibleBoard).toEqual(state2.visibleBoard)
  })
  
  it('should resolve flag vs reveal conflict in favor of reveal', async () => {
    // Тест конфликта: флаг vs открытие
    // Ожидаемый результат: открытие побеждает
  })
  
  it('should deduplicate operations', async () => {
    // Тест дедупликации
    // Одинаковая операция не должна применяться дважды
  })
  
  it('should handle offline mode and sync on reconnect', async () => {
    // Тест offline режима
    // 1. Пауза синхронизации
    // 2. Несколько операций
    // 3. Возобновление синхронизации
    // 4. Проверка, что все операции применились
  })
})
```

---

## 9. План реализации

### Phase 1: Подготовка (без изменений в GameEngine)
1. Создать `src/types/operations.ts` — типы операций
2. Создать `src/room/GamePlayer.ts` — класс игрока
3. Создать `src/core/eventBus.ts` — EventBus для тестов
4. Создать `src/room/SyncProvider.ts` — интерфейс

### Phase 2: CRDT инфраструктура
5. Создать `src/room/CrdtManager.ts` — обёртка над Yjs
6. Создать `src/room/LocalSyncProvider.ts` — тестовый провайдер
7. Тесты для CrdtManager и LocalSyncProvider

### Phase 3: GameRoom (основной класс)
8. Создать `src/room/GameRoom.ts`
9. Интеграция с GameEngine
10. Интеграционные тесты GameRoom + GameEngine

### Phase 4: Изменения в GameEngine
11. Добавить метод `applyOperation()` в GameEngine
12. Убедиться, что существующие тесты проходят
13. Добавить тесты для `applyOperation()`

### Phase 5: Сохранение/загрузка
14. Обновить `GameSaveManager` для поддержки формата версии 2
    - Добавить `serializeV2()` и `deserializeV2()`
    - Добавить `detectVersion()` для определения версии файла
    - При загрузке файла версии 1 — выбрасывать `SaveVersionError`
15. Интеграция сохранения в GameRoom
    - Метод `GameRoom.save(filename)`
    - Статический метод `GameRoom.load(filename, config)`
15. Добавить метод `load()` в GameRoom
16. Тесты сохранения/загрузки

### Phase 6: UI интеграция
17. Обновить UI для работы с GameRoom вместо GameEngine
18. Тесты полного сценария

### Phase 7: Финализация
19. Проверка типов: `pnpm lint:types`
20. Линтер: `pnpm lint:fix`
21. Все тесты: `pnpm test`
