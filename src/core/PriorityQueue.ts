const topIndex = 0
const parentNode = (i: number) => ((i + 1) >>> 1) - 1 // Math.floor((i / 2) - 1)
const left = (i: number) => (i << 1) + 1 // 2i + 1
const right = (i: number) => (i + 1) << 1 // 2i + 2

// i << 1 это битовый сдвиг влево на 1 (умножение на 2)
// >>> 1 — беззнаковый сдвиг вправо на 1 (деление на 2 без знака)

// array-based binary heap
// root is at index 0, and the children of a node at index i are at indices 2i + 1 and 2i + 2
export class PriorityQueue<T> {
  private _heap: T[]

  private _comparator: (a: T, b: T) => boolean

  constructor(comparator = (a: T, b: T) => a > b) {
    this._heap = []
    this._comparator = comparator
  }

  size() {
    return this._heap.length
  }

  isEmpty() {
    return this.size() === 0
  }

  peek() {
    return this._heap[topIndex]
  }

  // enqueue
  push(...values: T[]) {
    values.forEach((value) => {
      this._heap.push(value)
      this._siftUp()
    })

    return this.size()
  }

  // dequeue
  pop() {
    const poppedValue = this.peek()
    const bottom = this.size() - 1

    if (bottom > topIndex) {
      this._swap(topIndex, bottom)
    }

    this._heap.pop()
    this._siftDown()

    return poppedValue
  }

  replace(value: T) {
    const replacedValue = this.peek()
    this._heap[topIndex] = value
    this._siftDown()

    return replacedValue
  }

  _greater(i: number, j: number) {
    return this._comparator(this._heap[i], this._heap[j])
  }

  _swap(i: number, j: number) {
    [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]]
  }

  _siftUp() {
    let node = this.size() - 1

    while (node > topIndex && this._greater(node, parentNode(node))) {
      this._swap(node, parentNode(node))
      node = parentNode(node)
    }
  }

  _siftDown() {
    let node = topIndex

    while (
      (left(node) < this.size() && this._greater(left(node), node))
      || (right(node) < this.size() && this._greater(right(node), node))
    ) {
      const maxChild = (right(node) < this.size() && this._greater(right(node), left(node))) ? right(node) : left(node)
      this._swap(node, maxChild)
      node = maxChild
    }
  }
}
