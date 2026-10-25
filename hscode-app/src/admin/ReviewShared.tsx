import { useTranslation } from 'react-i18next'
import { Banner } from '../ui/Banner'
import type { Factory } from '../lib/types'
import type { ContactDraft, PhotoData } from '../survey/types'
import { factoryFlags } from './flags'
import type { ActionError } from './classify'
import { ContactBlock, PhotoStrip } from './ReviewParts'

export function ReloadButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onClick} className="min-h-touch font-semibold underline">
      {t('common.reload')}
    </button>
  )
}

/** The danger banner for a failed admin action; a stale edit also offers Reload. */
export function ActionErrorBanner({ error, onReload }: { error: ActionError; onReload: () => void }) {
  const { t } = useTranslation()
  const key =
    error === 'stale' ? 'admin.review.stale' : error === 'indexFull' ? 'errors.indexFull' : error === 'offline' ? 'errors.offline' : 'errors.generic'
  return (
    <Banner tone="danger">
      {t(key)}
      {error === 'stale' && (
        <>
          {' '}
          <ReloadButton onClick={onReload} />
        </>
      )}
    </Banner>
  )
}

/** Loading / not found / failed placeholders shared by the review and factory detail pages. */
export function LoadStatus({ kind, onReload }: { kind: 'loading' | 'missing' | 'failed'; onReload: () => void }) {
  const { t } = useTranslation()
  if (kind === 'loading') return <p role="status" className="text-ink-subtle">{t('admin.review.loading')}</p>
  if (kind === 'missing') return <Banner tone="danger">{t('admin.review.notFound')}</Banner>
  return (
    <Banner tone="danger">
      {t('admin.loadError')} <ReloadButton onClick={onReload} />
    </Banner>
  )
}

/** The read-only photo strip and contact block under the edit form. */
export function PhotosAndContact({ photos, contact }: { photos: PhotoData[]; contact: ContactDraft }) {
  const { t } = useTranslation()
  return (
    <>
      <section>
        <h3 className="mb-2 text-title font-semibold text-ink-strong">{t('admin.review.photos')}</h3>
        <PhotoStrip photos={photos} />
      </section>
      <section>
        <h3 className="mb-2 text-title font-semibold text-ink-strong">{t('admin.review.contact')}</h3>
        <ContactBlock contact={contact} />
      </section>
    </>
  )
}

/** Location-quality warnings (low accuracy, placed by hand, pin never moved). */
export function FlagBanners({ factory }: { factory: Factory }) {
  const { t } = useTranslation()
  return (
    <>
      {factoryFlags(factory).map((flag) => (
        <Banner key={flag} tone="warning" title={t('admin.review.warn.title')}>
          {t(`admin.review.warn.${flag}`, { m: Math.round(factory.location.accuracyM ?? 0) })}
        </Banner>
      ))}
    </>
  )
}
