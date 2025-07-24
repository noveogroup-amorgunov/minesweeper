type EventHandler<T = any> = (data: T) => void

export class EventEmitter {
  private events: Map<string, EventHandler[]> = new Map()

  /**
   * Subscribe to an event
   * @param eventName - The name of the event to listen for
   * @param handler - The function to call when the event is emitted
   */
  on<T = any>(eventName: string, handler: EventHandler<T>): void {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, [])
    }
    this.events.get(eventName)!.push(handler)
  }

  /**
   * Unsubscribe from an event
   * @param eventName - The name of the event to stop listening for
   * @param handler - The specific handler to remove (optional)
   */
  off(eventName: string, handler?: EventHandler): void {
    if (!this.events.has(eventName)) {
      return
    }

    if (!handler) {
      // Remove all handlers for this event
      this.events.delete(eventName)
    }
    else {
      // Remove specific handler
      const handlers = this.events.get(eventName)!
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
      if (handlers.length === 0) {
        this.events.delete(eventName)
      }
    }
  }

  /**
   * Emit an event with optional data
   * @param eventName - The name of the event to emit
   * @param data - Optional data to pass to event handlers
   */
  emit<T = any>(eventName: string, data?: T): void {
    if (!this.events.has(eventName)) {
      return
    }

    const handlers = this.events.get(eventName)!

    handlers.forEach((handler) => {
      try {
        handler(data)
      }
      catch (error) {
        console.error(`Error in event handler for ${eventName}:`, error)
      }
    })
  }

  /**
   * Subscribe to an event once (automatically unsubscribes after first call)
   * @param eventName - The name of the event to listen for
   * @param handler - The function to call when the event is emitted
   */
  once<T = any>(eventName: string, handler: EventHandler<T>): void {
    const onceHandler = (data: T) => {
      handler(data)
      this.off(eventName, onceHandler)
    }
    this.on(eventName, onceHandler)
  }

  /**
   * Get the number of listeners for a specific event
   * @param eventName - The name of the event
   * @returns The number of listeners
   */
  listenerCount(eventName: string): number {
    return this.events.get(eventName)?.length || 0
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.events.clear()
  }
}
