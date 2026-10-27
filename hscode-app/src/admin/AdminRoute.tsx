import { useTranslation } from 'react-i18next'
import { Link, Navigate, Route, Routes } from 'react-router'
import { useSignOut } from '../auth/useSignOut'
import { useAuth } from '../auth/useAuth'
import { AdminCreateFactory } from './AdminCreateFactory'
import { AdminLayout } from './AdminLayout'
import { AdminSignIn } from './AdminSignIn'
import { Dashboard } from './Dashboard'
import { FactoriesPage } from './FactoriesPage'
import { FactoryAdminPage } from './FactoryAdminDetail'
import { InvitesPage } from './InvitesPage'
import { ReviewQueue } from './ReviewQueue'
import { SurveyorsPage } from './SurveyorsPage'

function NotAdmin() {
  const { t } = useTranslation()
  const { signOut, busy } = useSignOut()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-alt p-6 text-center">
      <h1 className="text-xl font-semibold text-ink-strong">{t('admin.notAdmin.title')}</h1>
      <p className="max-w-sm text-body text-ink">{t('admin.notAdmin.body')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => void signOut()}
          className="min-h-cta rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong disabled:opacity-60"
        >
          {t(busy ? 'nav.signingOut' : 'nav.signOut')}
        </button>
        <Link
          to="/survey"
          className="flex min-h-cta items-center rounded border border-line bg-surface px-4 text-body font-semibold text-ink-strong"
        >
          {t('admin.notAdmin.survey')}
        </Link>
      </div>
    </main>
  )
}

// The kept-data note (nav.signOutKeptData) is drawn by FloatingBanners, outside the router, so it outlives the
// admin layout, which unmounts as soon as the user signs out.
export function Component() {
  return <AdminScreens />
}

function AdminScreens() {
  const { t } = useTranslation()
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <h1 className="sr-only">{t('common.loading')}</h1>
        <div
          role="status"
          aria-label={t('common.loading')}
          className="size-8 animate-spin rounded-full border-4 border-line border-t-brand-600"
        />
      </main>
    )
  }
  if (!user) return <AdminSignIn />
  if (role !== 'admin') return <NotAdmin />

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Navigate to="review" replace />} />
        <Route path="review/:fid?" element={<ReviewQueue />} />
        <Route path="factories" element={<FactoriesPage />} />
        <Route path="factories/new" element={<AdminCreateFactory />} />
        <Route path="factories/:fid" element={<FactoryAdminPage />} />
        <Route path="invites" element={<InvitesPage />} />
        <Route path="surveyors" element={<SurveyorsPage />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
