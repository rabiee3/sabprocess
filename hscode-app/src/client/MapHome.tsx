import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ResultsMap } from '../map/ResultsMap'
import { distanceKm } from '../lib/geo'
import { formatHs } from '../lib/hs'
import type { IndexEntry } from '../lib/types'
import { createEngine } from '../search/engine'
import { loadIndex, type IndexErrorCode } from '../search/indexSource'
import { Banner } from '../ui/Banner'
import { useIsDesktop } from '../admin/useIsDesktop'
import { ClientHeader } from './ClientHeader'
import { FilterChips } from './FilterChips'
import { ResultsSheet } from './ResultsSheet'
import { SearchBar } from './SearchBar'
import type { Lang } from './labels'
import { useMapState } from './useMapState'
import { useNearMe } from './useNearMe'

type Load =
  | { status: 'loading' }
  | { status: 'ready'; entries: IndexEntry[]; fromCache: boolean }
  | { status: 'error'; code: IndexErrorCode }

const CODES: IndexErrorCode[] = ['offline', 'denied', 'quota', 'generic']

export function Component() {
  const { t, i18n } = useTranslation()
  const lang: Lang = (i18n.resolvedLanguage ?? i18n.language) === 'ar' ? 'ar' : 'en'
  const state = useMapState()
  const { q, area, sector, hs, near: wantNear, sel, set } = state
  const desktop = useIsDesktop()
  const nearMe = useNearMe()
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setLoad({ status: 'loading' })
    loadIndex().then(
      (r) => live && setLoad({ status: 'ready', entries: r.entries, fromCache: r.fromCache }),
      (e: unknown) => {
        const c = (e as { code?: IndexErrorCode })?.code
        if (live) setLoad({ status: 'error', code: c && CODES.includes(c) ? c : 'generic' })
      },
    )
    return () => {
      live = false
    }
  }, [attempt])

  const entries = load.status === 'ready' ? load.entries : null
  // Matching does not depend on the language: built once per loaded index, never per keystroke.
  const engine = useMemo(() => (entries ? createEngine(entries, 'en') : null), [entries])

  const nearOk = wantNear && nearMe.status === 'ok' && !!nearMe.pos
  const { results, distances } = useMemo(() => {
    if (!engine) return { results: [] as IndexEntry[], distances: undefined }
    const found = engine.search(q, { area, sector, hs })
    if (!nearOk || !nearMe.pos) return { results: found, distances: undefined }
    const pos = nearMe.pos
    const d = new Map(found.map((e) => [e.id, distanceKm(pos, e)]))
    return { results: [...found].sort((a, b) => d.get(a.id)! - d.get(b.id)!), distances: d }
  }, [engine, q, area, sector, hs, nearOk, nearMe.pos])

  // Denied / unavailable: untoggle and say why.
  useEffect(() => {
    if (wantNear && (nearMe.status === 'denied' || nearMe.status === 'unavailable')) {
      set({ near: false })
      setToast(t(nearMe.status === 'denied' ? 'map.nearDenied' : 'map.nearUnavailable'))
    }
  }, [wantNear, nearMe.status, set, t])

  // A link with near=1 asks for the location once on arrival.
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    if (wantNear && nearMe.status === 'idle') nearMe.request()
  })

  const toggleNear = () => {
    if (wantNear) return set({ near: false })
    setToast(null)
    set({ near: true })
    nearMe.request()
  }
  const select = useCallback((id: string) => set({ sel: id }, { push: true }), [set])

  return (
    <div className="flex h-dvh flex-col bg-surface text-ink">
      <ClientHeader />
      <main className="flex min-h-0 flex-1">
        <h1 className="sr-only">{t('map.title')}</h1>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0 z-0 bg-map-bg">
            <ResultsMap
              entries={results}
              selectedId={sel}
              onSelect={select}
              userPos={nearOk ? nearMe.pos : undefined}
              className="size-full"
            />
          </div>
          <div className="absolute inset-x-2 top-2 z-[1100] flex flex-col gap-2 lg:max-w-md">
            <SearchBar
              engine={engine}
              lang={lang}
              value={q || (hs ? formatHs(hs) : '')}
              onApply={(p) => set(p)}
              onClear={() => set({ q: '', hs: '' })}
            />
            <FilterChips
              lang={lang}
              area={area}
              sector={sector}
              near={wantNear}
              locating={wantNear && nearMe.status === 'locating'}
              onArea={(id) => set({ area: id })}
              onSector={(id) => set({ sector: id })}
              onNear={toggleNear}
            />
            {toast && <Banner tone="warning" onClose={() => setToast(null)}>{toast}</Banner>}
            {load.status === 'error' && (
              <Banner tone="danger">
                <p>{t(`errors.${load.code}`)}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((n) => n + 1)}
                  className="mt-1 min-h-touch font-semibold underline"
                >
                  {t('map.retry')}
                </button>
              </Banner>
            )}
          </div>
          {!desktop && (
            <ResultsSheet
              entries={results}
              loading={load.status === 'loading'}
              lang={lang}
              desktop={false}
              selectedId={sel}
              distances={distances}
              hsFilter={hs ? formatHs(hs) : undefined}
              fromCache={load.status === 'ready' && load.fromCache}
              onSelect={select}
              onTry={(w) => set({ q: w, hs: '' })}
            />
          )}
        </div>
        {desktop && (
          <ResultsSheet
            entries={results}
            loading={load.status === 'loading'}
            lang={lang}
            desktop
            selectedId={sel}
            distances={distances}
            hsFilter={hs ? formatHs(hs) : undefined}
            fromCache={load.status === 'ready' && load.fromCache}
            onSelect={select}
            onTry={(w) => set({ q: w, hs: '' })}
          />
        )}
      </main>
    </div>
  )
}
