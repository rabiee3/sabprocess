import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Timestamp } from 'firebase/firestore'
import type { Factory } from '../lib/types'
import { draftFromFactory, type Draft } from '../survey/draft'
import type { ContactDraft, PhotoData } from '../survey/types'
import { Banner } from '../ui/Banner'
import { StatusChip } from '../ui/StatusChip'
import { AdminFactoryForm } from './AdminFactoryForm'
import { factoryFlags } from './flags'
import { AdminError, approveFactory, loadForReview, rejectFactory } from './repo'
import { ContactBlock, PhotoStrip, RejectSheet } from './ReviewParts'
import { displayName, formatDate, formErrors, toAdminEdit } from './reviewForm'

export type ReviewOutcome = 'approved' | 'rejected'
export type DoneInfo = { fid: string; outcome: ReviewOutcome; name: string }

type Loaded = { factory: Factory; openedAt: Timestamp; contact: ContactDraft; photos: PhotoData[] }
type State =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'failed' }
  | { kind: 'ready'; data: Loaded; draft: Draft }
type ActionError = 'stale' | 'indexFull' | 'invalid' | 'offline' | 'generic' | null

function classify(e: unknown): Exclude<ActionError, null> {
  if (e instanceof AdminError) return e.code
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'generic'
}

type Props = {
  fid: string
  submittedBy?: string
  onDone: (info: DoneInfo) => void
}

export function ReviewDetail({ fid, submittedBy, onDone }: Props) {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState<ActionError>(null)
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)

  useEffect(() => {
    let live = true
    loadForReview(fid).then(
      (data) => {
        if (!live) return
        setState(data ? { kind: 'ready', data, draft: draftFromFactory(data.factory, data.contact, data.photos) } : { kind: 'missing' })
      },
      () => live && setState({ kind: 'failed' }),
    )
    return () => {
      live = false
    }
  }, [fid, attempt])

  function reload() {
    setState({ kind: 'loading' })
    setError(null)
    setShowErrors(false)
    setAttempt((n) => n + 1)
  }

  if (state.kind === 'loading') {
    return <p role="status" className="text-ink-subtle">{t('admin.review.loading')}</p>
  }
  if (state.kind === 'missing') return <Banner tone="danger">{t('admin.review.notFound')}</Banner>
  if (state.kind === 'failed') {
    return (
      <Banner tone="danger">
        {t('admin.loadError')} <ReloadButton onClick={reload} />
      </Banner>
    )
  }

  const { data, draft } = state
  const { factory } = data
  const lang = i18n.language
  const name = displayName(factory.name, lang, t('survey.list.untitled'))
  const pending = factory.status === 'pending'
  const errors = showErrors ? formErrors(draft) : []

  async function run(kind: 'approve' | 'reject', op: () => Promise<void>) {
    if (busy) return
    setBusy(kind)
    setError(null)
    try {
      await op()
      onDone({ fid, outcome: kind === 'approve' ? 'approved' : 'rejected', name })
    } catch (e) {
      setBusy(null)
      setRejecting(false)
      setError(classify(e))
    }
  }

  function approve() {
    setShowErrors(true)
    if (formErrors(draft).length > 0) return
    void run('approve', () => approveFactory(fid, data.openedAt, toAdminEdit(draft)))
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
      {factoryFlags(factory).map((flag) => (
        <Banner key={flag} tone="warning" title={t('admin.review.warn.title')}>
          {t(`admin.review.warn.${flag}`, { m: Math.round(factory.location.accuracyM ?? 0) })}
        </Banner>
      ))}
      {error && (
        <Banner tone="danger">
          {t(error === 'stale' ? 'admin.review.stale' : error === 'indexFull' ? 'errors.indexFull' : error === 'offline' ? 'errors.offline' : 'errors.generic')}
          {error === 'stale' && (
            <>
              {' '}
              <ReloadButton onClick={reload} />
            </>
          )}
        </Banner>
      )}
      {errors.length > 0 && <Banner tone="danger">{t('admin.review.fixErrors')}</Banner>}

      <AdminFactoryForm
        value={draft}
        errors={errors}
        onChange={(next) => setState({ kind: 'ready', data, draft: next })}
      />

      <section>
        <h3 className="mb-2 text-title font-semibold text-ink-strong">{t('admin.review.photos')}</h3>
        <PhotoStrip photos={data.photos} />
      </section>
      <section>
        <h3 className="mb-2 text-title font-semibold text-ink-strong">{t('admin.review.contact')}</h3>
        <ContactBlock contact={data.contact} />
      </section>

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

function ReloadButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" onClick={onClick} className="min-h-touch font-semibold underline">
      {t('common.reload')}
    </button>
  )
}
