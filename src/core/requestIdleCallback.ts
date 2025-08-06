window.requestIdleCallback = window.requestIdleCallback || function (cb) {
  const start = Date.now()
  return setTimeout(() => {
    cb({
      didTimeout: false,
      timeRemaining() {
        return Math.max(0, 50 - (Date.now() - start)) // // 16 -> Simulate 16ms frame
      },
    })
  }, 1) as unknown as number
}

window.cancelIdleCallback = window.cancelIdleCallback || function (id) {
  clearTimeout(id)
}
