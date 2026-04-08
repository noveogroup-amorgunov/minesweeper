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
