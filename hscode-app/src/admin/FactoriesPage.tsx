import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { areas, sectors } from '../data'
import type { Factory, FactoryStatus } from '../lib/types'
import { Banner } from '../ui/Banner'
import { DataTable, type Column } from '../ui/DataTable'
import { StatusChip } from '../ui/StatusChip'
import { DeleteFactorySheet } from './DeleteFactorySheet'
import { fetchFactoriesPage, type FactoriesCursor } from './factoriesQuery'
import { applyFilters, NO_FILTERS } from './filterRows'
import { FactoryFilters } from './FactoryFilters'
import { deleteFactory, hideFactory, unhideFactory } from './repo'
import { displayName, formatDate } from './reviewForm'
import { classify } from './classify'
import { isSafeImage } from '../lib/safeImage'

const TABS: FactoryStatus[] = ['approved', 'pending', 'rejected', 'hidden']
type Action = 'hide' | 'unhide' | 'delete'
type Notice = { tone: 'success' | 'danger'; text: string }
const DONE: Record<Action, string> = { hide: 'hidden', unhide: 'unhidden', delete: 'deleted' }

const BTN =
  'inline-flex min-h-touch items-center rounded border border-line bg-surface px-3 text-body-sm font-semibold text-ink-strong disabled:opacity-50'

export function FactoriesPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const ar = lang.startsWith('ar')
  const [tab, setTab] = useState<FactoryStatus>('approved')
  const [rows, setRows] = useState<Factory[]>([])
  const [cursor, setCursor] = useState<FactoriesCursor | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [filters, setFilters] = useState(NO_FILTERS)
  const deletedName = (useLocation().state as { deleted?: string } | null)?.deleted
  const [notice, setNotice] = useState<Notice | null>(
    deletedName ? { tone: 'success', text: t('admin.factories.done.deleted', { name: deletedName }) } : null,
  )
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Factory | null>(null)
  const seq = useRef(0)

  const loadFirst = useCallback((status: FactoryStatus) => {
    const mine = ++seq.current
    return fetchFactoriesPage(status, null).then(
      (page) => {
        if (mine !== seq.current) return
        setRows(page.rows)
        setCursor(page.cursor)
        setHasMore(page.hasMore)
        setLoading(false)
      },
      () => {
        if (mine !== seq.current) return
        setFailed(true)
        setLoading(false)
      },
    )
  }, [])

  useEffect(() => {
    void loadFirst(tab)
  }, [tab, loadFirst])

  /** Shows the loading state, then fetches the first page again (event handlers only). */
  function restart(status: FactoryStatus) {
    setLoading(true)
    setFailed(false)
    void loadFirst(status)
  }

  async function loadMore() {
    const mine = seq.current
    setLoadingMore(true)
    try {
      const page = await fetchFactoriesPage(tab, cursor)
      if (mine !== seq.current) return
      setRows((prev) => [...prev, ...page.rows.filter((r) => !prev.some((p) => p.id === r.id))])
      setCursor(page.cursor ?? cursor)
      setHasMore(page.hasMore)
    } catch {
      if (mine === seq.current) setFailed(true)
    } finally {
      setLoadingMore(false)
    }
  }

  const nameOf = (f: Factory) => displayName(f.name, lang, f.id)

  async function act(f: Factory, action: Action) {
    if (busyId) return
    const name = nameOf(f)
    setBusyId(f.id)
    setNotice(null)
    try {
      await (action === 'hide' ? hideFactory(f.id) : action === 'unhide' ? unhideFactory(f.id) : deleteFactory(f.id))
      setRows((prev) => prev.filter((r) => r.id !== f.id))
      setNotice({ tone: 'success', text: t(`admin.factories.done.${DONE[action]}`, { name }) })
    } catch (e) {
      setNotice({ tone: 'danger', text: t(classify(e) === 'offline' ? 'errors.offline' : 'errors.generic') })
      restart(tab)
    } finally {
      setBusyId(null)
      setDeleting(null)
    }
  }

  const areaLabel = (f: Factory) => {
    if (f.area === 'other') return f.areaOther ?? ''
    const a = areas().find((x) => x.id === f.area)
    return a ? (ar ? a.ar : a.en) : f.area
  }
  const sectorLabel = (f: Factory) => {
    const s = sectors().find((x) => x.id === f.sector)
    return s ? (ar ? s.ar : s.en) : (f.sector ?? '')
  }

  const columns: Column<Factory>[] = [
    {
      key: 'thumb',
      header: t('admin.factories.col.thumb'),
      render: (f) =>
        isSafeImage(f.thumb) ? (
          <img src={f.thumb} alt="" className="size-12 rounded object-cover" />
        ) : (
          <span aria-hidden="true" className="inline-block size-12 rounded bg-surface-alt" />
        ),
    },
    { key: 'name', header: t('admin.factories.col.name'), render: (f) => <bdi className="font-semibold text-ink-strong">{nameOf(f)}</bdi> },
    { key: 'area', header: t('admin.factories.col.area'), render: areaLabel },
    { key: 'sector', header: t('admin.factories.col.sector'), render: sectorLabel },
    { key: 'products', header: t('admin.factories.col.products'), render: (f) => f.productsMade.length + f.productsNeeded.length },
    {
      key: 'status',
      header: t('admin.factories.col.status'),
      render: (f) =>
        f.status === 'hidden' ? (
          <span className="inline-flex rounded bg-surface-alt px-2 py-1 text-xs font-semibold text-ink">{t('admin.factories.statusHidden')}</span>
        ) : (
          <StatusChip status={f.status} />
        ),
    },
    { key: 'updated', header: t('admin.factories.col.updated'), render: (f) => formatDate(f.updatedAt, lang) },
    {
      key: 'actions',
      header: t('admin.factories.col.actions'),
      render: (f) => {
        const name = nameOf(f)
        const busy = busyId !== null
        return (
          <div className="flex flex-wrap justify-end gap-2">
            {f.status === 'pending' ? (
              <Link to={`/admin/review/${f.id}`} aria-label={t('admin.factories.reviewNamed', { name })} className={BTN}>
                {t('admin.factories.review')}
              </Link>
            ) : (
              <Link to={`/admin/factories/${f.id}`} aria-label={t('admin.factories.openNamed', { name })} className={BTN}>
                {t('admin.factories.open')}
              </Link>
            )}
            {f.status === 'approved' && (
              <button type="button" disabled={busy} aria-label={t('admin.factories.hideNamed', { name })} onClick={() => void act(f, 'hide')} className={BTN}>
                {t('admin.factories.hide')}
              </button>
            )}
            {f.status === 'hidden' && (
              <button type="button" disabled={busy} aria-label={t('admin.factories.unhideNamed', { name })} onClick={() => void act(f, 'unhide')} className={BTN}>
                {t('admin.factories.unhide')}
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              aria-label={t('admin.factories.deleteNamed', { name })}
              onClick={() => setDeleting(f)}
              className={`${BTN} !border-red-600 !text-red-700`}
            >
              {t('admin.factories.delete')}
            </button>
          </div>
        )
      },
    },
  ]

  const shown = applyFilters(rows, filters)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t('admin.factories.tabsLabel')} className="flex flex-wrap gap-2">
          {TABS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={tab === s}
              onClick={() => {
                setLoading(true)
                setTab(s)
              }}
              className={`min-h-touch rounded px-4 text-body font-semibold ${tab === s ? 'bg-brand-500 text-ink-strong' : 'border border-line bg-surface text-ink'}`}
            >
              {t(`admin.factories.tab.${s}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => restart(tab)} disabled={loading} className={BTN}>
            {t('admin.factories.refresh')}
          </button>
          <Link to="/admin/factories/new" className="inline-flex min-h-touch items-center rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong">
            {t('admin.factories.add')}
          </Link>
        </div>
      </div>

      {notice && (
        <Banner tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Banner>
      )}
      {failed && <Banner tone="danger">{t('admin.loadError')}</Banner>}
      <FactoryFilters value={filters} onChange={setFilters} />

      {loading ? (
        <p role="status" className="text-ink-subtle">
          {t('admin.factories.loading')}
        </p>
      ) : (
        <DataTable
          label={t('admin.factories.tableLabel')}
          columns={columns}
          rows={shown}
          rowKey={(f) => f.id}
          empty={rows.length === 0 ? t('admin.factories.empty') : t('admin.factories.emptyFiltered')}
        />
      )}
      {hasMore && !loading && (
        <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className={`${BTN} self-center`}>
          {t('admin.factories.loadMore')}
        </button>
      )}
      <DeleteFactorySheet
        key={deleting?.id ?? 'none'}
        open={deleting !== null}
        name={deleting ? nameOf(deleting) : ''}
        busy={busyId !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void act(deleting, 'delete')}
      />
    </div>
  )
}
