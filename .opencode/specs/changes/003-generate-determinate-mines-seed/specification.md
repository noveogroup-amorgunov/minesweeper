# Спецификация: Детерминированная генерация поля по seed

## 1. Обзор архитектурных изменений

### Текущая схема (без изменений для одиночной игры)
```
GameEngine → Web Worker (generateMinesRandom)
                    ↓
              ArrayBuffer (mines)
```

### Новая схема (для мультиплеера)
```
GameEngine (mode: 'seeded') → Web Worker (generateMines)
                                          ↓
                                    ArrayBuffer (mines)
                                    (идентичное на всех клиентах)
```

### Архитектура передачи генератора случайных чисел

```
Web Worker
    │
    ├─ generateMines.ts
    │   ├─ generateMines(array, minesNum, random?) ← принимает RandomGenerator как параметр
    │   │                                             (по умолчанию Math.random)
    │   │
    │   ├─ createSeededRandom(seed) → возвращает () => number
    │   │                              (создается рядом с generateMines)
    │   │
    │   └─ generateMinesRandom(array, minesNum) → использует Math.random
    │
    └─ GameWebWorker.ts
        ├─ случай генерация → вызывает generateMinesRandom()
        └─ сид генерация  → вызывает generateMines() с seeded random
```

**Ключевой принцип:** Функция `generateMines` принимает генератор случайных чисел как параметр (`random: () => number`), что позволяет:
- Использовать `Math.random()` по умолчанию
- Передавать кастомный seeded генератор для мультиплеера
- Тестировать генерацию с предсказуемыми значениями
- Выполнять код внутри Web Worker без внешних зависимостей

**Важно:** Логика определения `emptyTileIndex` остается без изменений — берется первая пустая ячейка.

---

## 2. Алгоритмы хеширования строки (seed → number)

### 2.1 cyrb128 (Custom hash by bryc) ✅ УТВЕРЖДЕННЫЙ

**Описание:** Компактная реализация хеш-функции, специально разработанная для seedable PRNG. Возвращает 4×32-bit значения для максимальной энтропии.

**Реализация:**
```typescript
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703; let h2 = 3144134277
  let h3 = 1013904242; let h4 = 2773480762

  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}
```

**Плюсы:**
- 🎰 128-bit выход (4 числа) — идеально для sfc32
- 📦 Компактный код (~25 строк)
- ⚡ Очень быстрый (использует Math.imul)
- 🎯 Хорошее распределение для коротких строк

---

## 3. Алгоритм генерации псевдослучайных чисел

### 3.1 sfc32 (Small Fast Counter) ✅ УТВЕРЖДЕННЫЙ

**Описание:** Современный PRNG от Chris Doty-Humphrey (автора PractRand). Использует 128-bit состояние для максимального периода.

**Реализация:**
```typescript
function sfc32(a: number, b: number, c: number, d: number) {
  return function (): number {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}
```

**Характеристики:**
- **Состояние:** 128 bit (4×32-bit числа)
- **Период:** 2^128 (практически бесконечный)
- **Скорость:** ~45M чисел/сек

---

## 4. Рекомендуемая комбинация

### cyrb128 + sfc32

```typescript
// Полная цепочка: roomId → hash → PRNG → random()
function createSeededRandom(seed: string) {
  const [a, b, c, d] = cyrb128(seed)
  return sfc32(a, b, c, d)
}

// Использование
const random = createSeededRandom('room-abc-123')
const hasMine = random() < probability
```

**Обоснование:**
- 128-bit состояние = период 2^128 >> 10^10 (100M клеток)
- sfc32 проходит все тесты PractRand
- Компактная реализация без зависимостей

---

## 5. Формат идентификатора комнаты (roomId)

### Base62 короткий ID ✅ УТВЕРЖДЕННЫЙ ФОРМАТ

**Формат:** `1a2B3c` (10-12 символов из 0-9, a-z, A-Z)

**Примеры:**
```
1a2B3c4D5e
Xy9KpM2nQr
room_8f3k9
```

**Плюсы:**
- 🎯 Компромисс между длиной и энтропией
- 62^10 = 8.4 × 10^17 комбинаций
- 👤 Относительно удобен для ввода
- 🔒 Достаточная энтропия для игр
- 📦 Простая реализация без зависимостей

**✅ РЕШЕНИЕ:** Использовать Base62 как единственный формат roomId для мультиплеера.

**Реализация:**
```typescript
// Статический метод в GameEngine
static generateRoomId(length = 10): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  return Array.from(array)
    .map(byte => alphabet[byte % 62])
    .join('');
}
```

**Важно:**
- Валидация seed НЕ требуется
- Нормализация seed НЕ производится (используется как есть)
- О защите от коллизий roomId заботиться не нужно

---

## 6. Реализация генератора случайных чисел

### 6.1 Интерфейс RandomGenerator

```typescript
// src/engine/types.ts

/** Функция генерации случайного числа [0, 1) */
export type RandomGenerator = () => number

/** Режим генерации поля */
export type GenerationMode = 'random' | 'seeded'

/** Расширенный заголовок сохранения для поддержки seeded режима */
export interface SaveFileHeader {
  // ... существующие поля ...
  generationMode?: GenerationMode // 'random' по умолчанию
  seed?: string // seed для 'seeded' режима
}
```

### 6.2 Реализация в generateMines.ts

```typescript
// src/engine/generateMines.ts

/**
 * Создает seeded генератор случайных чисел на основе seed
 * Использует cyrb128 + sfc32 для максимального периода и качества
 *
 * Примечание: seed используется как есть, без фильтрации символов
 */
export function createSeededRandom(seed: string): RandomGenerator {
  // cyrb128 хеширование строки в 4 числа
  let h1 = 1779033703; let h2 = 3144134277
  let h3 = 1013904242; let h4 = 2773480762

  for (let i = 0, k; i < seed.length; i++) {
    k = seed.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

  // sfc32 PRNG с 128-bit состоянием
  let a = h1 >>> 0; let b = h2 >>> 0; let c = h3 >>> 0; let d = h4 >>> 0

  return function (): number {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

/**
 * Генерация поля мин с кастомным генератором случайных чисел
 * @param array - Uint8Array для заполнения (модифицируется inplace)
 * @param minesNum - количество мин
 * @param random - генератор [0,1), по умолчанию Math.random
 * @returns индекс пустой ячейки для первого хода
 */
export function generateMines(
  array: Uint8Array,
  minesNum: number,
  random: RandomGenerator = Math.random
): number {
  // ... существующая логика с заменой Math.random на random() ...
  // emptyTileIndex берется как первая пустая ячейка (без изменений)
}

/**
 * Генерация с использованием Math.random (для обратной совместимости)
 */
export function generateMinesRandom(
  array: Uint8Array,
  minesNum: number
): number {
  return generateMines(array, minesNum, Math.random)
}
```

**Важно:**
- Логика определения `emptyTileIndex` остается без изменений
- Seeded генератор "прокручивается" дальше на втором проходе (если нужно добрать мины)
- Функция модифицирует массив inplace и возвращает `emptyTileIndex`

### 6.3 Интеграция с Web Worker

```typescript
// src/engine/GameWebWorker.ts

import { createSeededRandom, generateMines, generateMinesRandom } from './generateMines'

self.onmessage = (event) => {
  const { type, array, minesNum, mode, seed } = event.data

  if (type === 'GENERATE_BOARD_REQUEST') {
    let emptyTileIndex: number

    if (mode === 'seeded' && seed) {
      // Создаем seeded генератор прямо в воркере
      const random = createSeededRandom(seed)
      emptyTileIndex = generateMines(array, minesNum, random)
    }
    else {
      // Обычная генерация через Math.random
      emptyTileIndex = generateMinesRandom(array, minesNum)
    }

    self.postMessage({
      type: 'GENERATE_BOARD_RESPONSE',
      data: { buffer: array.buffer, emptyTileIndex }
    }, [array.buffer])
  }
}
```

### 6.4 Преимущества подхода

| Подход | Преимущества |
|--------|-------------|
| **Параметр random** | Инъекция зависимости — легко тестировать |
| **createSeededRandom рядом** | Нет внешних зависимостей в воркере |
| **Math.random по умолчанию** | Обратная совместимость без изменений |
| **Единая generateMines** | Один код для обоих режимов |

---

## 7. API изменения

### Новые типы (src/engine/types.ts)

```typescript
/** Функция генерации случайного числа [0, 1) */
export type RandomGenerator = () => number

/** Режим генерации поля */
export type GenerationMode = 'random' | 'seeded'

/** Расширенный заголовок сохранения */
export interface SaveFileHeader {
  /** Format version */
  version: string
  /** Save timestamp (ISO 8601) */
  savedAt: string
  /** Board width */
  width: number
  /** Board height */
  height: number
  /** Total mines count */
  minesNum: number
  /** Remaining unflagged mines */
  minesLeft: number
  /** Unrevealed tiles count */
  tilesLeft: number
  /** Elapsed time in seconds */
  gameTimeSeconds: number
  /** Current game status */
  gameStatus: GameStatus
  /** Viewport X coordinate */
  offsetX: number
  /** Viewport Y coordinate */
  offsetY: number
  /** Whether first move was made */
  userDidFirstMove: boolean
  /** Empty tile index (for first move swap) */
  emptyTileIndex: number
  /** Generation mode */
  generationMode?: GenerationMode
  /** Seed for seeded generation */
  seed?: string
}
```

### Web Worker API

```typescript
// Расширенный интерфейс сообщения
interface WorkerMessage {
  type: 'GENERATE_BOARD_REQUEST'
  payload: {
    array: Uint8Array<ArrayBuffer>
    minesNum: number
    mode?: GenerationMode // 'random' по умолчанию
    seed?: string // опционально — для 'seeded' режима
  }
}

// Ответ от воркера (без изменений)
interface MainThreadMessage {
  type: 'GENERATE_BOARD_RESPONSE'
  data: {
    buffer: ArrayBuffer
    emptyTileIndex: number
  }
}
```

### GameEngine

```typescript
class GameEngine {
  constructor(options: {
    width?: number
    height?: number
    minesNum?: number
    scheduler: AbstractScheduler
    saveManager?: SaveManager
    mode?: GenerationMode // 'random' по умолчанию
  })

  // Публичный метод для получения seed (для отладки)
  getSeed(): string | undefined

  // Публичный метод для получения режима генерации
  getMode(): GenerationMode

  // Статический метод для генерации roomId (только base62)
  static generateRoomId(length?: number): string // по умолчанию 10
}
```

**Важно:**
- В конструктор передается только `mode` ('random' | 'seeded')
- Если `mode === 'seeded'`, seed генерируется автоматически внутри GameEngine через `generateRoomId()`
- Для получения seed используется метод `getSeed()`

---

## 8. План реализации

### Этап 1: Реализация generateMines с параметром random (2 часа)
- [ ] Добавить тип `RandomGenerator` в `src/engine/types.ts`
- [ ] Добавить тип `GenerationMode` в `src/engine/types.ts`
- [ ] Обновить `SaveFileHeader` — добавить `generationMode` и `seed`
- [ ] Рефакторинг `generateMines` — добавить 3-й параметр `random?: () => number`
- [ ] По умолчанию `Math.random` для обратной совместимости
- [ ] Создать `createSeededRandom` рядом с `generateMines`
- [ ] Создать `generateMinesRandom` обертку
- [ ] Обновить экспорты в `src/engine/generateMines.ts`

### Этап 2: Статистические тесты (1.5 часа)
- [ ] Создать `src/engine/generateMines.spec.ts`
- [ ] Тест на равномерное распределение
- [ ] Тест на детерминированность (один seed → одинаковое поле)
- [ ] Тест на различность полей при разных seed
- [ ] Тест на корреляцию последовательных значений

### Этап 3: Web Worker интеграция (1.5 часа)
- [ ] Обновить `GameWebWorker.ts` для поддержки mode/seed
- [ ] Обновить тип `WorkerMessage`
- [ ] Вызов `createSeededRandom` внутри воркера
- [ ] Передача параметров через message interface

### Этап 4: GameEngine обновление (1.5 часа)
- [ ] Добавить параметр `mode` в конструктор
- [ ] Автогенерация seed при `mode: 'seeded'`
- [ ] Передача mode/seed в веб-воркер
- [ ] Добавить методы `getSeed()` и `getMode()`
- [ ] Статический метод `generateRoomId()` с Base62
- [ ] Обновить `createSnapshot()` — сохранять mode и seed
- [ ] Обновить `restoreFromSnapshot()` — восстанавливать mode и seed

### Этап 5: Юнит-тесты GameEngine (1 час)
- [ ] Создать `src/engine/GameEngine.spec.ts`
- [ ] Тесты для `generateRoomId()`
- [ ] Тесты для создания GameEngine с разными mode
- [ ] Тесты для getSeed/getMode

### Этап 6: Интеграционные тесты (1 час)
- [ ] Проверить детерминированность: два GameEngine с mode='seeded' → одинаковое поле
- [ ] Проверить обратную совместимость: mode='random' работает как раньше
- [ ] Проверить сохранение/загрузку с mode и seed

---

## 9. Юнит-тесты

### Тесты для createSeededRandom (src/engine/generateMines.spec.ts)

```typescript
import { describe, expect, it } from 'vitest'
import { createSeededRandom, generateMines } from './generateMines'

describe('createSeededRandom', () => {
  const SAMPLE_SIZE = 100000
  const TOLERANCE = 0.01 // 1% допуск

  it('should produce uniform distribution', () => {
    const random = createSeededRandom('test-seed-123')
    const buckets = Array.from({ length: 10 }).fill(0)

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const value = random()
      const bucket = Math.min(Math.floor(value * 10), 9)
      buckets[bucket]++
    }

    const expected = SAMPLE_SIZE / 10
    for (const count of buckets) {
      const deviation = Math.abs(count - expected) / expected
      expect(deviation).toBeLessThan(TOLERANCE)
    }
  })

  it('should have correct mean (0.5)', () => {
    const random = createSeededRandom('test-seed-456')
    let sum = 0

    for (let i = 0; i < SAMPLE_SIZE; i++) {
      sum += random()
    }

    const mean = sum / SAMPLE_SIZE
    expect(mean).toBeCloseTo(0.5, 2)
  })

  it('should produce identical results for same seed', () => {
    const random1 = createSeededRandom('room-test-123')
    const random2 = createSeededRandom('room-test-123')

    for (let i = 0; i < 1000; i++) {
      expect(random1()).toBe(random2())
    }
  })

  it('should produce different results for different seeds', () => {
    const random1 = createSeededRandom('room-a')
    const random2 = createSeededRandom('room-b')

    let matches = 0
    for (let i = 0; i < 1000; i++) {
      if (random1() === random2())
        matches++
    }

    expect(matches).toBeLessThan(2)
  })
})

describe('generateMines with custom random', () => {
  it('should use Math.random by default', () => {
    const array = new Uint8Array(100)
    const emptyTileIndex = generateMines(array, 10)

    expect(emptyTileIndex).toBeGreaterThanOrEqual(0)
    expect(emptyTileIndex).toBeLessThan(100)
  })

  it('should accept custom random generator', () => {
    let counter = 0
    const mockRandom = () => {
      counter++
      return (counter * 0.1) % 1
    }

    const array = new Uint8Array(100)
    const emptyTileIndex = generateMines(array, 10, mockRandom)

    expect(counter).toBeGreaterThan(10)
    expect(emptyTileIndex).toBeGreaterThanOrEqual(0)
  })

  it('should produce identical fields for same seeded random', () => {
    const seed = 'room-test-identical'

    const array1 = new Uint8Array(1000)
    generateMines(array1, 100, createSeededRandom(seed))

    const array2 = new Uint8Array(1000)
    generateMines(array2, 100, createSeededRandom(seed))

    expect(array1).toEqual(array2)
  })
})
```

### Тесты для GameEngine.generateRoomId (src/engine/GameEngine.spec.ts)

```typescript
import { describe, expect, it } from 'vitest'
import { GameEngine } from './GameEngine'

describe('GameEngine.generateRoomId', () => {
  it('should generate roomId with default length 10', () => {
    const roomId = GameEngine.generateRoomId()
    expect(roomId.length).toBe(10)
  })

  it('should generate roomId with custom length', () => {
    const roomId = GameEngine.generateRoomId(15)
    expect(roomId.length).toBe(15)
  })

  it('should contain only Base62 characters', () => {
    const roomId = GameEngine.generateRoomId()
    expect(roomId).toMatch(/^[0-9a-z]+$/i)
  })

  it('should generate different roomIds on multiple calls', () => {
    const roomId1 = GameEngine.generateRoomId()
    const roomId2 = GameEngine.generateRoomId()
    expect(roomId1).not.toBe(roomId2)
  })
})

describe('GameEngine with mode', () => {
  // Тесты для GameEngine с mode 'random' и 'seeded'
})
```

---

## 10. Пример использования

### Одиночная игра (без изменений)

```typescript
const singlePlayer = new GameEngine({
  width: 10000,
  height: 10000,
  minesNum: 1000000,
  scheduler,
  // mode: 'random' по умолчанию
})
```

### Мультиплеер (новый режим)

```typescript
// Игрок 1 создает комнату
const player1 = new GameEngine({
  width: 10000,
  height: 10000,
  minesNum: 1000000,
  scheduler,
  mode: 'seeded' // Seed генерируется автоматически
})

// Получаем seed для передачи другому игроку
const roomId = player1.getSeed() // "a7K9pM2nQr"

// Игрок 2 подключается к той же комнате
const player2 = new GameEngine({
  width: 10000,
  height: 10000,
  minesNum: 1000000,
  scheduler,
  mode: 'seeded'
})

// Важно: у player2 будет СВОЙ seed (сгенерирован автоматически)
// Для мультиплеера оба игрока должны использовать ОДИНАКОВЫЙ seed
// Передача seed между игроками будет реализована отдельно
```

### Генерация roomId вручную

```typescript
// Генерация roomId через статический метод
const roomId = GameEngine.generateRoomId() // "a7K9pM2nQr" (10 символов)
const roomIdLong = GameEngine.generateRoomId(12) // "a7K9pM2nQrXy" (12 символов)
```

### Низкоуровневое использование (вне GameEngine)

```typescript
import { createSeededRandom, generateMines } from './engine/generateMines'

// С кастомным генератором
const customRandom = createSeededRandom('my-custom-seed')
const array = new Uint8Array(1000)
generateMines(array, 100, customRandom)

// С Math.random (по умолчанию)
const array2 = new Uint8Array(1000)
generateMines(array2, 100)
```

---

## 11. Принятые решения

### Архитектура генератора
**Решение:** Функция `generateMines` принимает `random?: () => number` как 3-й параметр

**Обоснование:**
- Инъекция зависимости — легко тестировать
- Обратная совместимость (по умолчанию `Math.random`)
- Один код для обоих режимов (random и seeded)
- Возможность передачи любого генератора (в том числе моков для тестов)

### emptyTileIndex
**Решение:** Логика определения emptyTileIndex остается без изменений — берется первая пустая ячейка

**Обоснование:**
- Минимальные изменения в существующем коде
- Детерминированность сохраняется при seeded-генерации

### Расположение генератора
**Решение:** `createSeededRandom` находится рядом с `generateMines` в `src/engine/generateMines.ts`

**Обоснование:**
- Генератор доступен внутри Web Worker без внешних зависимостей
- Нет необходимости передавать функцию через structured clone (невозможно)
- Все необходимое для генерации в одном файле

### Алгоритм хеширования
**Выбран:** cyrb128

**Обоснование:**
- 128-bit выход идеально подходит для sfc32
- Компактная реализация без зависимостей
- Достаточная энтропия для любых roomId

### Алгоритм PRNG
**Выбран:** sfc32

**Обоснование:**
- Период 2^128 >> 10^10 клеток на поле
- Отличное качество (проходит PractRand)
- Высокая скорость

### Формат roomId
**Утвержден:** Base62, 10-12 символов

**Обоснование:**
- 8.4×10^17 уникальных комбинаций — достаточно для любого масштаба
- Длина 10-12 символов — комфортно для ввода на мобильных устройствах
- Простая реализация без фильтрации символов

### GameEngine API
**Решение:** В конструктор передается только `mode`, seed генерируется автоматически

**Обоснование:**
- Упрощение API
- Seed генерируется криптографически безопасно через `crypto.getRandomValues`
- Для получения seed используется метод `getSeed()`

### Сохранение игры
**Решение:** mode и seed сохраняются в SaveFileHeader, но поле восстанавливается из boardData

**Обоснование:**
- Полная совместимость с существующей системой сохранения
- Информация о режиме доступна для отладки
- Регенерация поля из seed не требуется

---

## 12. Будущие улучшения

1. **Криптографическая защита seed** — HMAC или Argon2 для защиты от подбора
2. **Сжатие seed** — использовать меньше символов с большей энтропией на символ
3. **Версионирование алгоритма** — добавить версию в seed для совместимости
4. **Валидация поля** — проверка, что сгенерированное поле "играбельно"
5. **Конфигурируемая длина roomId** — позволить пользователю выбирать длину ID
6. **Передача seed между игроками** — реализовать механизм обмена seed для мультиплеера
