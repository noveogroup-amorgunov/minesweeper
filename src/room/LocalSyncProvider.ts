import type { SyncProvider } from './SyncProvider'
import * as Y from 'yjs'
import { EventBus } from '../core/eventBus'

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
    eventBus?: EventBus,
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
      },
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
      origin: 'local',
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
