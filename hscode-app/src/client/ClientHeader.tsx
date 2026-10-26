import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { signOutUser } from '../auth/api'
import { useGoogleSignIn } from '../auth/useGoogleSignIn'
import { GoogleButton } from '../ui/GoogleButton'
import { LangToggle } from '../ui/LangToggle'
import { Logo } from '../ui/Logo'
import { Bdi } from '../ui/Bdi'
import { Banner } from '../ui/Banner'
import { ClientMenu } from '../ui/ClientMenu'
import { ABOUT_STATE } from './intro/useIntro'

const btn = 'inline-flex min-h-touch items-center justify-center px-2 text-sm font-semibold text-ink-strong'

/**
 * Logo · LangToggle · sign-in or user + Sign out · ☰. `onAbout` reopens the intro in place (the map);
 * pages without the intro leave it unset and About goes to the map, which opens it.
 */
export function ClientHeader({ onAbout }: { onAbout?: () => void } = {}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
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
          <GoogleButton compact iconOnlyOnPhone onClick={signIn} label={t('nav.signIn')} />
        )}
        <ClientMenu onAbout={onAbout ?? (() => void navigate('/', { state: ABOUT_STATE }))} />
      </div>
    </header>
    {failed && (
      <div className="fixed inset-x-2 top-14 z-[1300] lg:end-2 lg:start-auto lg:w-96">
        <Banner tone="danger" onClose={() => clearError()}>{t('errors.generic')}</Banner>
      </div>
    )}
    </>
  )
}
