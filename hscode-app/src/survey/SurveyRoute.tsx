import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, Route, Routes } from 'react-router'
import { useGoogleSignIn } from '../auth/useGoogleSignIn'
import { GoogleButton } from '../ui/GoogleButton'
import { Banner } from '../ui/Banner'
import { useAuth } from '../auth/useAuth'
import { loadHsTable } from '../hs/lazyTable'
import { whenIdle } from '../lib/idle'
import splashPattern from '../assets/patterns/splash-pattern.svg'
import { Placeholder } from '../routes/Placeholder'
import { AppHeader } from '../ui/AppHeader'
import { PortalBrand } from '../ui/PortalBrand'
import { InviteCodeScreen } from './InviteCodeScreen'
import { FactoryStepper } from './FactoryStepper'
import { ALLOW_EDIT } from './features'
import { MySubmissions } from './MySubmissions'

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader areaLabel="surveyor" />
      {children}
    </>
  )
}

function SignInPanel() {
  const { t } = useTranslation()
  const { signIn, failed, clearError } = useGoogleSignIn()
  return (
    <main
      className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-5 bg-ink-strong p-6 text-center"
      style={{ backgroundImage: `url(${splashPattern})` }}
    >
      <span className="rounded bg-surface p-2">
        <PortalBrand portal="surveyor" />
      </span>
      <h1 className="text-display font-semibold text-surface">{t('survey.gate.signInTitle')}</h1>
      <p className="max-w-sm text-body text-line">{t('survey.gate.signInBody')}</p>
      {failed && (
        <div className="w-full max-w-sm text-start">
          <Banner tone="danger" onClose={clearError}>{t('errors.generic')}</Banner>
        </div>
      )}
      <div className="w-full max-w-sm">
        <GoogleButton onClick={signIn} label={t('auth.continueWithGoogle')} />
      </div>
    </main>
  )
}

export function Component() {
  // Warm the HS table chunk once the page is idle: the service worker caches it, so the HS picker still works
  // when the surveyor is offline in the field later (spec §8). The client map never does this.
  useEffect(() => whenIdle(() => void loadHsTable().catch(() => {})), [])
  const { t } = useTranslation()
  const { role, active, loading } = useAuth()

  if (loading) {
    return (
      <Shell>
        <main className="flex justify-center p-8">
          <h1 className="sr-only">{t('common.loading')}</h1>
          <div
            role="status"
            aria-label={t('common.loading')}
            className="size-8 animate-spin rounded-full border-4 border-line border-t-brand-600"
          />
        </main>
      </Shell>
    )
  }
  if (role === 'visitor') {
    return (
      <Shell>
        <SignInPanel />
      </Shell>
    )
  }
  if (role === 'client') {
    return (
      <Shell>
        <InviteCodeScreen />
      </Shell>
    )
  }
  if (role === 'admin') {
    return (
      <Shell>
        <main className="p-4">
          <h1 className="sr-only">{t('nav.surveyors')}</h1>
          <p className="text-body text-ink-subtle">{t('survey.gate.adminNote')}</p>
          <Link to="/admin" className="mt-3 inline-flex min-h-touch items-center font-semibold text-blue-800 underline">
            {t('nav.admin')}
          </Link>
        </main>
      </Shell>
    )
  }
  if (!active) {
    return (
      <Shell>
        <main className="mx-auto max-w-md p-4">
          <h1 className="text-title font-semibold text-ink-strong">{t('survey.gate.offTitle')}</h1>
          <p className="mt-2 text-body text-ink-subtle">{t('survey.gate.offBody')}</p>
        </main>
      </Shell>
    )
  }
  const area = <Placeholder titleKey="nav.surveyors" areaLabel="surveyor" />
  return (
    <Routes>
      <Route index element={<MySubmissions />} />
      <Route path="new" element={<FactoryStepper mode="new" />} />
      <Route path="edit/:fid" element={ALLOW_EDIT ? <FactoryStepper mode="edit" /> : <Navigate to="/survey" replace />} />
      <Route path="*" element={area} />
    </Routes>
  )
}
