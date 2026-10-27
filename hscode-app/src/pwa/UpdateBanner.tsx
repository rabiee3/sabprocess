import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banner } from '../ui/Banner'
import { usePwa } from './usePwa'
import { useSignOut } from '../auth/useSignOut'

/**
 * "Update available" after a new deploy. Never reloads by itself, so a session in progress (a survey,
 * a search) is never interrupted: Reload activates the waiting service worker and then reloads.
 * Disabled while a sign-out runs: a reload in the middle of it would skip the cache wipe.
 * Positioned by FloatingBanners.
 */
export function UpdateBanner() {
  const { t } = useTranslation()
  const { needRefresh, update } = usePwa()
  const { busy } = useSignOut()
  const [dismissed, setDismissed] = useState(false)
  if (!needRefresh || dismissed) return null
  return (
    <div>
      <Banner tone="info" title={t('pwa.updateTitle')} onClose={() => setDismissed(true)}>
        <button
          type="button"
          onClick={update}
          disabled={busy}
          aria-busy={busy || undefined}
          className="mt-2 inline-flex min-h-touch items-center justify-center rounded bg-blue-800 px-4 font-semibold text-white disabled:opacity-60"
        >
          {t('pwa.reload')}
        </button>
      </Banner>
    </div>
  )
}
