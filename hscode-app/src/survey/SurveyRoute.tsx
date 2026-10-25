import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Route, Routes } from 'react-router'
import { signInWithGoogle } from '../auth/api'
import { useAuth } from '../auth/useAuth'
import splashPattern from '../assets/patterns/splash-pattern.svg'
import { Placeholder } from '../routes/Placeholder'
import { AppHeader } from '../ui/AppHeader'
import { Logo } from '../ui/Logo'
import { InviteCodeScreen } from './InviteCodeScreen'

function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  )
}

function SignInPanel() {
  const { t } = useTranslation()
  return (
    <main
      className="flex min-h-[calc(100dvh-3.5rem)] flex-col items-center justify-center gap-5 bg-ink-strong p-6 text-center"
      style={{ backgroundImage: `url(${splashPattern})` }}
    >
      <span className="rounded bg-surface p-2">
        <Logo />
      </span>
      <h1 className="text-display font-semibold text-surface">{t('survey.gate.signInTitle')}</h1>
      <p className="max-w-sm text-body text-line">{t('survey.gate.signInBody')}</p>
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        className="min-h-cta w-full max-w-sm rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong"
      >
        {t('survey.gate.continueGoogle')}
      </button>
    </main>
  )
}

export function Component() {
  const { t } = useTranslation()
  const { role, active, loading } = useAuth()

  if (loading) {
    return (
      <Shell>
        <main className="flex justify-center p-8">
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
  // Tasks 8/9 replace these placeholders with MySubmissions and FactoryStepper.
  const area = <Placeholder titleKey="nav.surveyors" areaLabel="surveyor" />
  return (
    <Routes>
      <Route index element={area} />
      <Route path="new" element={area} />
      <Route path="edit/:fid" element={area} />
      <Route path="*" element={area} />
    </Routes>
  )
}
