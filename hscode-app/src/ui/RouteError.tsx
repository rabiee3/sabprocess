import { useTranslation } from 'react-i18next'

/**
 * Route-level error boundary: render errors and failed dynamic imports (a stale chunk after a deploy).
 * Reload is always a full page load, which fetches the fresh index.html and its current chunks.
 */
export function RouteError() {
  const { t } = useTranslation()
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-start justify-center gap-4 bg-surface px-4 text-ink">
      <h1 className="text-xl font-bold text-ink-strong">{t('errors.crashTitle')}</h1>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-touch items-center justify-center rounded bg-brand-500 px-4 text-sm font-semibold text-ink-strong"
      >
        {t('errors.reload')}
      </button>
    </main>
  )
}
