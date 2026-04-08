export type EventCallback<T = unknown> = (data: T) => void

/**
 * Простая шина событий для тестирования синхронизации
 */
export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map()
  private paused = false
  private queue: Array<{ event: string, data: unknown }> = []

  /**
   * Подписаться на событие
   */
  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback as EventCallback)

    // Возвращаем функцию отписки
    return () => {
      this.off(event, callback)
    }
  }

  /**
   * Отписаться от события
   */
  off<T>(event: string, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback as EventCallback)
    }
  }

  /**
   * Отправить событие всем подписчикам
   */
  emit<T>(event: string, data: T): void {
    if (this.paused) {
      this.queue.push({ event, data })
      return
    }

    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        callback(data)
      })
    }
  }

  /**
   * Приостановить обработку событий (накопление в очередь)
   */
  pause(): void {
    this.paused = true
  }

  /**
   * Возобновить обработку событий
   */
  resume(): void {
    this.paused = false
    // Обрабатываем накопленные события
    while (this.queue.length > 0) {
      const { event, data } = this.queue.shift()!
      this.emit(event, data)
    }
  }

  /**
   * Очистить очередь накопленных событий
   */
  clearQueue(): void {
    this.queue = []
  }
}
