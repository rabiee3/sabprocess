import { useTranslation } from 'react-i18next'
import { useSignOut } from '../auth/useSignOut'
import { useGoogleSignIn } from '../auth/useGoogleSignIn'
import { GoogleButton } from './GoogleButton'
import { Banner } from './Banner'
import { SignOutKeptBanner } from './SignOutKeptBanner'
import { useAuth, type Role } from '../auth/useAuth'
import { LangToggle } from './LangToggle'
import { Link } from 'react-router'
import { Logo } from './Logo'
import { PortalBrand } from './PortalBrand'
import { Icon } from './Icon'
import logoutIcon from '../assets/icons/logout.svg?raw'

const BTN = 'min-h-touch rounded border border-line bg-surface px-3 text-sm font-semibold whitespace-nowrap text-ink-strong'

/** `areaLabel` picks the portal brand (surveyor or admin); any other value gets a plain logo link to the client map. */
export function AppHeader({ areaLabel }: { areaLabel?: Role }) {
  const { t } = useTranslation()
  const { user, loading } = useAuth()
  const { signIn, failed, clearError } = useGoogleSignIn()
  const { signOut, busy } = useSignOut()
  return (
    <>
    <header className="flex h-14 items-center gap-2 border-b border-line bg-surface ps-3 pe-3">
      {areaLabel === 'surveyor' || areaLabel === 'admin' ? (
        <PortalBrand portal={areaLabel} />
      ) : (
        <Link to="/" title={t('nav.backToMap')} className="inline-flex min-h-touch items-center rounded">
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
              {/* Below 640px only the icon, so logo · tag · LangToggle · Sign out fit a 360px phone in Arabic. */}
              <button
                type="button"
                className={`${BTN} inline-flex min-w-11 items-center justify-center disabled:opacity-60`}
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={() => void signOut()}
              >
                <Icon svg={logoutIcon} className="size-5 sm:hidden rtl:-scale-x-100" />
                <span className="max-sm:sr-only">{t(busy ? 'nav.signingOut' : 'nav.signOut')}</span>
              </button>
            </>
          ) : (
            <GoogleButton compact iconOnlyOnPhone onClick={signIn} label={t('nav.signIn')} />
          ))}
      </div>
    </header>
    {failed && (
      <div className="fixed inset-x-2 top-14 z-[1300] lg:end-2 lg:start-auto lg:w-96">
        <Banner tone="danger" onClose={clearError}>{t('errors.generic')}</Banner>
      </div>
    )}
    <SignOutKeptBanner />
    </>
  )
}
