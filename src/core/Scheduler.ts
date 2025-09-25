import type { AbstractScheduler } from './AbstractScheduler'
import { PriorityQueue } from './PriorityQueue'

type Priority = 'background' | 'user-visible' | 'user-blocking'

interface IdleTask {
  task: () => void
  priority: Priority
}

export class Scheduler implements AbstractScheduler {
  private taskQueue: PriorityQueue<IdleTask> = new PriorityQueue<IdleTask>((a, b) => b.priority > a.priority)

  private isProcessing = false

  postTask(task: () => void, priority: Priority = 'background') {
    this.taskQueue.push({ task, priority })

    if (!this.isProcessing) {
      this.processQueue()
    }
  }

  clear() {
    this.taskQueue = new PriorityQueue<IdleTask>((a, b) => a.priority > b.priority)
  }

  private processQueue(): void {
    if (this.taskQueue.size() === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true

    requestIdleCallback(
      (deadline) => { this.executeTasks(deadline) },
      { timeout: 50 }, // 50ms timeout to ensure tasks eventually run
    )
  }

  private executeTasks(deadline: IdleDeadline | { timeRemaining: () => number }): void {
    const startTime = performance.now()
    const maxExecutionTime = 16 // Target 60fps (16ms per frame)

    while (this.taskQueue.size() > 0 && deadline.timeRemaining() > 0) {
      const item = this.taskQueue.pop()

      item.task()

      // Safety check to prevent infinite loops
      if (performance.now() - startTime > maxExecutionTime) {
        break
      }
    }

    if (this.taskQueue.size() > 0) {
      this.processQueue()
    }
    else {
      this.isProcessing = false
    }
  }
}
