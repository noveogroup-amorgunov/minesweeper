type Task = () => void

interface IdleTask {
  task: Task
  priority: 'high' | 'normal' | 'low'
  id: string
}

/**
 * Simple scheduler based on requestIdleCallback
 * Allows scheduling tasks to run during browser idle time
 */
export class Scheduler {
  private taskQueue: IdleTask[] = []
  private isProcessing = false
  private taskIdCounter = 0

  /**
   * Schedule a task to run during idle time
   * @param task - The function to execute
   * @param priority - Task priority (high tasks run first)
   * @returns Task ID for cancellation
   */
  schedule(task: Task, priority: 'high' | 'normal' | 'low' = 'normal'): string {
    const id = `task_${++this.taskIdCounter}`
    const idleTask: IdleTask = { task, priority, id }

    this.taskQueue.push(idleTask)
    this.sortQueue()

    if (!this.isProcessing) {
      this.processQueue()
    }

    return id
  }

  /**
   * Cancel a scheduled task
   * @param taskId - The ID returned from schedule()
   */
  cancel(taskId: string): boolean {
    const index = this.taskQueue.findIndex(task => task.id === taskId)
    if (index > -1) {
      this.taskQueue.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * Clear all scheduled tasks
   */
  clear(): void {
    this.taskQueue = []
  }

  /**
   * Get the number of pending tasks
   */
  getPendingTaskCount(): number {
    return this.taskQueue.length
  }

  /**
   * Sort the task queue by priority
   */
  private sortQueue(): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 }
    this.taskQueue.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  }

  /**
   * Process the task queue using requestIdleCallback
   */
  private processQueue(): void {
    if (this.taskQueue.length === 0) {
      this.isProcessing = false
      return
    }

    this.isProcessing = true

    // Use requestIdleCallback if available, otherwise fallback to setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(
        (deadline) => {
          this.executeTasks(deadline)
        },
        { timeout: 50 }, // 50ms timeout to ensure tasks eventually run
      )
    }
    else {
      // Fallback for browsers that don't support requestIdleCallback
      setTimeout(() => {
        this.executeTasks({ timeRemaining: () => 16 }) // Simulate 16ms frame
      }, 0)
    }
  }

  /**
   * Execute tasks within the available idle time
   */
  private executeTasks(deadline: IdleDeadline | { timeRemaining: () => number }): void {
    const startTime = performance.now()
    const maxExecutionTime = 16 // Target 60fps (16ms per frame)

    while (this.taskQueue.length > 0 && deadline.timeRemaining() > 0) {
      const task = this.taskQueue.shift()!

      try {
        task.task()
      }
      catch (error) {
        console.error('Error executing scheduled task:', error)
      }

      // Safety check to prevent infinite loops
      if (performance.now() - startTime > maxExecutionTime) {
        break
      }
    }

    // Continue processing if there are more tasks
    if (this.taskQueue.length > 0) {
      this.processQueue()
    }
    else {
      this.isProcessing = false
    }
  }

  /**
   * Schedule a task that will be executed immediately if the browser is idle,
   * or queued for later execution if busy
   */
  scheduleImmediate(task: Task): string {
    return this.schedule(task, 'high')
  }

  /**
   * Schedule a low-priority task that will only run when the browser is very idle
   */
  scheduleLowPriority(task: Task): string {
    return this.schedule(task, 'low')
  }
}

// Global scheduler instance
export const globalScheduler = new Scheduler()
