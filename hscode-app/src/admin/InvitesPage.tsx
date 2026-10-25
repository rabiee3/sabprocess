import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import checkIcon from '../assets/icons/check-circle.svg?raw'
import clockIcon from '../assets/icons/clock.svg?raw'
import closeIcon from '../assets/icons/close.svg?raw'
import plusIcon from '../assets/icons/plus.svg?raw'
import { Banner } from '../ui/Banner'
import { BottomSheet } from '../ui/BottomSheet'
import { DataTable, type Column } from '../ui/DataTable'
import { cancelInvite, generateInvite, subscribeInvites } from './invites'
import { subscribeSurveyors } from './surveyors'
import type { Invite, Surveyor } from './types'

type InviteStatus = 'unused' | 'used' | 'cancelled'

const statusOf = (i: Invite): InviteStatus => (i.cancelled ? 'cancelled' : i.usedBy ? 'used' : 'unused')

const CHIP: Record<InviteStatus, { box: string; svg: string }> = {
  unused: { box: 'bg-green-50 text-green-700', svg: checkIcon },
  used: { box: 'bg-blue-50 text-blue-800', svg: clockIcon },
  cancelled: { box: 'bg-red-50 text-red-700', svg: closeIcon },
}

/** Icon + text, never colour alone. */
function InviteStatusChip({ status }: { status: InviteStatus }) {
  const { t } = useTranslation()
  const s = CHIP[status]
  return (
    <span data-chip className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${s.box}`}>
      <span aria-hidden="true" className="size-4 shrink-0 [&>svg]:size-4" dangerouslySetInnerHTML={{ __html: s.svg }} />
      {t(`admin.invites.${status}`)}
    </span>
  )
}

function errorKey(e: unknown): string {
  if (e instanceof Error && e.message === 'collision') return 'admin.invites.collision'
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'errors.offline' : 'errors.generic'
}

const MAX_LABEL = 80

export function InvitesPage() {
  const { t, i18n } = useTranslation()
  const [invites, setInvites] = useState<Invite[] | null>(null)
  const [surveyors, setSurveyors] = useState<Surveyor[]>([])
  const [loadError, setLoadError] = useState(false)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [toCancel, setToCancel] = useState<string | null>(null)
  const codeRef = useRef<HTMLElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => subscribeInvites(setInvites, () => setLoadError(true)), [])
  // Surveyor names are a nicety; on error the uid is shown instead.
  useEffect(() => subscribeSurveyors(setSurveyors, () => {}), [])

  const names = useMemo(() => new Map(surveyors.map((s) => [s.uid, s.name])), [surveyors])
  const counts = useMemo(() => {
    const c = { unused: 0, used: 0, cancelled: 0 }
    for (const i of invites ?? []) c[statusOf(i)]++
    return c
  }, [invites])

  const present = fresh != null && (invites ?? []).some((i) => i.code === fresh)
  useEffect(() => {
    if (!present) return
    wrapRef.current?.querySelector('[data-highlight="true"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [present, fresh])

  const date = (d?: Date) =>
    d ? new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(d) : ''

  async function onGenerate() {
    setBusy(true)
    setError(null)
    try {
      const code = await generateInvite(label.trim() || undefined)
      setFresh(code)
      setCopyState('idle')
      setLabel('')
    } catch (e) {
      setError(t(errorKey(e)))
    } finally {
      setBusy(false)
    }
  }

  async function onCopy() {
    if (!fresh) return
    try {
      await navigator.clipboard.writeText(fresh)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
      const el = codeRef.current
      const sel = window.getSelection()
      if (el && sel) {
        const r = document.createRange()
        r.selectNodeContents(el)
        sel.removeAllRanges()
        sel.addRange(r)
      }
    }
  }

  async function confirmCancel() {
    const code = toCancel
    setToCancel(null)
    if (!code) return
    setError(null)
    try {
      await cancelInvite(code)
    } catch (e) {
      setError(t(errorKey(e)))
    }
  }

  const columns: Column<Invite>[] = [
    {
      key: 'code',
      header: t('admin.invites.colCode'),
      render: (i) => (
        <span
          dir="ltr"
          className={`font-mono font-semibold tracking-wider text-ink-strong ${i.cancelled ? 'line-through' : ''}`}
        >
          {i.code}
        </span>
      ),
    },
    { key: 'label', header: t('admin.invites.colLabel'), render: (i) => i.label ?? '' },
    { key: 'status', header: t('admin.invites.colStatus'), render: (i) => <InviteStatusChip status={statusOf(i)} /> },
    {
      key: 'usedBy',
      header: t('admin.invites.colUsedBy'),
      render: (i) =>
        i.usedBy ? (
          <>
            <bdi>{names.get(i.usedBy) ?? i.usedBy}</bdi> · {date(i.usedAt)}
          </>
        ) : i.cancelled ? (
          date(i.createdAt)
        ) : (
          ''
        ),
    },
    {
      key: 'action',
      header: t('admin.invites.colAction'),
      render: (i) =>
        statusOf(i) === 'unused' ? (
          <button
            type="button"
            onClick={() => setToCancel(i.code)}
            className="min-h-touch rounded border border-line bg-surface px-3 text-sm font-semibold text-red-700"
          >
            {t('admin.invites.cancel')}
          </button>
        ) : null,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded border border-line bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-ink-strong">
            {t('admin.invites.labelField')}
            <input
              type="text"
              value={label}
              maxLength={MAX_LABEL}
              placeholder={t('admin.invites.labelPlaceholder')}
              onChange={(e) => setLabel(e.target.value)}
              className="min-h-touch rounded border border-line-strong bg-surface px-3 text-body font-normal text-ink"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onGenerate()}
            className="flex min-h-touch items-center justify-center gap-2 rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong disabled:opacity-60"
          >
            <span aria-hidden="true" className="size-5 [&>svg]:size-5" dangerouslySetInnerHTML={{ __html: plusIcon }} />
            {busy ? t('admin.invites.generating') : t('admin.invites.generate')}
          </button>
        </div>
        {error && <Banner tone="danger" onClose={() => setError(null)}>{error}</Banner>}
        {fresh && (
          <Banner tone="success" title={t('admin.invites.newCode')}>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <code
                ref={codeRef}
                dir="ltr"
                className="font-mono text-xl font-semibold tracking-widest text-ink-strong select-all"
              >
                {fresh}
              </code>
              <button
                type="button"
                onClick={() => void onCopy()}
                className="min-h-touch rounded border border-line bg-surface px-3 text-sm font-semibold text-ink-strong"
              >
                {t('admin.invites.copy')}
              </button>
              {copyState === 'copied' && <span className="font-semibold">{t('admin.invites.copied')}</span>}
              {copyState === 'failed' && <span>{t('admin.invites.copyFailed')}</span>}
            </div>
          </Banner>
        )}
      </section>

      {loadError && <Banner tone="danger">{t('admin.loadError')}</Banner>}

      <ul aria-label={t('admin.invites.summary')} className="flex flex-wrap gap-2 text-xs font-semibold">
        <li className="rounded bg-green-50 px-2 py-1 text-green-700">
          {t('admin.invites.countUnused', { count: counts.unused })}
        </li>
        <li className="rounded bg-blue-50 px-2 py-1 text-blue-800">
          {t('admin.invites.countUsed', { count: counts.used })}
        </li>
        <li className="rounded bg-red-50 px-2 py-1 text-red-700">
          {t('admin.invites.countCancelled', { count: counts.cancelled })}
        </li>
      </ul>

      <div ref={wrapRef}>
        <DataTable
          columns={columns}
          rows={invites ?? []}
          rowKey={(i) => i.code}
          highlight={(i) => i.code === fresh}
          empty={invites ? t('admin.invites.empty') : t('common.loading')}
        />
      </div>

      <BottomSheet open={toCancel !== null} title={t('admin.invites.cancelTitle')} onClose={() => setToCancel(null)}>
        <div className="flex flex-col gap-4 p-4">
          <p className="text-body text-ink">{t('admin.invites.cancelBody', { code: toCancel ?? '' })}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void confirmCancel()}
              className="min-h-cta rounded bg-red-600 px-4 text-body font-semibold text-white"
            >
              {t('admin.invites.confirmCancel')}
            </button>
            <button
              type="button"
              onClick={() => setToCancel(null)}
              className="min-h-cta rounded border border-line bg-surface px-4 text-body font-semibold text-ink-strong"
            >
              {t('admin.invites.keep')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
