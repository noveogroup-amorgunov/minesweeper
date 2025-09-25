export type TaskPriority = 'background' | 'user-visible' | 'user-blocking'

export interface AbstractScheduler {
  postTask: (task: () => void, priority?: TaskPriority) => void
  clear: () => void
}
