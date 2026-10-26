import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import menuIcon from '../assets/icons/menu.svg?raw'
import { Icon } from './Icon'

const ITEM =
  'flex min-h-touch w-full items-center px-4 text-start text-sm font-semibold text-ink-strong hover:bg-black/5 focus:bg-black/5 focus-visible:-outline-offset-2'

const items = (list: HTMLElement | null) => [...(list?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]

/**
 * The client header's ☰ menu: About (reopens the intro), For surveyors, and Install when available.
 * The only staff entry point in the client UI besides the intro line; never an admin link.
 */
export function ClientMenu({ onAbout, onInstall }: { onAbout: () => void; onInstall?: () => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const menuId = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)

  // Opening moves focus to the first item.
  useEffect(() => {
    if (open) items(list.current)[0]?.focus()
  }, [open])

  // A click or tap anywhere outside closes it (focus stays where the user put it).
  useEffect(() => {
    if (!open) return
    function onDown(e: PointerEvent | MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  function close(refocus: boolean) {
    setOpen(false)
    if (refocus) button.current?.focus()
  }

  function onKeyDown(e: KeyboardEvent<HTMLUListElement>) {
    const all = items(list.current)
    const at = all.indexOf(document.activeElement as HTMLElement)
    let next: number | null = null
    if (e.key === 'ArrowDown') next = (at + 1) % all.length
    else if (e.key === 'ArrowUp') next = (at - 1 + all.length) % all.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = all.length - 1
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      close(true)
      return
    } else if (e.key === 'Tab') {
      close(false)
      return
    }
    if (next === null) return
    e.preventDefault()
    all[next]?.focus()
  }

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t('menu.open')}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-11 items-center justify-center rounded text-ink-strong hover:bg-black/5"
      >
        <Icon svg={menuIcon} className="size-6" />
      </button>
      {open && (
        <ul
          ref={list}
          id={menuId}
          role="menu"
          aria-label={t('menu.open')}
          onKeyDown={onKeyDown}
          className="absolute end-0 top-full z-[1300] mt-1 w-max max-w-[calc(100vw-1rem)] min-w-48 rounded border border-line bg-surface py-1 shadow-md"
        >
          <li role="none">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={ITEM}
              onClick={() => {
                close(true)
                onAbout()
              }}
            >
              {t('menu.about')}
            </button>
          </li>
          <li role="none">
            <Link to="/survey" role="menuitem" tabIndex={-1} className={ITEM} onClick={() => close(false)}>
              {t('menu.surveyors')}
            </Link>
          </li>
          {onInstall && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={ITEM}
                onClick={() => {
                  close(true)
                  onInstall()
                }}
              >
                {t('menu.install')}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
