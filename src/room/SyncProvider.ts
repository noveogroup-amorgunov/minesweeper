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
  destroy: () => void
}

/**
 * Фабрика для создания провайдеров.
 * Позволяет инжектировать разные реализации (тестовую, webrtc и т.д.)
 */
export type SyncProviderFactory = (
  roomId: string,
  doc: Y.Doc,
) => SyncProvider
