export function requestIdleCallback(cb: (...args: any) => void) {
    const start = Date.now();
    return setTimeout(function () {
        cb({
            didTimeout: false,
            timeRemaining: function () {
                return Math.max(0, 50 - (Date.now() - start));
            },
        });
    }, 1);
}
