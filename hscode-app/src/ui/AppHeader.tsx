import { useTranslation } from 'react-i18next'
import { signOutUser } from '../auth/api'
import { useGoogleSignIn } from '../auth/useGoogleSignIn'
import { GoogleButton } from './GoogleButton'
import { Banner } from './Banner'
import { useAuth, type Role } from '../auth/useAuth'
import { LangToggle } from './LangToggle'
import { Link } from 'react-router'
import { Logo } from './Logo'
import { PortalBrand } from './PortalBrand'

const BTN = 'min-h-touch rounded border border-line bg-surface px-3 text-sm font-semibold whitespace-nowrap text-ink-strong'

/** `areaLabel` picks the portal brand (surveyor or admin); any other value gets a plain logo link to the client map. */
export function AppHeader({ areaLabel }: { areaLabel?: Role }) {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const { signIn, failed, clearError } = useGoogleSignIn()
  return (
    <>
    <header className="flex h-14 items-center gap-2 border-b border-line bg-surface ps-3 pe-3">
      {areaLabel === 'surveyor' || areaLabel === 'admin' ? (
        <PortalBrand portal={areaLabel} />
      ) : (
        <Link to="/" aria-label={t('nav.backToMap')} className="inline-flex min-h-touch items-center rounded">
          <Logo />
        </Link>
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
      <div className="fixed inset-x-2 top-14 z-[1300] lg:end-2 lg:start-auto lg:w-96">
        <Banner tone="danger" onClose={clearError}>{t('errors.generic')}</Banner>
      </div>
    )}
    </>
  )
}
