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
│   ├── GameEngine.ts                  # MODIFIED: Интеграция с Yjs, CRDT операции
│   ├── GameEngine.spec.ts             # MODIFIED: Добавить тесты синхронизации
│   ├── GamePlayer.ts                  # NEW: Класс игрока (id, name)
│   ├── GameWebWorker.ts               # EXISTING
│   ├── CrdtManager.ts                 # NEW: Обёртка над Yjs документом
│   ├── generateMines.ts               # EXISTING
│   └── SaveManager.ts                 # MODIFIED: Новый формат сохранения
│
├── types/
│   └── operations.ts                  # NEW: TypeScript интерфейсы операций
│
├── utils/
│   └── generateRandomId.ts            # EXISTING
│
└── view/
    └── ...                            # EXISTING (UI без изменений)
```

### 1.2 Диаграмма взаимодействия компонентов

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GameEngine                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Board      │  │ CrdtManager  │  │ SaveManager  │  │  GamePlayer  │    │
│  │  (Uint8Array)│  │   (Y.Doc)    │  │              │  │  (id, name)  │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────────┘    │
│         │                 │                 │                               │
│         │ apply()         │ addOperation()  │ save()                        │
│         │                 │                 │                               │
│         ▼                 ▼                 ▼                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Yjs Document                                  │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  Y.Array<Operation> operations                               │  │   │
│  │  │  └── [{type: 'leftClick', x: 5, y: 10, playerId, timestamp}, │  │   │
│  │  │      {type: 'rightClick', x: 3, y: 7, playerId, timestamp},  │  │   │
│  │  │      ...]                                                    │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ sync
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LocalSyncProvider (тестовый)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  EventBus                                                           │   │
│  │  ├── emit('operation', op)                                          │   │
│  │  ├── on('operation', callback)                                      │   │
│  │  └── pause/resume для имитации offline                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│      GameEngine (Client 1)   │          │      GameEngine (Client 2)   │
│  ┌────────────────────────┐  │          │  ┌────────────────────────┐  │
│  │  Y.Doc (operations)    │  │◄────────►│  │  Y.Doc (operations)    │  │
│  │  - leftClick(x,y)      │  │  merge   │  │  - leftClick(x,y)      │  │
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
  /** Монотонный timestamp из Yjs */
  timestamp: number
  /** ID игрока, выполнившего операцию */
  playerId: string
}

/**
 * Операция создания игры
 * Первая операция в любой игре
 */
export interface CreateGameOperation extends BaseOperation {
  type: 'create'
  /** Ширина поля */
  width: number
  /** Высота поля */
  height: number
  /** Количество мин */
  minesNum: number
  /** Seed для генерации поля */
  seed: string
  /** ID комнаты/игры */
  roomId: string
}

/**
 * Операция присоединения к игре
 */
export interface JoinGameOperation extends BaseOperation {
  type: 'join'
  /** ID комнаты для присоединения */
  roomId: string
  /** Seed для генерации поля (должен совпадать с create) */
  seed: string
  width: number
  height: number
  minesNum: number
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
  | CreateGameOperation
  | JoinGameOperation
  | LeftClickOperation
  | RightClickOperation

/**
 * Тип операции для type guard
 */
export type OperationType = GameOperation['type']
```

### 2.2 Структура Yjs документа

```typescript
// src/engine/CrdtManager.ts

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
 *   type: string      // 'create' | 'join' | 'leftClick' | 'rightClick'
 *   x: number?        // только для click операций
 *   y: number?        // только для click операций
 *   playerId: string
 *   timestamp: number
 *   ...другие поля в зависимости от типа
 * }
 */

export interface CrdtManagerConfig {
  /** ID комнаты для синхронизации */
  roomId: string
  /** Callback при добавлении новой операции */
  onOperation?: (op: GameOperation) => void
}

export class CrdtManager {
  private doc: Y.Doc
  private operations: Y.Array<Y.Map>
  private meta: Y.Map
  private processedOps: Set<string> // Для дедупликации
  
  constructor(config: CrdtManagerConfig)
  
  /** Добавить операцию в документ */
  addOperation(op: GameOperation): void
  
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

### 2.3 Класс GamePlayer

```typescript
// src/engine/GamePlayer.ts

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

### 2.4 EventBus

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

### 3.1 Бинарная схема файла

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
// src/engine/SaveManager.ts

/**
 * Magic header для файлов сохранения
 * "MINESCRD" в ASCII = 0x4D494E4553435244
 */
export const SAVE_MAGIC_HEADER = new Uint8Array([
  0x4D, 0x49, 0x4E, 0x45, 0x53, 0x43, 0x52, 0x44
]) // "MINESCRD"

/**
 * Текущая версия формата сохранения
 */
export const SAVE_VERSION = 2

/**
 * Метаданные сохранения (JSON)
 */
export interface SaveMetadata {
  /** Версия формата */
  version: number
  /** Ширина поля */
  width: number
  /** Высота поля */
  height: number
  /** Количество мин */
  minesNum: number
  /** Seed для генерации */
  seed: string
  /** ID комнаты */
  roomId: string
  /** Время создания */
  createdAt: number
  /** ID игрока */
  playerId: string
  /** Имя игрока */
  playerName: string
}

/**
 * Полная структура сохранения
 */
export interface SaveData {
  metadata: SaveMetadata
  /** Yjs state update (бинарные данные) */
  yjsStateUpdate: Uint8Array
}

export class SaveManager {
  /**
   * Сериализовать данные в бинарный формат
   */
  static serialize(data: SaveData): Uint8Array

  /**
   * Десериализовать бинарные данные
   */
  static deserialize(buffer: Uint8Array): SaveData

  /**
   * Сохранить игру в файл
   */
  static save(data: SaveData, filename: string): Promise<void>

  /**
   * Загрузить игру из файла
   */
  static load(filename: string): Promise<SaveData>
}
```

### 3.3 Пример кода сериализации

```typescript
// Псевдокод сериализации
function serializeSave(data: SaveData): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(data.metadata))
  const yjsBytes = data.yjsStateUpdate
  
  const totalSize = 
    8 +                    // MAGIC
    2 +                    // VERSION
    4 +                    // JSON_LEN
    jsonBytes.length +     // JSON
    4 +                    // YJS_LEN
    yjsBytes.length        // YJS_STATE
    // + 4 для CHECKSUM (опционально)
  
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)
  
  let offset = 0
  
  // Magic header
  bytes.set(SAVE_MAGIC_HEADER, offset)
  offset += 8
  
  // Version (uint16le)
  view.setUint16(offset, SAVE_VERSION, true)
  offset += 2
  
  // JSON length (uint32le)
  view.setUint32(offset, jsonBytes.length, true)
  offset += 4
  
  // JSON data
  bytes.set(jsonBytes, offset)
  offset += jsonBytes.length
  
  // Yjs update length (uint32le)
  view.setUint32(offset, yjsBytes.length, true)
  offset += 4
  
  // Yjs state update
  bytes.set(yjsBytes, offset)
  offset += yjsBytes.length
  
  return bytes
}
```

### 3.4 Процесс загрузки игры

При загрузке сохраненной игры выполняется тот же алгоритм, что и при присоединении к существующей игре:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Процесс загрузки игры (Load Game)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Чтение файла .mine                                                      │
│     └── Десериализация: JSON metadata + Yjs state update                    │
│                                                                             │
│  2. Применение Yjs state update                                             │
│     └── CrdtManager.applyStateUpdate(yjsStateUpdate)                        │
│     └── Восстанавливаем все операции в Y.Doc                                │
│                                                                             │
│  3. Поиск операции create                                                   │
│     └── Находим первую операцию type: 'create' в массиве                    │
│     └── Извлекаем: width, height, minesNum, seed, roomId                    │
│                                                                             │
│  4. Перезапуск игры (restartGame)                                           │
│     └── Очищаем текущее состояние (reset)                                   │
│     └── Устанавливаем параметры из create операции                          │
│     └── Генерируем поле с тем же seed (детерминированно)                    │
│                                                                             │
│  5. Применение игровых операций                                             │
│     └── Проходим по всем операциям (кроме create)                           │
│     └── Применяем leftClick/rightClick через handleOperation                │
│     └── Восстанавливаем состояние игры                                      │
│                                                                             │
│  6. Игра загружена и готова к продолжению                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Ключевые моменты:**

1. **Параметры из `create` операции**: Как и при `joinGame`, все параметры игры (width, height, minesNum, seed) берутся из первой операции `create`, а не из JSON metadata. JSON metadata используется только для быстрой проверки и совместимости.

2. **Детерминированное восстановление**: Тот же `seed` гарантирует идентичное поле на всех клиентах.

3. **Последовательность операций**: Важно сначала сделать `restartGame`, затем применять операции в порядке их следования в Yjs массиве.

```typescript
// Пример кода загрузки в GameEngine
async load(saveData: SaveData): Promise<void> {
  // 1. Применяем Yjs state update
  this.crdtManager.applyStateUpdate(saveData.yjsStateUpdate)
  
  // 2. Получаем все операции
  const operations = this.crdtManager.getOperations()
  
  // 3. Находим create операцию
  const createOp = operations.find(op => op.type === 'create') as CreateGameOperation | undefined
  
  if (!createOp) {
    throw new Error('Invalid save file: no create operation found')
  }
  
  // 4. Перезапускаем игру с параметрами из create
  this.restartGame({
    width: createOp.width,
    height: createOp.height,
    minesNum: createOp.minesNum,
    seed: createOp.seed,
    roomId: createOp.roomId
  })
  
  // 5. Применяем все игровые операции
  for (const op of operations) {
    if (op.type === 'leftClick' || op.type === 'rightClick') {
      this.handleOperation(op)
    }
  }
}
```

---

## 4. Архитектура синхронизации

### 4.1 Абстрактный провайдер синхронизации

```typescript
// src/engine/SyncProvider.ts

import type * as Y from 'yjs'

/**
 * Базовый интерфейс для всех провайдеров синхронизации.
 * 
 * Совместим с API y-webrtc:
 * @see https://github.com/yjs/y-webrtc
 * 
 * В будущем можно заменить LocalSyncProvider на WebrtcProvider
 * без изменений в GameEngine.
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
// src/engine/LocalSyncProvider.ts

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

### 4.3 Интеграция в GameEngine

```typescript
// src/engine/GameEngine.ts (изменения)

import * as Y from 'yjs'
import { CrdtManager } from './CrdtManager'
import { GamePlayer } from './GamePlayer'
import { LocalSyncProvider } from './LocalSyncProvider'
import type { SyncProvider, SyncProviderFactory } from './SyncProvider'
import type { GameOperation } from '../types/operations'

export interface GameEngineConfig {
  width: number
  height: number
  minesNum: number
  mode: 'random' | 'seeded'
  roomId?: string
  player?: GamePlayer
  /** Фабрика для создания провайдера синхронизации */
  syncProviderFactory?: SyncProviderFactory
}

export class GameEngine {
  private board: Uint8Array
  private crdtManager: CrdtManager
  private player: GamePlayer
  private syncProvider: SyncProvider | null = null
  private seed: string
  
  constructor(config: GameEngineConfig) {
    // ... инициализация поля ...
    
    // Создаём или используем переданного игрока
    this.player = config.player ?? new GamePlayer()
    
    // Создаём CRDT менеджер
    this.crdtManager = new CrdtManager({
      roomId: config.roomId ?? generateRoomId(),
      onOperation: (op) => this.handleOperation(op)
    })
    
    // Подключаем синхронизацию если есть roomId
    if (config.roomId) {
      const factory = config.syncProviderFactory ?? 
        ((roomId, doc) => new LocalSyncProvider(roomId, doc))
      
      this.syncProvider = factory(
        config.roomId,
        this.crdtManager.getDoc()
      )
    }
    
    // Добавляем начальную операцию создания игры
    this.crdtManager.addOperation({
      type: 'create',
      width: config.width,
      height: config.height,
      minesNum: config.minesNum,
      seed: this.seed,
      roomId: this.crdtManager.getRoomId(),
      playerId: this.player.id,
      timestamp: Date.now()
    })
  }

  /**
   * Обработка входящей операции (от других клиентов)
   */
  private handleOperation(op: GameOperation): void {
    switch (op.type) {
      case 'leftClick':
        // Применяем операцию от другого клиента
        // Существующий метод reveal уже содержит логику открытия
        // и рекурсивного открытия соседей (flood fill)
        this.reveal(op.x, op.y, false)
        break
      case 'rightClick':
        // Применяем операцию от другого клиента
        // Существующий метод flag переключает состояние флага
        this.flag(op.x, op.y, false)
        break
      case 'create':
        // Игнорируем create — используем только при инициализации
        // Параметры уже получены при подключении
        break
      case 'join':
        // Игнорируем join — это просто сигнал о присоединении
        break
    }
  }

  /**
   * Присоединение к существующей игре
   * Вызывается когда игрок хочет присоединиться к комнате
   */
  async joinGame(roomId: string): Promise<void> {
    // 1. Подключаемся к существующему Yjs документу
    // (через LocalSyncProvider или другой провайдер)
    
    // 2. Ждем получения всех операций
    const operations = this.crdtManager.getOperations()
    
    // 3. Находим первую операцию create
    const createOp = operations.find(op => op.type === 'create') as CreateGameOperation | undefined
    
    if (!createOp) {
      throw new Error('Game not found: no create operation in document')
    }
    
    // 4. Перезапускаем игру с параметрами из create
    this.restartGame({
      width: createOp.width,
      height: createOp.height,
      minesNum: createOp.minesNum,
      seed: createOp.seed,
      roomId: createOp.roomId
    })
    
    // 5. Добавляем свою операцию join
    this.crdtManager.addOperation({
      type: 'join',
      roomId: createOp.roomId,
      playerId: this.player.id,
      timestamp: Date.now()
    })
    
    // 6. Применяем все предыдущие операции (кроме create)
    for (const op of operations) {
      if (op.type === 'leftClick' || op.type === 'rightClick') {
        this.handleOperation(op)
      }
    }
  }

  /**
   * Перезапуск игры с новыми параметрами
   * Используется при присоединении к существующей игре
   */
  private restartGame(params: {
    width: number
    height: number
    minesNum: number
    seed: string
    roomId: string
  }): void {
    // Очищаем текущее состояние
    this.reset()
    
    // Устанавливаем новые параметры
    this.width = params.width
    this.height = params.height
    this.minesNum = params.minesNum
    this.seed = params.seed
    this.roomId = params.roomId
    
    // Генерируем поле с тем же seed (детерминированно)
    this.generateBoard()
  }

  /**
   * Переопределяем существующий метод reveal
   * Добавляем генерацию CRDT операции при локальном клике
   */
  reveal(x: number, y: number, isLocal: boolean = true): void {
    // Проверка на дубликат при применении внешней операции
    if (!isLocal && this.isRevealed(x, y)) {
      return // Пропускаем дубликат
    }
    
    // Если локальный клик — сохраняем операцию в CRDT
    if (isLocal) {
      this.crdtManager.addOperation({
        type: 'leftClick',
        x,
        y,
        playerId: this.player.id,
        timestamp: Date.now()
      })
    }
    
    // Вызываем существующую логику открытия ячейки
    // Она уже включает flood fill для пустых ячеек
    super.reveal(x, y)
  }

  /**
   * Переопределяем существующий метод flag
   * Добавляем генерацию CRDT операции при локальном клике
   */
  flag(x: number, y: number, isLocal: boolean = true): void {
    // Проверка: если ячейка уже открыта — не ставим флаг
    // (открытие имеет приоритет над флагом)
    if (this.isRevealed(x, y)) {
      return
    }
    
    // Если локальный клик — сохраняем операцию в CRDT
    if (isLocal) {
      this.crdtManager.addOperation({
        type: 'rightClick',
        x,
        y,
        playerId: this.player.id,
        timestamp: Date.now()
      })
    }
    
    // Вызываем существующую логику переключения флага
    super.flag(x, y)
  }
```


### 4.4 Совместимость с y-webrtc

В будущем переход на реальную сетевую синхронизация выполняется заменой фабрики:

```typescript
// BEFORE (локальное тестирование)
const engine = new GameEngine({
  roomId: 'abc123',
  // Используется LocalSyncProvider по умолчанию
})

// AFTER (WebRTC синхронизация)
import { WebrtcProvider } from 'y-webrtc'

const engine = new GameEngine({
  roomId: 'abc123',
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

## 5. Процесс присоединения к игре (Join Game)

### 5.1 Алгоритм присоединения

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Процесс присоединения к игре                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Игрок вызывает joinGame(roomId)                                         │
│     └── Передает roomId комнаты для присоединения                           │
│                                                                             │
│  2. Подключение к Yjs документу                                             │
│     └── LocalSyncProvider подключается к существующему документу            │
│     └── Получаем все операции через синхронизацию                           │
│                                                                             │
│  3. Поиск операции create                                                   │
│     └── Находим первую операцию type: 'create' в массиве                    │
│     └── Извлекаем: width, height, minesNum, seed, roomId                    │
│                                                                             │
│  4. Перезапуск игры (restartGame)                                           │
│     └── Очищаем текущее состояние (reset)                                   │
│     └── Устанавливаем новые параметры                                       │
│     └── Генерируем поле с тем же seed (детерминированно)                    │
│                                                                             │
│  5. Добавление операции join                                                │
│     └── Создаем операцию type: 'join' с roomId                              │
│     └── Добавляем в Yjs документ                                            │
│                                                                             │
│  6. Применение предыдущих операций                                          │
│     └── Проходим по всем операциям в массиве                                │
│     └── Применяем leftClick/rightClick через handleOperation                │
│     └── Восстанавливаем состояние игры                                      │
│                                                                             │
│  7. Игра готова к использованию                                             │
│     └── Новый игрок видит текущее состояние поля                            │
│     └── Может делать ходы (операции синхронизируются)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Детали реализации

**Важные моменты:**

1. **Параметры игры берутся из операции `create`**
   - `width`, `height`, `minesNum`, `seed` — все из первой операции
   - Не передаются при вызове `joinGame()`, а извлекаются из Yjs

2. **Детерминированная генерация поля**
   - Одинаковый `seed` = одинаковое расположение мин
   - Все клиенты генерируют идентичное поле

3. **Последовательность операций**
   - Сначала `restartGame()` — создаем чистое поле
   - Затем применяем `leftClick`/`rightClick` — восстанавливаем состояние
   - Порядок важен: каждая операция изменяет состояние

4. **Операция `join` — информационная**
   - Сигнализирует о присоединении нового игрока
   - Не влияет на состояние игры
   - Может использоваться для UI (список игроков в будущем)

### 5.3 Пример кода присоединения

```typescript
// Создание игры (первый игрок)
const hostEngine = new GameEngine({
  width: 100,
  height: 100,
  minesNum: 1000,
  mode: 'seeded',
  roomId: 'abc123'
})
// Автоматически добавляется операция create

// Присоединение к игре (второй игрок)
const clientEngine = new GameEngine({
  mode: 'seeded',
  player: new GamePlayer('Player 2')
})

// Присоединяемся к существующей игре
await clientEngine.joinGame('abc123')
// 1. Получаем create операцию: {width: 100, height: 100, minesNum: 1000, seed: '...'}
// 2. Перезапускаем игру с этими параметрами
// 3. Добавляем join операцию
// 4. Применяем все предыдущие клики
```

### 5.4 Обработка ошибок при присоединении

```typescript
async joinGame(roomId: string): Promise<void> {
  // Проверка: игра уже запущена?
  if (this.isGameActive()) {
    throw new Error('Cannot join: game already active')
  }
  
  // Подключаемся к документу
  await this.connectToRoom(roomId)
  
  // Получаем операции
  const operations = this.crdtManager.getOperations()
  
  // Проверка: есть ли операция create?
  const createOp = operations.find(op => op.type === 'create')
  if (!createOp) {
    throw new Error(`Game not found in room ${roomId}`)
  }
  
  // Проверка: совпадают ли размеры поля (если уже заданы)?
  if (this.config.width && this.config.width !== createOp.width) {
    console.warn('Field width mismatch, using values from create operation')
  }
  
  // Перезапуск и применение операций...
}
```

---

## 6. Рекурсивное открытие ячеек (Flood Fill)

### 5.1 Использование существующего метода reveal

При клике на пустую ячейку (без соседних мин) в классическом сапёре автоматически открываются соседние ячейки. **Важно:**

1. **Существующий метод `reveal`** уже содержит логику flood fill — отдельно реализовывать не нужно
2. **Flood fill выполняется локально** на каждом клиенте, не сохраняется в Yjs
3. **В Yjs сохраняется только одна операция** — клик по начальной ячейке

```typescript
// Логика работы при reveal(x, y):
// 
// 1. Проверка на дубликат (если операция извне)
// 2. Сохранение операции в Yjs (если локальный клик)
// 3. Вызов существующего super.reveal(x, y), который:
//    - Открывает ячейку (x, y)
//    - Если ячейка пустая (0), рекурсивно открывает соседей
//    - Это уже реализовано в существующем GameEngine
// 4. Проверка на проигрыш (если мина)
```

### 5.2 Почему flood fill не сохраняется в Yjs

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

## 7. Интеграция с существующей архитектурой

### 7.1 Изменения в GameEngine

```typescript
// Конструктор принимает новые параметры
interface GameEngineConfig {
  // ... существующие поля ...
  roomId?: string
  player?: GamePlayer
  syncProviderFactory?: SyncProviderFactory
}

// Модифицированные методы
class GameEngine {
  /** 
   * Модифицирован: добавлен параметр isLocal
   * При isLocal=true — сохраняет операцию в CRDT
   */
  reveal(x: number, y: number, isLocal?: boolean): void
  
  /** 
   * Модифицирован: добавлен параметр isLocal
   * При isLocal=true — сохраняет операцию в CRDT
   * Проверяет, не открыта ли уже ячейка (приоритет открытия)
   */
  flag(x: number, y: number, isLocal?: boolean): void
  
  /** Получить текущего игрока */
  getPlayer(): GamePlayer
  
  /** Получить ID комнаты */
  getRoomId(): string
  
  /** Получить CRDT менеджер (для тестов) */
  getCrdtManager(): CrdtManager
  
  /** Получить провайдер синхронизации */
  getSyncProvider(): SyncProvider | null
  
  /** Сохранить игру */
  save(): Promise<SaveData>
  
  /** Загрузить игру */
  load(data: SaveData): Promise<void>
}
```

### 7.2 Новые компоненты

| Файл | Назначение |
|------|------------|
| `src/types/operations.ts` | TypeScript интерфейсы операций |
| `src/core/eventBus.ts` | Простой Pub/Sub для тестов |
| `src/engine/GamePlayer.ts` | Класс игрока (id, name) |
| `src/engine/CrdtManager.ts` | Обёртка над Yjs |
| `src/engine/SyncProvider.ts` | Интерфейс провайдера синхронизации |
| `src/engine/LocalSyncProvider.ts` | Локальный провайдер для тестов |

### 7.3 Модификации существующих файлов

| Файл | Изменения |
|------|-----------|
| `src/engine/GameEngine.ts` | Интеграция CRDT, генерация операций |
| `src/engine/SaveManager.ts` | Новый формат сохранения (.mine) |
| `src/engine/GameEngine.spec.ts` | Тесты синхронизации |

---

## 8. Критерии приёмки

- [ ] **Архитектура**: Все новые модули созданы по спецификации
- [ ] **Типы**: TypeScript интерфейсы соответствуют спецификации
- [ ] **Сохранение**: Формат .mine с Magic Header + JSON + Yjs
- [ ] **Синхронизация**: Два инстанса GameEngine синхронизируют операции
- [ ] **Дедупликация**: Дубликаты операций не применяются
- [ ] **Конфликты**: Открытие приоритетнее флага
- [ ] **Flood Fill**: Рекурсивное открытие выполняется локально
- [ ] **Game Over**: Синхронизируется между всеми клиентами
- [ ] **Присоединение**: Процесс joinGame работает корректно — параметры берутся из create операции
- [ ] **Загрузка**: Процесс загрузки работает корректно — параметры берутся из create операции, затем replay всех операций
- [ ] **Совместимость**: LocalSyncProvider можно заменить на WebrtcProvider
- [ ] **Тесты**: Все существующие тесты проходят + новые интеграционные
