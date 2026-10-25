import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeDigits } from '../survey/draft'
import type { ContactDraft, PhotoData } from '../survey/types'
import { BottomSheet } from '../ui/BottomSheet'
import { FieldError } from '../survey/steps/shared'
import { isSafeImage } from './safeImage'
import { safeUrl, whatsappHref } from './contactLinks'

export function PhotoStrip({ photos }: { photos: PhotoData[] }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<number | null>(null)
  if (photos.length === 0) return <p className="text-body-sm text-ink-subtle">{t('admin.review.noPhotos')}</p>
  return (
    <>
      <ul className="flex gap-3 overflow-x-auto">
        {photos.map((p, i) => (
          <li key={p.id} className="shrink-0">
            <button
              type="button"
              aria-label={t('admin.review.photoOpen', { n: i + 1 })}
              disabled={!isSafeImage(p.data)}
              onClick={() => setOpen(i)}
              className="block min-h-touch overflow-hidden rounded border border-line"
            >
              {isSafeImage(p.data) ? (
                <img src={p.data} alt="" loading="lazy" className="size-24 object-cover" />
              ) : (
                <span aria-hidden="true" className="block size-24 bg-surface-alt" />
              )}
            </button>
          </li>
        ))}
      </ul>
      <BottomSheet open={open !== null} title={t('admin.review.photos')} onClose={() => setOpen(null)}>
        {open !== null && isSafeImage(photos[open]?.data) && (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
            <img src={photos[open].data} alt={t('admin.review.photoAlt', { n: open + 1 })} className="max-h-full max-w-full" />
          </div>
        )}
      </BottomSheet>
    </>
  )
}

const LINK = 'font-semibold text-blue-800 underline'

export function ContactBlock({ contact }: { contact: ContactDraft }) {
  const { t } = useTranslation()
  const phone = contact.phone?.trim()
  const whatsapp = (contact.whatsappSameAsPhone ? contact.phone : contact.whatsapp)?.trim()
  const website = contact.website?.trim()
  const facebook = contact.facebook?.trim()
  const person = contact.contactPerson?.trim()
  const wa = whatsapp ? whatsappHref(whatsapp) : null
  const web = website ? safeUrl(website) : null
  const fb = facebook ? safeUrl(facebook) : null
  const rows: { label: string; value: React.ReactNode }[] = []
  if (phone)
    rows.push({
      label: t('admin.review.phone'),
      value: (
        <a dir="ltr" href={`tel:${normalizeDigits(phone)}`} className={`font-mono ${LINK}`}>
          {phone}
        </a>
      ),
    })
  if (whatsapp)
    rows.push({
      label: t('admin.review.whatsapp'),
      value: wa ? (
        <a dir="ltr" href={wa} target="_blank" rel="noopener noreferrer" className={`font-mono ${LINK}`}>
          {whatsapp}
        </a>
      ) : (
        <span dir="ltr" className="font-mono">{whatsapp}</span>
      ),
    })
  if (website)
    rows.push({
      label: t('admin.review.website'),
      value: web ? (
        <a dir="ltr" href={web} target="_blank" rel="noopener noreferrer" className={LINK}>
          {website}
        </a>
      ) : (
        <span dir="ltr">{website}</span>
      ),
    })
  if (facebook)
    rows.push({
      label: t('admin.review.facebook'),
      value: fb ? (
        <a dir="ltr" href={fb} target="_blank" rel="noopener noreferrer" className={LINK}>
          {facebook}
        </a>
      ) : (
        <span dir="ltr">{facebook}</span>
      ),
    })
  if (person) rows.push({ label: t('admin.review.person'), value: <bdi>{person}</bdi> })
  if (rows.length === 0) return <p className="text-body-sm text-ink-subtle">{t('admin.review.noContact')}</p>
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-body-sm">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-ink-subtle">{r.label}</dt>
          <dd className="min-w-0 break-words text-ink-strong">{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const REASON_MAX = 500

function RejectForm({ busy, onCancel, onConfirm }: { busy: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const empty = reason.trim() === ''
  function submit() {
    setTried(true)
    if (!empty) onConfirm(reason.trim())
  }
  return (
    <div className="flex flex-col gap-3 p-4">
      <label className="block">
        <span className="mb-1 block text-label font-semibold text-ink">{t('admin.review.reasonLabel')}</span>
        <span className="mb-2 block text-body-sm text-ink-subtle">{t('admin.review.rejectHint')}</span>
        <textarea
          rows={4}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded border border-line-strong bg-surface p-3 text-body text-ink-strong"
        />
      </label>
      {tried && empty && <FieldError>{t('admin.review.reasonRequired')}</FieldError>}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="min-h-cta rounded bg-red-600 px-4 text-body font-semibold text-white disabled:opacity-60"
        >
          {busy ? t('admin.review.rejecting') : t('admin.review.confirmReject')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-cta rounded border border-line bg-surface px-4 text-body font-semibold text-ink-strong"
        >
          {t('admin.review.cancel')}
        </button>
      </div>
    </div>
  )
}

export function RejectSheet({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const { t } = useTranslation()
  return (
    <BottomSheet open={open} title={t('admin.review.rejectTitle')} onClose={onClose}>
      <RejectForm busy={busy} onCancel={onClose} onConfirm={onConfirm} />
    </BottomSheet>
  )
}
