import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { signInWithGoogle, signOutUser } from '../auth/api'
import { LangToggle } from '../ui/LangToggle'
import { Logo } from '../ui/Logo'
import { Bdi } from '../ui/Bdi'

const btn = 'inline-flex min-h-touch items-center justify-center px-2 text-sm font-semibold text-ink-strong'

export function ClientHeader() {
  const { t } = useTranslation()
  const { user } = useAuth()
  return (
    <header className="z-[1200] flex shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
      <Link to="/" className="inline-flex min-h-touch items-center">
        <Logo className="h-8 w-auto" />
      </Link>
      <div className="ms-auto flex items-center gap-2">
        <LangToggle />
        {user ? (
          <>
            <span className="hidden max-w-32 truncate text-sm sm:inline">
              <Bdi>{user.displayName || user.email}</Bdi>
            </span>
            <button type="button" className={btn} onClick={() => void signOutUser()}>
              {t('nav.signOut')}
            </button>
          </>
        ) : (
          <button type="button" className={btn} onClick={() => void signInWithGoogle().catch(() => {})}>
            {t('nav.signIn')}
          </button>
        )}
      </div>
    </header>
  )
}
