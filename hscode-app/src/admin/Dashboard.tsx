import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { areas } from '../data'
import { Banner } from '../ui/Banner'
import { DataTable, type Column } from '../ui/DataTable'
import { INDEX_LIMIT } from './searchIndex'
import { loadStats, STATUSES, type AreaCount, type Count, type Stats } from './stats'
import { countSubmissions, subscribeSurveyors, type SubmissionCounts } from './surveyors'
import type { Surveyor } from './types'

const WARN_AT = 0.8
const num = (n: Count | undefined) => (n == null ? '—' : String(n))

type SurveyorRow = Surveyor & { counts: SubmissionCounts | null | undefined }

function IndexFill({ fill }: { fill: number | null }) {
  const { t } = useTranslation()
  if (fill == null) return <p className="text-body text-ink-subtle">—</p>
  const pct = Math.round(fill * 100)
  const danger = fill >= INDEX_LIMIT
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div
          role="meter"
          aria-label={t('admin.dash.indexLabel')}
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-3 flex-1 overflow-hidden rounded-full bg-line"
        >
          <div
            className={`h-full ${danger ? 'bg-red-600' : fill >= WARN_AT ? 'bg-amber-900' : 'bg-green-700'}`}
            style={{ inlineSize: `${Math.min(100, pct)}%` }}
          />
        </div>
        <span className="font-mono text-body font-semibold text-ink-strong" dir="ltr">
          {pct}%
        </span>
      </div>
      {fill >= WARN_AT && <Banner tone={danger ? 'danger' : 'warning'}>{t('admin.dash.indexWarn', { pct })}</Banner>}
    </div>
  )
}

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [stats, setStats] = useState<Stats | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)
  const [surveyors, setSurveyors] = useState<Surveyor[]>([])
  const [counts, setCounts] = useState<Record<string, SubmissionCounts | null>>({})
  const asked = useRef(new Set<string>())

  const load = useCallback(
    () =>
      loadStats().then((s) => {
        setStats(s)
        setUpdated(new Date())
      }),
    [],
  )

  useEffect(() => {
    let live = true
    void loadStats().then((s) => {
      if (!live) return
      setStats(s)
      setUpdated(new Date())
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => subscribeSurveyors(setSurveyors, () => {}), [])

  // Per-surveyor counts are fetched once per uid for this mount; Refresh reloads the rest.
  useEffect(() => {
    for (const s of surveyors) {
      if (asked.current.has(s.uid)) continue
      asked.current.add(s.uid)
      countSubmissions(s.uid)
        .then((c) => setCounts((p) => ({ ...p, [s.uid]: c })))
        .catch(() => setCounts((p) => ({ ...p, [s.uid]: null })))
    }
  }, [surveyors])

  const areaName = (id: string) => {
    const a = areas().find((x) => x.id === id)
    return a ? (lang === 'ar' ? a.ar : a.en) : id
  }

  const areaCols: Column<AreaCount>[] = [
    { key: 'area', header: t('admin.dash.colArea'), render: (r) => areaName(r.area) },
    { key: 'approved', header: t('admin.dash.colApproved'), render: (r) => num(r.approved) },
    { key: 'pending', header: t('admin.dash.colPending'), render: (r) => num(r.pending) },
  ]
  const surveyorCols: Column<SurveyorRow>[] = [
    { key: 'name', header: t('admin.dash.colSurveyor'), render: (r) => r.name || r.email },
    { key: 'pending', header: t('admin.dash.colPending'), render: (r) => num(r.counts?.pending) },
    { key: 'approved', header: t('admin.dash.colApproved'), render: (r) => num(r.counts?.approved) },
    { key: 'rejected', header: t('admin.dash.colRejected'), render: (r) => num(r.counts?.rejected) },
  ]
  const surveyorRows: SurveyorRow[] = surveyors.map((s) => ({ ...s, counts: counts[s.uid] }))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-subtle">
          {updated
            ? t('admin.dash.updated', { time: updated.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB') })
            : t('common.loading')}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="min-h-cta rounded border border-line bg-surface px-4 text-body font-semibold text-ink-strong"
        >
          {t('admin.factories.refresh')}
        </button>
      </div>

      <section aria-labelledby="dash-status" className="flex flex-col gap-3">
        <h2 id="dash-status" className="text-lg font-semibold text-ink-strong">
          {t('admin.dash.statusTitle')}
        </h2>
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATUSES.map((s) => (
            <li key={s} className="rounded border border-line bg-surface p-4">
              <p className="text-sm text-ink-subtle">{t(`admin.factories.tab.${s}`)}</p>
              <p className="font-mono text-2xl font-semibold text-ink-strong" dir="ltr">
                {num(stats?.byStatus[s])}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="dash-index" className="flex flex-col gap-3">
        <h2 id="dash-index" className="text-lg font-semibold text-ink-strong">
          {t('admin.dash.indexTitle')}
        </h2>
        {stats && <IndexFill fill={stats.indexFill} />}
      </section>

      <section aria-labelledby="dash-areas" className="flex flex-col gap-3">
        <h2 id="dash-areas" className="text-lg font-semibold text-ink-strong">
          {t('admin.dash.areasTitle')}
        </h2>
        <DataTable
          label={t('admin.dash.areasTitle')}
          columns={areaCols}
          rows={stats?.byArea ?? []}
          rowKey={(r) => r.area}
        />
      </section>

      <section aria-labelledby="dash-surveyors" className="flex flex-col gap-3">
        <h2 id="dash-surveyors" className="text-lg font-semibold text-ink-strong">
          {t('admin.dash.surveyorsTitle')}
        </h2>
        <DataTable
          label={t('admin.dash.surveyorsTitle')}
          columns={surveyorCols}
          rows={surveyorRows}
          rowKey={(r) => r.uid}
          empty={t('admin.surveyors.empty')}
        />
      </section>
    </div>
  )
}
