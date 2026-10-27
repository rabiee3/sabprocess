type Idle = (cb: () => void, opts?: { timeout?: number }) => number
type IdleWindow = { requestIdleCallback?: Idle; cancelIdleCallback?: (h: number) => void }

/** Runs `cb` when the main thread is idle, at the latest after 1.5 s; returns a cancel function. */
export function whenIdle(cb: () => void): () => void {
  const w = (typeof window === 'undefined' ? {} : window) as IdleWindow
  if (w.requestIdleCallback && w.cancelIdleCallback) {
    const cancel = w.cancelIdleCallback
    const h = w.requestIdleCallback(cb, { timeout: 1500 })
    return () => cancel(h)
  }
  const h = setTimeout(cb, 1)
  return () => clearTimeout(h)
}
