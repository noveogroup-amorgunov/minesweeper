import type { AbstractScheduler } from './AbstractScheduler'

// TODO: remove this in future typescript version
declare global {
  interface Window {
    scheduler: {
      postTask: (
        task: () => void,
        options: { priority: 'background', signal?: AbortSignal }
      ) => void
    }
  }

  class TaskController {
    signal: AbortSignal
    abort: () => void
  }
}

export const supportNativeScheduler = 'TaskController' in window && 'scheduler' in window

export class SchedulerNavite implements AbstractScheduler {
  private abortTaskController = new TaskController()

  postTask(task: () => void) {
    window.scheduler.postTask(task, {
      priority: 'background',
      signal: this.abortTaskController.signal,
    })
  }

  clear() {
    this.abortTaskController.abort()
    this.abortTaskController = new TaskController()
  }
}
