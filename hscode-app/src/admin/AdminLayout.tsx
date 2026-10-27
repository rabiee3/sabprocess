import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import { useSignOut } from '../auth/useSignOut'
import { useAuth } from '../auth/useAuth'
import { db } from '../firebase'
import { LangToggle } from '../ui/LangToggle'
import { PortalBrand } from '../ui/PortalBrand'
import { AdminContext } from './AdminContext'
import { useIsDesktop } from './useIsDesktop'

const NAV = [
  { key: 'review', badge: true },
  { key: 'factories', badge: false },
  { key: 'invites', badge: false },
  { key: 'surveyors', badge: false },
  { key: 'dashboard', badge: false },
] as const

/** Pending submissions count; refreshed on mount and window focus. `null` (badge hidden) on error. */
function usePendingCount() {
  const [count, setCount] = useState<number | null>(null)
  const refresh = useCallback(() => {
    getCountFromServer(query(collection(db, 'factories'), where('status', '==', 'pending')))
      .then((s) => setCount(s.data().count))
      .catch(() => setCount(null))
  }, [])
  useEffect(() => {
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [refresh])
  return { pending: count, refreshPending: refresh }
}

export function AdminLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { signOut, busy } = useSignOut()
  const admin = usePendingCount()
  const { pending } = admin
  const isDesktop = useIsDesktop()
  const { pathname } = useLocation()
  // The drawer is open only on the path it was opened at, so any navigation (incl. Back) closes it.
  const [openAt, setOpenAt] = useState<string | null>(null)
  const [seenPath, setSeenPath] = useState(pathname)
  if (seenPath !== pathname) {
    // Any navigation clears the open state, so Back to the path it was opened at cannot reopen it.
    setSeenPath(pathname)
    setOpenAt(null)
  }
  const open = openAt === pathname
  const setOpen = (o: boolean) => setOpenAt(o ? pathname : null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    navRef.current?.querySelector<HTMLElement>('a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpenAt(null)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const segment = pathname.split('/').filter(Boolean)[1] ?? 'review'
  const title = t(`admin.nav.${NAV.some((n) => n.key === segment) ? segment : 'review'}`)

  const email = user?.email ?? ''
  return (
    <AdminContext.Provider value={admin}>
    <div className="min-h-dvh bg-surface-alt text-ink">
      {open && (
        <div aria-hidden="true" className="fixed inset-0 z-30 bg-ink-strong/40 lg:hidden" onClick={() => setOpen(false)} />
      )}
      <aside
        inert={!isDesktop && !open}
        className={`fixed inset-y-0 start-0 z-40 flex h-dvh w-64 flex-col border-e border-line bg-surface transition-transform lg:visible lg:translate-x-0 ${
          open ? 'translate-x-0' : 'invisible ltr:-translate-x-full rtl:translate-x-full lg:ltr:translate-x-0 lg:rtl:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2 p-4">
          <PortalBrand portal="admin" />
        </div>
        <nav ref={navRef} aria-label={t('admin.navLabel')} className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map(({ key, badge }) => (
            <NavLink
              key={key}
              to={`/admin/${key}`}
              className={({ isActive }) =>
                `flex min-h-touch items-center justify-between rounded px-3 text-body font-semibold ${
                  isActive ? 'bg-brand-50 text-brand-900' : 'text-ink-strong'
                }`
              }
            >
              {t(`admin.nav.${key}`)}
              {badge && pending !== null && pending > 0 && (
                <>
                  <span aria-hidden="true" className="rounded-full bg-brand-500 px-2 text-xs font-semibold text-ink-strong">
                    {pending}
                  </span>
                  {' '}
                  <span className="sr-only">{t('admin.pending', { count: pending })}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col gap-2 border-t border-line p-4">
          <p className="truncate text-sm text-ink" dir="ltr" title={email}>
            {email}
          </p>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void signOut()}
            className="min-h-touch rounded border border-line bg-surface px-3 text-sm font-semibold text-ink-strong disabled:opacity-60"
          >
            {t(busy ? 'nav.signingOut' : 'nav.signOut')}
          </button>
        </div>
      </aside>
      <div className="lg:ps-64">
        <header className="flex h-16 items-center gap-3 border-b border-line bg-surface ps-4 pe-4">
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-label={t('admin.menu')}
            onClick={() => setOpen(!open)}
            className="flex min-h-touch min-w-11 items-center justify-center rounded border border-line text-xl lg:hidden"
          >
            <span aria-hidden="true">☰</span>
          </button>
          <h1 className="text-xl font-semibold text-ink-strong">{title}</h1>
          <div className="ms-auto">
            <LangToggle />
          </div>
        </header>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    </div>
    </AdminContext.Provider>
  )
}
