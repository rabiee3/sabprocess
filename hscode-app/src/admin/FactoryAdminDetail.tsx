import { useState } from 'react'
import { draftFromFactory } from '../survey/draft'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Banner } from '../ui/Banner'
import { StatusChip } from '../ui/StatusChip'
import { useAdmin } from './AdminContext'
import { AdminFactoryForm } from './AdminFactoryForm'
import { DeleteFactorySheet } from './DeleteFactorySheet'
import { deleteFactory, hideFactory, saveEdits, unhideFactory } from './repo'
import { displayName, formatDate, formErrors, toAdminEdit } from './reviewForm'
import { classify, type ActionError } from './classify'
import { ActionErrorBanner, FlagBanners, LoadStatus, PhotosAndContact } from './ReviewShared'
import { useFactoryLoad } from './useFactoryLoad'

type Busy = 'save' | 'hide' | 'unhide' | 'delete'

const SECONDARY =
  'min-h-cta rounded border border-line bg-surface px-4 text-body font-semibold text-ink-strong disabled:opacity-60'

/** Route element for `factories/:fid`. */
export function FactoryAdminPage() {
  const { t } = useTranslation()
  const { fid } = useParams()
  return (
    <div className="flex flex-col gap-4">
      <Link to="/admin/factories" className="flex min-h-touch items-center font-semibold text-blue-800">
        {t('admin.factories.detail.back')}
      </Link>
      {fid && <FactoryAdminDetail key={fid} fid={fid} />}
    </div>
  )
}

/** Edit any factory whatever its status, then save; hide, unhide or delete it. */
export function FactoryAdminDetail({ fid }: { fid: string }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { refreshPending } = useAdmin()
  const { state, reload: load, setDraft } = useFactoryLoad(fid)
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState<ActionError | null>(null)
  const created = (useLocation().state as { created?: string } | null)?.created
  const [notice, setNotice] = useState<string | null>(created ? t('admin.create.done', { name: created }) : null)
  const [busy, setBusy] = useState<Busy | null>(null)
  const [deleting, setDeleting] = useState(false)

  function reload() {
    load()
    setError(null)
    setShowErrors(false)
  }

  if (state.kind !== 'ready') return <LoadStatus kind={state.kind} onReload={reload} />

  const { data, draft } = state
  const { factory } = data
  const lang = i18n.language
  const name = displayName(factory.name, lang, factory.id)
  const errors = showErrors ? formErrors(draft) : []

  async function run(kind: Busy, op: () => Promise<void>, done: 'saved' | 'hidden' | 'unhidden' | 'deleted') {
    if (busy) return
    setBusy(kind)
    setError(null)
    setNotice(null)
    try {
      await op()
      refreshPending()
      if (kind === 'delete') {
        navigate('/admin/factories', { replace: true, state: { deleted: name } })
        return
      }
      setNotice(t(`admin.factories.done.${done}`, { name }))
      setShowErrors(false)
      load()
    } catch (e) {
      setError(classify(e))
    } finally {
      setBusy(null)
      setDeleting(false)
    }
  }

  function save() {
    setShowErrors(true)
    if (formErrors(draft).length > 0) return
    void run('save', () => saveEdits(fid, data.openedAt, toAdminEdit(draft)), 'saved')
  }

  // The location picker re-emits GPS metadata on mount, so only the pin and the typed fields count as edits.
  const comparable = (d: typeof draft) =>
    JSON.stringify({ ...d, gpsStatus: null, location: d.location && { lat: d.location.lat, lng: d.location.lng } }, (k, v) => (k === 'key' ? undefined : v)) // row keys are random per draft
  const dirty = comparable(draft) !== comparable(draftFromFactory(factory, data.contact, data.photos))
  const locked = busy !== null || dirty

  const status = factory.status
  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="min-w-0 text-xl font-semibold text-ink-strong">
            <bdi>{name}</bdi>
          </h2>
          {status !== 'hidden' && <StatusChip status={status} />}
        </div>
        <p className="text-body-sm text-ink-subtle">
          {t('admin.factories.detail.createdBy', { date: formatDate(factory.createdAt, lang) })}
        </p>
      </header>

      {notice && (
        <Banner tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Banner>
      )}
      {status === 'hidden' && <Banner tone="warning">{t('admin.factories.detail.hiddenBanner')}</Banner>}
      {status === 'pending' && (
        <Banner tone="info">
          {t('admin.factories.detail.pendingLink')}{' '}
          <Link to={`/admin/review/${fid}`} className="inline-flex min-h-touch items-center font-semibold underline">
            {t('admin.factories.detail.pendingOpen')}
          </Link>
        </Banner>
      )}
      {status === 'rejected' && factory.rejectReason && (
        <Banner tone="danger" title={t('admin.factories.detail.rejectedReason')}>
          <bdi>{factory.rejectReason}</bdi>
        </Banner>
      )}
      <FlagBanners factory={factory} />
      {error && <ActionErrorBanner error={error} onReload={reload} />}
      {errors.length > 0 && <Banner tone="danger">{t('admin.factories.detail.fixErrors')}</Banner>}

      <AdminFactoryForm value={draft} errors={errors} onChange={(next) => setDraft(data, next)} />
      <PhotosAndContact photos={data.photos} contact={data.contact} />

      {dirty && status !== 'pending' && status !== 'rejected' && (
        <p className="text-body-sm text-ink-subtle">{t('admin.factories.detail.unsavedHint')}</p>
      )}
      <div className="flex flex-wrap gap-3 border-t border-line pt-4">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => setDeleting(true)}
          className="min-h-cta rounded border border-red-600 bg-surface px-4 text-body font-semibold text-red-700 disabled:opacity-60"
        >
          {t('admin.factories.delete')}
        </button>
        {status === 'approved' && (
          <button type="button" disabled={locked} onClick={() => void run('hide', () => hideFactory(fid), 'hidden')} className={SECONDARY}>
            {t('admin.factories.hide')}
          </button>
        )}
        {status === 'hidden' && (
          <button type="button" disabled={locked} onClick={() => void run('unhide', () => unhideFactory(fid), 'unhidden')} className={SECONDARY}>
            {t('admin.factories.unhide')}
          </button>
        )}
        <button
          type="button"
          disabled={busy !== null}
          onClick={save}
          className="min-h-cta flex-1 rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong disabled:opacity-60"
        >
          {busy === 'save' ? t('admin.factories.detail.saving') : t('admin.factories.detail.save')}
        </button>
      </div>
      <DeleteFactorySheet
        open={deleting}
        name={name}
        busy={busy === 'delete'}
        onClose={() => setDeleting(false)}
        onConfirm={() => void run('delete', () => deleteFactory(fid), 'deleted')}
      />
    </article>
  )
}
