import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banner } from '../ui/Banner'
import { usePwa } from './usePwa'

/**
 * "Update available" after a new deploy. Never reloads by itself, so a session in progress (a survey,
 * a search) is never interrupted: Reload activates the waiting service worker and then reloads.
 */
export function UpdateBanner() {
  const { t } = useTranslation()
  const { needRefresh, update } = usePwa()
  const [dismissed, setDismissed] = useState(false)
  if (!needRefresh || dismissed) return null
  return (
    // Top, under the header, like the other floating banners: never over the surveyor Add button.
    <div className="fixed inset-x-2 top-14 z-[1300] lg:end-2 lg:start-auto lg:w-96">
      <Banner tone="info" title={t('pwa.updateTitle')} onClose={() => setDismissed(true)}>
        <button
          type="button"
          onClick={update}
          className="mt-2 inline-flex min-h-touch items-center justify-center rounded bg-blue-800 px-4 font-semibold text-white"
        >
          {t('pwa.reload')}
        </button>
      </Banner>
    </div>
  )
}
