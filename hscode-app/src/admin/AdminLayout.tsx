import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router'
import { collection, getCountFromServer, query, where } from 'firebase/firestore'
import { signOutUser } from '../auth/api'
import { useAuth } from '../auth/useAuth'
import { db } from '../firebase'
import { LangToggle } from '../ui/LangToggle'
import { Logo } from '../ui/Logo'

const NAV = [
  { key: 'review', badge: true },
  { key: 'factories', badge: false },
  { key: 'invites', badge: false },
  { key: 'surveyors', badge: false },
  { key: 'dashboard', badge: false },
] as const

/** Pending submissions count; refreshed on mount and window focus. `null` (badge hidden) on error. */
function usePendingCount(): number | null {
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
  return count
}

export function AdminLayout() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const pending = usePendingCount()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const segment = pathname.split('/').filter(Boolean)[1] ?? 'review'
  const title = t(`admin.nav.${NAV.some((n) => n.key === segment) ? segment : 'review'}`)

  const email = user?.email ?? ''
  return (
    <div className="min-h-dvh bg-surface-alt text-ink">
      {open && (
        <div aria-hidden="true" className="fixed inset-0 z-30 bg-ink-strong/40 lg:hidden" onClick={() => setOpen(false)} />
      )}
      <aside
        className={`fixed inset-block-0 inset-inline-start-0 z-40 flex w-64 flex-col border-e border-line bg-surface transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full lg:ltr:translate-x-0 lg:rtl:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-2 p-4">
          <Logo />
          <span className="text-xs text-ink-subtle">{t('admin.title')}</span>
        </div>
        <nav aria-label={t('admin.navLabel')} className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map(({ key, badge }) => (
            <NavLink
              key={key}
              to={`/admin/${key}`}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex min-h-touch items-center justify-between rounded px-3 text-body font-semibold ${
                  isActive ? 'bg-brand-50 text-brand-900' : 'text-ink-strong'
                }`
              }
            >
              {t(`admin.nav.${key}`)}
              {badge && pending !== null && pending > 0 && (
                <span
                  aria-label={t('admin.pending', { count: pending })}
                  className="rounded-full bg-brand-500 px-2 text-xs font-semibold text-ink-strong"
                >
                  {pending}
                </span>
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
            onClick={() => void signOutUser()}
            className="min-h-touch rounded border border-line bg-surface px-3 text-sm font-semibold text-ink-strong"
          >
            {t('nav.signOut')}
          </button>
        </div>
      </aside>
      <div className="lg:ps-64">
        <header className="flex h-16 items-center gap-3 border-b border-line bg-surface ps-4 pe-4">
          <button
            type="button"
            aria-expanded={open}
            aria-label={t('admin.menu')}
            onClick={() => setOpen((o) => !o)}
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
  )
}
