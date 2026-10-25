import { useTranslation } from 'react-i18next'
import { signInWithGoogle, signOutUser } from '../auth/api'
import { useAuth, type Role } from '../auth/useAuth'
import { LangToggle } from './LangToggle'
import { Logo } from './Logo'

const BTN = 'min-h-touch rounded border border-line bg-surface px-3 text-sm font-semibold text-ink-strong'

export function AppHeader({ role }: { role?: Role }) {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  return (
    <header className="flex h-14 items-center gap-2 border-b border-line bg-surface ps-3 pe-3">
      <Logo />
      {role && role !== 'visitor' && (
        <span className="rounded bg-surface-alt px-2 py-1 text-xs font-semibold text-ink">{t(`role.${role}`)}</span>
      )}
      <div className="ms-auto flex items-center gap-2">
        <LangToggle />
        {!loading &&
          (user ? (
            <>
              <span className="hidden max-w-32 truncate text-sm text-ink sm:inline">
                {user.displayName ?? user.email}
              </span>
              <button type="button" className={BTN} onClick={() => void signOutUser()}>
                {t('nav.signOut')}
              </button>
            </>
          ) : (
            <button type="button" className={BTN} onClick={() => void signInWithGoogle()}>
              {t('nav.signIn')}
            </button>
          ))}
      </div>
    </header>
  )
}
