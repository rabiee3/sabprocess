import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { signOutUser } from '../auth/api'
import { useGoogleSignIn } from '../auth/useGoogleSignIn'
import { GoogleButton } from '../ui/GoogleButton'
import { LangToggle } from '../ui/LangToggle'
import { Logo } from '../ui/Logo'
import { Bdi } from '../ui/Bdi'
import { Banner } from '../ui/Banner'

const btn = 'inline-flex min-h-touch items-center justify-center px-2 text-sm font-semibold text-ink-strong'

export function ClientHeader() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { signIn, failed, clearError } = useGoogleSignIn()
  return (
    <>
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
          <GoogleButton compact onClick={signIn} label={t('nav.signIn')} />
        )}
      </div>
    </header>
    {failed && (
      <div className="absolute inset-x-2 top-14 z-[1300] lg:end-2 lg:start-auto lg:w-96">
        <Banner tone="danger" onClose={() => clearError()}>{t('errors.generic')}</Banner>
      </div>
    )}
    </>
  )
}
