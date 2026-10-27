/** If the new service worker has not taken control by then, reload plainly anyway. */
export const RELOAD_FALLBACK_MS = 3000

type Options = {
  /** usePwa().needRefresh: a new worker is known to be waiting. */
  needRefresh?: boolean
  /** usePwa().update: activates that worker; the page reloads once it controls. */
  update?: () => void
}

/**
 * Reload that escapes a stale shell after a deploy. While an old service worker controls the page, a plain
 * reload is answered from its precached index.html, which asks for the same missing chunks again. So: activate
 * a waiting worker first (usePwa().update(), or SKIP_WAITING after registration.update() finds one) and reload
 * when it takes control. No service worker, no registration, nothing waiting, or any failure: a plain reload.
 * Every path ends in exactly one reload, at the latest after RELOAD_FALLBACK_MS.
 */
export async function reloadFresh({ needRefresh, update }: Options = {}): Promise<void> {
  let done = false
  const reload = () => {
    if (done) return
    done = true
    clearTimeout(timer)
    window.location.reload()
  }
  const timer = setTimeout(reload, RELOAD_FALLBACK_MS)

  try {
    if (needRefresh && update) {
      update()
      return
    }
    const sw = typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined
    if (!sw || typeof sw.getRegistration !== 'function') return reload()
    const reg = await sw.getRegistration()
    if (!reg) return reload()
    // Offline or a failed check: whatever is already waiting still counts.
    await reg.update().catch(() => undefined)
    const next = reg.waiting ?? reg.installing
    if (!next) return reload()

    sw.addEventListener('controllerchange', reload, { once: true })
    const skip = () => next.postMessage({ type: 'SKIP_WAITING' })
    if (next.state === 'installed') return skip()
    next.addEventListener('statechange', () => {
      if (next.state === 'installed') skip()
      else if (next.state === 'redundant') reload()
    })
  } catch {
    reload()
  }
}
