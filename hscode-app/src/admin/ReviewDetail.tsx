import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banner } from '../ui/Banner'
import { StatusChip } from '../ui/StatusChip'
import { AdminFactoryForm } from './AdminFactoryForm'
import { approveFactory, rejectFactory } from './repo'
import { RejectSheet } from './ReviewParts'
import { displayName, formatDate, formErrors, toAdminEdit } from './reviewForm'
import { classify, type ActionError } from './classify'
import { ActionErrorBanner, FlagBanners, LoadStatus, PhotosAndContact } from './ReviewShared'
import { useFactoryLoad } from './useFactoryLoad'

export type ReviewOutcome = 'approved' | 'rejected'
export type DoneInfo = { fid: string; outcome: ReviewOutcome; name: string }

type Props = {
  fid: string
  submittedBy?: string
  onDone: (info: DoneInfo) => void
}

export function ReviewDetail({ fid, submittedBy, onDone }: Props) {
  const { t, i18n } = useTranslation()
  const { state, reload: load, setDraft } = useFactoryLoad(fid)
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState<ActionError | null>(null)
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)

  function reload() {
    load()
    setError(null)
    setShowErrors(false)
  }

  if (state.kind !== 'ready') return <LoadStatus kind={state.kind} onReload={reload} />

  const { data, draft } = state
  const { factory } = data
  const lang = i18n.language
  const name = displayName(factory.name, lang, t('survey.list.untitled'))
  const pending = factory.status === 'pending'
  const errors = showErrors ? formErrors(draft) : []

  async function run(kind: 'approve' | 'reject', op: () => Promise<void>, doneName = name) {
    if (busy) return
    setBusy(kind)
    setError(null)
    try {
      await op()
      onDone({ fid, outcome: kind === 'approve' ? 'approved' : 'rejected', name: doneName })
    } catch (e) {
      setBusy(null)
      setRejecting(false)
      setError(classify(e))
    }
  }

  function approve() {
    setShowErrors(true)
    if (formErrors(draft).length > 0) return
    const edit = toAdminEdit(draft)
    // The banner names what was just published (the edited name), not the name as submitted.
    void run('approve', () => approveFactory(fid, data.openedAt, edit), displayName(draft.name, lang, t('survey.list.untitled')))
  }

  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="min-w-0 text-xl font-semibold text-ink-strong">
            <bdi>{name}</bdi>
          </h2>
          {(factory.status === 'pending' || factory.status === 'approved' || factory.status === 'rejected') && (
            <StatusChip status={factory.status} />
          )}
        </div>
        <p className="text-body-sm text-ink-subtle">
          {t('admin.review.submittedBy', {
            name: submittedBy ?? t('admin.review.unknownSurveyor'),
            date: formatDate(factory.createdAt, lang),
          })}
        </p>
      </header>

      {!pending && <Banner tone="info">{t('admin.review.notPending')}</Banner>}
      <FlagBanners factory={factory} />
      {error && <ActionErrorBanner error={error} onReload={reload} />}
      {errors.length > 0 && <Banner tone="danger">{t('admin.review.fixErrors')}</Banner>}

      <AdminFactoryForm value={draft} errors={errors} onChange={(next) => setDraft(data, next)} />
      <PhotosAndContact photos={data.photos} contact={data.contact} />

      {pending && (
        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setRejecting(true)}
            className="min-h-cta rounded border border-red-600 bg-surface px-4 text-body font-semibold text-red-700 disabled:opacity-60"
          >
            {t('admin.review.reject')}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={approve}
            className="min-h-cta flex-1 rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong disabled:opacity-60"
          >
            {busy === 'approve' ? t('admin.review.approving') : t('admin.review.approve')}
          </button>
        </div>
      )}
      <RejectSheet
        open={rejecting}
        busy={busy === 'reject'}
        onClose={() => setRejecting(false)}
        onConfirm={(reason) => void run('reject', () => rejectFactory(fid, data.openedAt, reason))}
      />
    </article>
  )
}
