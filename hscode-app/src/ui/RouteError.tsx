import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useRouteError } from 'react-router'
import { reportError } from '../telemetry/reportError'
import { usePwa } from '../pwa/usePwa'
import { reloadFresh } from '../pwa/reloadFresh'

/**
 * Route-level error boundary: render errors and failed dynamic imports (a stale chunk after a deploy).
 * Reload must not reload the same stale shell: while an old service worker controls the page, a plain reload is
 * answered from its precached index.html. reloadFresh activates a waiting worker first (then reloads), and
 * falls back to a plain reload when there is no service worker or nothing new.
 */
export function RouteError() {
  const { t } = useTranslation()
  const error = useRouteError()
  const { needRefresh, update } = usePwa()
  // Logged to Analytics (no personal data; never in the emulator).
  useEffect(() => reportError(error, 'route'), [error])
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-start justify-center gap-4 bg-surface px-4 text-ink">
      <h1 className="text-xl font-bold text-ink-strong">{t('errors.crashTitle')}</h1>
      <button
        type="button"
        onClick={() => void reloadFresh({ needRefresh, update })}
        className="inline-flex min-h-touch items-center justify-center rounded bg-brand-500 px-4 text-sm font-semibold text-ink-strong"
      >
        {t('errors.reload')}
      </button>
    </main>
  )
}
