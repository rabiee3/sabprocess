import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Controls a keyboard user can reach: skips ones hidden at this breakpoint (e.g. `lg:hidden`). */
function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) =>
    typeof el.checkVisibility === 'function' ? el.checkVisibility() : true,
  )
}

/**
 * Modal focus handling: focus `initial` on mount, keep Tab / Shift+Tab inside `root`, call `onEscape`
 * on Escape, and on unmount return focus to whatever had it before (if that was a real control).
 */
export function useFocusTrap(
  root: RefObject<HTMLElement | null>,
  initial: RefObject<HTMLElement | null>,
  onEscape: () => void,
) {
  const escape = useRef(onEscape)
  useEffect(() => {
    escape.current = onEscape
  })

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ;(initial.current ?? root.current)?.focus()

    function onKey(e: KeyboardEvent) {
      const box = root.current
      if (!box) return
      if (e.key === 'Escape') {
        e.preventDefault()
        escape.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables(box)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!box.contains(active)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && (active === first || active === initial.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener && opener !== document.body && opener.isConnected) opener.focus()
    }
  }, [root, initial])
}
