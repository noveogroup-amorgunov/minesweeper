import { PriorityQueue } from './PriorityQueue'

type Priority = 'high' | 'low'

interface IdleTask {
  task: () => void
  priority: Priority
}

//   const queue = new PriorityQueue<[number, number]>((a, b) => a[0] > b[0])

export class SchedulerV2 {
  private taskQueue: PriorityQueue<IdleTask> = new PriorityQueue<IdleTask>((a, b) => a.priority > b.priority)

  schedule(task: () => void, priority: Priority) {
    this.taskQueue.push({ task, priority })
  }
}
