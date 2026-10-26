import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import emptyIcon from '../assets/icons/search-empty.svg?raw'
import type { IndexEntry } from '../lib/types'
import { FactoryCard } from './FactoryCard'
import type { Lang } from './labels'
import { Icon } from '../ui/Icon'

const PAGE = 50

type Props = {
  entries: IndexEntry[]
  loading: boolean
  error?: boolean
  lang: Lang
  desktop: boolean
  selectedId?: string
  distances?: Map<string, number>
  hsFilter?: string
  fromCache?: boolean
  onSelect: (id: string) => void
  onTry: (q: string) => void
  /** Phone: the sheet's height in px whenever it changes (the map pads its fit by it). */
  onHeight?: (px: number) => void
}

// The phone sheet's heights, as fractions of the map area (the h-[40%] / h-[85%] classes below).
const COLLAPSED = 0.4
const EXPANDED = 0.85

function Skeletons() {
  return (
    <ul aria-hidden="true" className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex gap-3 rounded-lg border-2 border-line p-3">
          <div className="size-16 shrink-0 rounded bg-surface-alt" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-surface-alt" />
            <div className="h-3 w-1/2 rounded bg-surface-alt" />
            <div className="h-3 w-3/4 rounded bg-surface-alt" />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function ResultsSheet(p: Props) {
  const { t } = useTranslation()
  const { entries, selectedId } = p
  const [expanded, setExpanded] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const sheet = useRef<HTMLElement>(null)
  const { desktop, onHeight } = p

  // From the target fraction of the map area, not offsetHeight, which lags behind during the height transition.
  useLayoutEffect(() => {
    if (desktop || !onHeight) return
    const measure = () => {
      const area = sheet.current?.parentElement?.clientHeight || window.innerHeight
      onHeight(Math.round(area * (expanded ? EXPANDED : COLLAPSED)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [desktop, onHeight, expanded])

  useEffect(() => setLimit(PAGE), [entries])
  useEffect(() => {
    if (selectedId) document.getElementById(`card-${selectedId}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedId])

  const selIdx = selectedId ? entries.findIndex((e) => e.id === selectedId) : -1
  const shown = entries.slice(0, Math.max(limit, selIdx + 1))

  const ok = !p.loading && !p.error
  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      <div aria-live="polite" className="px-1 py-2">
        {!p.error && (
          <h2 className="text-section font-semibold text-ink-strong">{p.loading ? t('map.loading') : t('map.results', { count: entries.length })}</h2>
        )}
        {ok && p.hsFilter && <p className="text-caption text-ink-muted">{t('map.suppliers', { code: p.hsFilter })}</p>}
        {ok && p.distances && entries.length > 0 && <p className="text-caption text-ink-muted">{t('map.sortDistance')}</p>}
        {ok && p.fromCache && <p className="text-caption text-ink-muted">{t('map.saved')}</p>}
      </div>
      {p.loading && !p.error && <Skeletons />}
      {ok && entries.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Icon svg={emptyIcon} className="size-12 text-ink-muted" />
          <p className="font-semibold text-ink-strong">{t('map.emptyTitle')}</p>
          <p className="text-sm text-ink-muted">{t('map.emptyBody')}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm">{t('map.try')}</span>
            {[t('home.chipFeed'), t('home.chipHs')].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => p.onTry(w)}
                className="min-h-touch rounded-full border border-brand-500 bg-brand-50 px-4 text-sm font-semibold"
              >
                <bdi>{w}</bdi>
              </button>
            ))}
          </div>
        </div>
      )}
      {ok && entries.length > 0 && (
        <ul className="flex flex-col gap-3">
          {shown.map((e) => (
            <li key={e.id}>
              <FactoryCard
                entry={e}
                lang={p.lang}
                selected={e.id === selectedId}
                distanceKm={p.distances?.get(e.id)}
                showNeeds={p.desktop}
                onSelect={p.onSelect}
              />
            </li>
          ))}
        </ul>
      )}
      {shown.length < entries.length && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="mt-3 min-h-touch w-full rounded border border-line text-sm font-semibold"
        >
          {t('map.showMore')}
        </button>
      )}
    </div>
  )

  if (p.desktop) {
    return (
      <aside aria-label={t('map.resultsLabel')} className="flex w-[400px] shrink-0 flex-col border-s border-line bg-surface">
        {body}
      </aside>
    )
  }
  return (
    <section
      ref={sheet}
      aria-label={t('map.resultsLabel')}
      className={`absolute inset-x-0 bottom-0 z-[1050] flex flex-col rounded-t-(--radius-sheet) bg-surface shadow-(--shadow-sheet) transition-[height] ${
        expanded ? 'h-[85%]' : 'h-[40%]'
      }`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={t('map.sheetToggle')}
        onClick={() => setExpanded((x) => !x)}
        className="flex min-h-touch w-full shrink-0 items-center justify-center"
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-line-strong" />
      </button>
      {body}
    </section>
  )
}
