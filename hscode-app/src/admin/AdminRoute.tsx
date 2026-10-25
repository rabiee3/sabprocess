import { useTranslation } from 'react-i18next'
import { Link, Navigate, Route, Routes } from 'react-router'
import { signOutUser } from '../auth/api'
import { useAuth } from '../auth/useAuth'
import { AdminLayout } from './AdminLayout'
import { AdminSignIn } from './AdminSignIn'
import { InvitesPage } from './InvitesPage'
import { SurveyorsPage } from './SurveyorsPage'

/** Stands in until the page's own task lands. The layout supplies the h1. */
function PagePlaceholder() {
  const { t } = useTranslation()
  return <p className="text-ink-subtle">{t('common.comingSoon')}</p>
}

function NotAdmin() {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface-alt p-6 text-center">
      <h1 className="text-xl font-semibold text-ink-strong">{t('admin.notAdmin.title')}</h1>
      <p className="max-w-sm text-body text-ink">{t('admin.notAdmin.body')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="min-h-cta rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong"
        >
          {t('nav.signOut')}
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

export function Component() {
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
        <Route path="review" element={<PagePlaceholder />} />
        <Route path="review/:fid" element={<PagePlaceholder />} />
        <Route path="factories" element={<PagePlaceholder />} />
        <Route path="factories/new" element={<PagePlaceholder />} />
        <Route path="factories/:fid" element={<PagePlaceholder />} />
        <Route path="invites" element={<InvitesPage />} />
        <Route path="surveyors" element={<SurveyorsPage />} />
        <Route path="dashboard" element={<PagePlaceholder />} />
      </Route>
    </Routes>
  )
}
