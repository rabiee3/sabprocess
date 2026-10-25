import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import type { Factory } from '../lib/types'
import { Banner } from '../ui/Banner'
import { useAdmin } from './AdminContext'
import { QueuePane } from './QueuePane'
import { subscribeQueue } from './queue'
import { ReviewDetail, type DoneInfo } from './ReviewDetail'
import { subscribeSurveyors } from './surveyors'
import { useIsDesktop } from './useIsDesktop'

/** The review page: queue on the left, detail on the right at >= 1024px; one at a time below. */
export function ReviewQueue() {
  const { t } = useTranslation()
  const { fid } = useParams()
  const navigate = useNavigate()
  const { refreshPending } = useAdmin()
  const isDesktop = useIsDesktop()
  const [items, setItems] = useState<Factory[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [surveyors, setSurveyors] = useState<Map<string, string>>(new Map())
  const [notice, setNotice] = useState<DoneInfo | null>(null)

  useEffect(() => subscribeQueue(setItems, () => setLoadError(true)), [])
  useEffect(
    () => subscribeSurveyors((rows) => setSurveyors(new Map(rows.map((s) => [s.uid, s.name]))), () => {}),
    [],
  )

  const sorted = useMemo(
    () => [...(items ?? [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [items],
  )

  function done(info: DoneInfo) {
    refreshPending()
    setNotice(info)
    const rest = sorted.filter((f) => f.id !== info.fid)
    const at = sorted.findIndex((f) => f.id === info.fid)
    const next = (at >= 0 ? rest[at] : undefined) ?? rest[0]
    navigate(next ? `/admin/review/${next.id}` : '/admin/review', { replace: true })
  }

  const queue = (
    <QueuePane items={sorted} selected={fid} surveyors={surveyors} onSelect={(id) => navigate(`/admin/review/${id}`)} />
  )
  const detail = fid ? (
    <ReviewDetail key={fid} fid={fid} submittedBy={submitter(sorted, fid, surveyors)} onDone={done} />
  ) : (
    <p className="text-ink-subtle">{t('admin.review.selectPrompt')}</p>
  )

  return (
    <div className="flex flex-col gap-4">
      {loadError && <Banner tone="danger">{t('admin.loadError')}</Banner>}
      {notice && (
        <Banner tone="success" onClose={() => setNotice(null)}>
          {t(notice.outcome === 'approved' ? 'admin.review.approved' : 'admin.review.rejected', { name: notice.name })}
        </Banner>
      )}
      {isDesktop ? (
        <div className="grid grid-cols-[380px_minmax(0,1fr)] items-start gap-6">
          <div>{items && sorted.length === 0 ? <Empty /> : queue}</div>
          <div className="rounded border border-line bg-surface p-5">{detail}</div>
        </div>
      ) : fid ? (
        <>
          <Link to="/admin/review" className="flex min-h-touch items-center font-semibold text-blue-800">
            {t('admin.review.back')}
          </Link>
          {detail}
        </>
      ) : items && sorted.length === 0 ? (
        <Empty />
      ) : (
        queue
      )}
    </div>
  )
}

function Empty() {
  const { t } = useTranslation()
  return <p className="text-ink-subtle">{t('admin.review.empty')}</p>
}

function submitter(items: Factory[], fid: string, names: Map<string, string>): string | undefined {
  const uid = items.find((f) => f.id === fid)?.createdBy
  return uid ? names.get(uid) : undefined
}
