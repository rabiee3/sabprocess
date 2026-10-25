import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { areas } from '../data'
import type { Factory } from '../lib/types'
import { AppHeader } from '../ui/AppHeader'
import { Banner } from '../ui/Banner'
import { StatusChip, type ChipStatus } from '../ui/StatusChip'
import siloImg from '../assets/placeholders/photo-silo.svg'
import plantImg from '../assets/placeholders/photo-plant.svg'
import warehouseImg from '../assets/placeholders/photo-warehouse.svg'
import plusIcon from '../assets/icons/plus.svg?raw'
import { outbox, type OutboxEntry } from './outbox'
import { subscribeMySubmissions, type SubmissionItem, type SurveyErrorCode } from './repo'

const PLACEHOLDERS = [siloImg, plantImg, warehouseImg]
const placeholderFor = (fid: string) => PLACEHOLDERS[[...fid].reduce((n, c) => n + c.charCodeAt(0), 0) % PLACEHOLDERS.length]

type Snapshot = { uid?: string; items: SubmissionItem[]; entries: OutboxEntry[]; loaded: boolean }

/** Confirms outbox entries the server has seen; flags ones a server snapshot lacks. Cache-only snapshots change nothing. */
function reconcile(items: SubmissionItem[], fromCache: boolean): OutboxEntry[] {
  const byId = new Map(items.map((i) => [i.factory.id, i]))
  for (const e of outbox.list()) {
    const hit = byId.get(e.fid)
    if (hit && !hit.pendingWrite) outbox.remove(e.fid)
    else if (!hit && !fromCache && e.state === 'saved') outbox.markFailed(e.fid, 'generic')
  }
  return outbox.list()
}

export function MySubmissions() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const uid = user?.uid
  const [state, setState] = useState<Snapshot & { error?: SurveyErrorCode }>({ items: [], entries: outbox.list(), loaded: false })
  // Snapshot state belongs to one uid; a different uid starts again from scratch.
  const snap: Snapshot = state.uid === uid ? state : { items: [], entries: outbox.list(), loaded: false }
  const error = state.uid === uid ? state.error : undefined

  useEffect(() => {
    if (!uid) return
    return subscribeMySubmissions(
      uid,
      (items, meta) => {
        setState({ uid, items, entries: reconcile(items, meta.fromCache), loaded: true })
      },
      (code) => setState((s) => ({ ...(s.uid === uid ? s : { items: [], entries: outbox.list() }), uid, loaded: true, error: code })),
    )
  }, [uid])

  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en'
  const fmt = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })
  const areaLabel = (id: string) => {
    const a = areas().find((x) => x.id === id)
    return a ? a[lang] : id
  }
  const nameOf = (f: Factory) => f.name[lang] || f.name.en || f.name.ar || t('survey.list.untitled')

  const docIds = new Set(snap.items.map((i) => i.factory.id))
  const standalone = snap.entries.filter((e) => !docIds.has(e.fid))
  const entryOf = (fid: string) => snap.entries.find((e) => e.fid === fid)
  const count = (s: Factory['status']) => snap.items.filter((i) => i.factory.status === s).length
  const savedCount = snap.items.filter((i) => i.pendingWrite).length + standalone.filter((e) => e.state === 'saved').length
  const counts: { key: ChipStatus; n: number; box: string }[] = [
    { key: 'pending', n: count('pending'), box: 'bg-amber-50 text-amber-900' },
    { key: 'approved', n: count('approved'), box: 'bg-green-50 text-green-700' },
    { key: 'rejected', n: count('rejected'), box: 'bg-red-50 text-red-700' },
    ...(savedCount > 0 ? [{ key: 'savedOnPhone' as const, n: savedCount, box: 'bg-blue-50 text-blue-800' }] : []),
  ]
  const empty = snap.loaded && snap.items.length === 0 && standalone.length === 0

  return (
    <>
      <AppHeader areaLabel="surveyor" />
      <main className="mx-auto max-w-md space-y-3 p-4 pb-28">
        <h1 className="text-title font-semibold text-ink-strong">{t('survey.list.title')}</h1>
        {error && <Banner tone="danger">{t(`errors.${error}`)}</Banner>}
        <div className="flex flex-wrap gap-2">
          {counts.map((c) => (
            <span key={c.key} className={`rounded px-2 py-1 text-xs font-semibold ${c.box}`}>
              {`${c.n} ${t(`survey.list.${c.key}`)}`}
            </span>
          ))}
        </div>
        {!snap.loaded && (
          <div
            role="status"
            aria-label={t('common.loading')}
            className="size-8 animate-spin rounded-full border-4 border-line border-t-brand-600"
          />
        )}
        {empty && !error && <p className="text-body text-ink-subtle">{t('survey.list.empty')}</p>}
        <ul className="space-y-3">
          {standalone.map((e) => (
            <li key={e.fid} className="rounded border border-line bg-surface p-3">
              <div className="flex items-start gap-3">
                <img src={placeholderFor(e.fid)} alt="" className="size-16 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-strong">{t('survey.list.untitled')}</p>
                  <p className="text-sm text-ink-subtle">{fmt.format(new Date(e.savedAt))}</p>
                </div>
                <StatusChip status={e.state === 'failed' ? 'uploadFailed' : 'savedOnPhone'} />
              </div>
              {e.state === 'failed' && <p className="mt-2 text-sm text-red-700">{t(`errors.${e.error ?? 'generic'}`)}</p>}
            </li>
          ))}
          {snap.items.map(({ factory: f, pendingWrite }) => {
            const entry = entryOf(f.id)
            const failed = entry?.state === 'failed'
            const chip: ChipStatus = failed ? 'uploadFailed' : pendingWrite ? 'savedOnPhone' : (f.status as ChipStatus) // query excludes hidden
            const body = (
              <div className="flex items-start gap-3">
                <img src={f.thumb || placeholderFor(f.id)} alt="" className="size-16 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink-strong">{nameOf(f)}</p>
                  <p className="text-sm text-ink-subtle">
                    {areaLabel(f.area)} · {fmt.format(f.updatedAt)}
                  </p>
                </div>
                <StatusChip status={chip} />
              </div>
            )
            return (
              <li key={f.id} className="rounded border border-line bg-surface p-3">
                {f.status !== 'approved' ? (
                  <Link to={`edit/${f.id}`} className="block min-h-touch">
                    {body}
                  </Link>
                ) : (
                  body
                )}
                {failed && <p className="mt-2 text-sm text-red-700">{t(`errors.${entry?.error ?? 'generic'}`)}</p>}
                {f.status === 'rejected' && f.rejectReason && (
                  <div className="mt-2 rounded bg-red-50 p-2 text-sm">
                    <p className="font-semibold text-red-700">{t('survey.list.adminReason')}</p>
                    <p className="text-ink">{f.rejectReason}</p>
                  </div>
                )}
                {f.status === 'rejected' && (
                  <Link
                    to={`edit/${f.id}`}
                    className="mt-2 flex min-h-touch items-center justify-center rounded border border-brand-700 px-3 font-semibold text-brand-900"
                  >
                    {t('survey.list.fixResubmit')}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </main>
      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-surface p-3">
        <Link
          to="new"
          className="mx-auto flex min-h-cta max-w-md items-center justify-center gap-2 rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong"
        >
          <span aria-hidden="true" className="size-5" dangerouslySetInnerHTML={{ __html: plusIcon }} />
          {t('survey.list.add')}
        </Link>
      </footer>
    </>
  )
}
