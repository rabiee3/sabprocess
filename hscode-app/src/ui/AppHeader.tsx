import { useTranslation } from 'react-i18next'
import { signOutUser } from '../auth/api'
import { useGoogleSignIn } from '../auth/useGoogleSignIn'
import { GoogleButton } from './GoogleButton'
import { Banner } from './Banner'
import { useAuth, type Role } from '../auth/useAuth'
import { LangToggle } from './LangToggle'
import { Logo } from './Logo'

const BTN = 'min-h-touch rounded border border-line bg-surface px-3 text-sm font-semibold whitespace-nowrap text-ink-strong'

/** `areaLabel` is the section badge (which area of the app this is), not the signed-in user's role. */
export function AppHeader({ areaLabel }: { areaLabel?: Role }) {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const { signIn, failed, clearError } = useGoogleSignIn()
  return (
    <>
    <header className="flex h-14 items-center gap-2 border-b border-line bg-surface ps-3 pe-3">
      <Logo />
      {areaLabel && areaLabel !== 'visitor' && (
        <span className="hidden rounded bg-surface-alt px-2 min-[420px]:inline py-1 text-xs font-semibold text-ink">{t(`role.${areaLabel}`)}</span>
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
            <GoogleButton compact onClick={signIn} label={t('nav.signIn')} />
          ))}
      </div>
    </header>
    {failed && (
      <div className="absolute inset-x-2 top-14 z-[1300] lg:end-2 lg:start-auto lg:w-96">
        <Banner tone="danger" onClose={clearError}>{t('errors.generic')}</Banner>
      </div>
    )}
    </>
  )
}
