import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import closeIcon from '../assets/icons/close.svg?raw'

type Props = { open: boolean; title: string; onClose: () => void; children: ReactNode }

export function BottomSheet({ open, title, onClose, children }: Props) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const el = ref.current
    if (!el) return
    const opener = document.activeElement as HTMLElement | null
    if (typeof el.showModal === 'function') {
      if (!el.open) el.showModal()
    } else {
      el.setAttribute('open', '')
    }
    el.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    const onCancel = (e: Event) => {
      e.preventDefault()
      onCloseRef.current()
    }
    el.addEventListener('keydown', onKey)
    el.addEventListener('cancel', onCancel)
    return () => {
      el.removeEventListener('keydown', onKey)
      el.removeEventListener('cancel', onCancel)
      if (typeof el.close === 'function' && el.open) el.close()
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <dialog
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      className="fixed inset-0 m-0 flex h-full max-h-none w-full max-w-none flex-col bg-surface p-0 text-ink backdrop:bg-ink-strong/50 sm:m-auto sm:h-auto sm:max-h-[90vh] sm:w-[480px] sm:rounded-(--radius-sheet)"
    >
      <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong" />
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-2">
        <h2 className="text-lg font-semibold text-ink-strong">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="-me-2 flex min-h-touch min-w-11 items-center justify-center"
        >
          <span aria-hidden="true" className="size-6" dangerouslySetInnerHTML={{ __html: closeIcon }} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </dialog>
  )
}
