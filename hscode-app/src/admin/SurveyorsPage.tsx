import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banner } from '../ui/Banner'
import { BottomSheet } from '../ui/BottomSheet'
import { DataTable, type Column } from '../ui/DataTable'
import { countSubmissions, setSurveyorActive, subscribeSurveyors, type SubmissionCounts } from './surveyors'
import type { Surveyor } from './types'

/** Loads its counts when first rendered; "—" until loaded or on error. */
function Counts({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const [counts, setCounts] = useState<SubmissionCounts | null>(null)
  useEffect(() => {
    let live = true
    countSubmissions(uid)
      .then((c) => live && setCounts(c))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [uid])
  return <>{counts ? t('admin.surveyors.counts', counts) : '—'}</>
}

function Switch({ checked, label, onClick }: { checked: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className="flex min-h-touch min-w-11 items-center justify-center"
    >
      <span
        aria-hidden="true"
        className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${checked ? 'bg-green-700' : 'bg-line-strong'}`}
      >
        <span
          className={`size-5 rounded-full bg-white transition-transform ${
            checked ? 'ltr:translate-x-5 rtl:-translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  )
}

export function SurveyorsPage() {
  const { t } = useTranslation()
  const [rows, setRows] = useState<Surveyor[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toDeactivate, setToDeactivate] = useState<Surveyor | null>(null)

  useEffect(() => subscribeSurveyors(setRows, () => setLoadError(true)), [])

  async function setActive(uid: string, active: boolean) {
    setError(null)
    try {
      await setSurveyorActive(uid, active)
    } catch {
      setError(t(navigator.onLine === false ? 'errors.offline' : 'errors.generic'))
    }
  }

  async function confirmDeactivate() {
    const s = toDeactivate
    setToDeactivate(null)
    if (s) await setActive(s.uid, false)
  }

  const columns: Column<Surveyor>[] = [
    { key: 'name', header: t('admin.surveyors.colName'), render: (s) => <bdi className="font-semibold">{s.name}</bdi> },
    { key: 'email', header: t('admin.surveyors.colEmail'), render: (s) => <span dir="ltr">{s.email}</span> },
    {
      key: 'code',
      header: t('admin.surveyors.colCode'),
      render: (s) => (s.inviteCode ? <span dir="ltr" className="font-mono">{s.inviteCode}</span> : '—'),
    },
    { key: 'submissions', header: t('admin.surveyors.colSubmissions'), render: (s) => <Counts uid={s.uid} /> },
    {
      key: 'active',
      header: t('admin.surveyors.colActive'),
      render: (s) => (
        <Switch
          checked={s.active}
          label={t('admin.surveyors.toggle', { name: s.name })}
          onClick={() => (s.active ? setToDeactivate(s) : void setActive(s.uid, true))}
        />
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {loadError && <Banner tone="danger">{t('admin.loadError')}</Banner>}
      {error && <Banner tone="danger" onClose={() => setError(null)}>{error}</Banner>}
      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(s) => s.uid}
        empty={rows ? t('admin.surveyors.empty') : t('common.loading')}
      />
      <BottomSheet
        open={toDeactivate !== null}
        title={t('admin.surveyors.deactivateTitle', { name: toDeactivate?.name ?? '' })}
        onClose={() => setToDeactivate(null)}
      >
        <div className="flex flex-col gap-4 p-4">
          <p className="text-body text-ink">{t('admin.surveyors.deactivateBody')}</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void confirmDeactivate()}
              className="min-h-cta rounded bg-red-600 px-4 text-body font-semibold text-white"
            >
              {t('admin.surveyors.deactivate')}
            </button>
            <button
              type="button"
              onClick={() => setToDeactivate(null)}
              className="min-h-cta rounded border border-line bg-surface px-4 text-body font-semibold text-ink-strong"
            >
              {t('admin.surveyors.keep')}
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
