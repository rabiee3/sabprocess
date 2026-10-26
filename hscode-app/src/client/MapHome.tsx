import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ResultsMap } from '../map/ResultsMap'
import { distanceKm } from '../lib/geo'
import { formatHs } from '../lib/hs'
import type { IndexEntry } from '../lib/types'
import { filterEntries } from '../search/engine'
import { loadIndex, type IndexErrorCode } from '../search/indexSource'
import { useEngine } from '../search/useEngine'
import { useOnline } from '../ui/useOnline'
import { Banner } from '../ui/Banner'
import { useIsDesktop } from '../admin/useIsDesktop'
import { ClientHeader } from './ClientHeader'
import { FilterChips } from './FilterChips'
import { IntroOverlay } from './intro/IntroOverlay'
import { useIntro } from './intro/useIntro'
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
  const intro = useIntro()
  const navigate = useNavigate()
  const title = useRef<HTMLHeadingElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  // After a first-visit intro: the search box, except on touch screens, where focusing it would pop up the
  // keyboard over the map; there the map heading takes focus (screen readers announce it, nothing pops up).
  const introReturn = useCallback(() => {
    const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    return touch ? title.current : controls.current?.querySelector<HTMLElement>('[role="combobox"]')
  }, [])
  const nearMe = useNearMe()
  const [attempt, setAttempt] = useState(0)
  // The index load of the current attempt; a retry starts loading again until its own answer arrives.
  const [loaded, setLoad] = useState<{ attempt: number; load: Load } | null>(null)
  const load: Load = loaded?.attempt === attempt ? loaded.load : { status: 'loading' }
  // Near me requests made from the chip, and the one whose failure message was closed (or toggled off).
  const [nearAsked, setNearAsked] = useState(0)
  const [nearDismissed, setNearDismissed] = useState(0)
  // Phone: the results sheet's height, so the map fits its pins into the part the sheet does not cover.
  const [sheetPx, setSheetPx] = useState(() => Math.round(window.innerHeight * 0.4))

  useEffect(() => {
    let live = true
    // Cache first (spec §8): a newer index from the server swaps in later; the query, filters and selection live
    // in the URL, so they stay.
    const ready = (r: { entries: IndexEntry[]; fromCache: boolean }) =>
      live && setLoad({ attempt, load: { status: 'ready', entries: r.entries, fromCache: r.fromCache } })
    loadIndex(undefined, ready).then(
      ready,
      (e: unknown) => {
        const c = (e as { code?: IndexErrorCode })?.code
        if (live) setLoad({ attempt, load: { status: 'error', code: c && CODES.includes(c) ? c : 'generic' } })
      },
    )
    return () => {
      live = false
    }
  }, [attempt])

  const entries = load.status === 'ready' ? load.entries : null
  // Matching does not depend on the language: built once per loaded index (cached across mounts), never per
  // keystroke, and only when the browser is idle, so the pins paint first.
  const engine = useEngine(entries)
  const online = useOnline()
  // The saved-results note is for an offline visit; online, a cached index is being checked against the server.
  const fromCache = load.status === 'ready' && load.fromCache && !online
  // Until the engine is ready, a text query cannot run yet: the list waits (loading) instead of showing everything.
  const waiting = !!entries && !engine && !!q.trim()

  const nearOk = wantNear && nearMe.status === 'ok' && !!nearMe.pos
  const { results, distances } = useMemo(() => {
    if (!entries) return { results: [] as IndexEntry[], distances: undefined }
    // Pins render straight from the entries while the engine builds; filters need no engine.
    const found = engine ? engine.search(q, { area, sector, hs }) : q.trim() ? [] : filterEntries(entries, { area, sector, hs })
    if (!nearOk || !nearMe.pos) return { results: found, distances: undefined }
    const pos = nearMe.pos
    const d = new Map(found.map((e) => [e.id, distanceKm(pos, e)]))
    return { results: [...found].sort((a, b) => d.get(a.id)! - d.get(b.id)!), distances: d }
  }, [entries, engine, q, area, sector, hs, nearOk, nearMe.pos])

  // Denied / unavailable: untoggle (an effect: it changes the URL) and say why. The message is derived, not copied
  // into state: it belongs to the latest Near me request (counted on the chip) until closed or toggled off.
  const failed = nearMe.status === 'denied' || nearMe.status === 'unavailable' ? nearMe.status : null
  const nearFailed = wantNear ? failed : null
  useEffect(() => {
    if (nearFailed) set({ near: false })
  }, [nearFailed, set])
  const toast =
    failed && nearAsked > 0 && nearDismissed !== nearAsked ? t(failed === 'denied' ? 'map.nearDenied' : 'map.nearUnavailable') : null

  // A link with near=1 never prompts for location: drop it on arrival; only the chip asks.
  const arrived = useRef(false)
  useEffect(() => {
    if (arrived.current) return
    arrived.current = true
    if (wantNear && !nearMe.pos) set({ near: false })
  })

  const toggleNear = () => {
    if (wantNear) {
      // Toggled off while locating: a late failure of that request says nothing.
      setNearDismissed(nearAsked)
      return set({ near: false }, { push: true })
    }
    setNearAsked((n) => n + 1)
    set({ near: true }, { push: true })
    nearMe.request()
  }
  const select = useCallback((id: string) => set({ sel: id }, { push: !sel }), [set, sel])

  return (
    <div className="flex h-dvh flex-col bg-surface text-ink">
      <ClientHeader onAbout={intro.show} />
      {/* While the intro is open it owns the page's h1; the map region is inert (not the header, which holds ☰). */}
      <main className="flex min-h-0 flex-1" inert={intro.open}>
        <h1 ref={title} tabIndex={-1} className="sr-only">{t('map.title')}</h1>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-0 z-0 bg-map-bg">
            <ResultsMap
              entries={results}
              selectedId={sel}
              onSelect={select}
              userPos={nearOk ? nearMe.pos : undefined}
              className="size-full"
              desktop={desktop}
              topOverlayRef={controls}
              sheetPx={sheetPx}
            />
          </div>
          <div ref={controls} className="absolute inset-x-2 top-2 z-[1100] flex flex-col gap-2 lg:max-w-md">
            <SearchBar
              engine={engine}
              lang={lang}
              value={q || (hs ? formatHs(hs) : '')}
              onApply={(p) => set(p, { push: true })}
              onClear={() => set({ q: '', hs: '' }, { push: true })}
            />
            <FilterChips
              lang={lang}
              area={area}
              sector={sector}
              near={wantNear}
              locating={wantNear && nearMe.status === 'locating'}
              onArea={(id) => set({ area: id }, { push: true })}
              onSector={(id) => set({ sector: id }, { push: true })}
              onNear={toggleNear}
            />
            {toast && <Banner tone="warning" onClose={() => setNearDismissed(nearAsked)}>{toast}</Banner>}
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
              loading={load.status === 'loading' || waiting}
              error={load.status === 'error'}
              lang={lang}
              desktop={false}
              selectedId={sel}
              distances={distances}
              hsFilter={hs ? formatHs(hs) : undefined}
              fromCache={fromCache}
              onSelect={select}
              onTry={(w) => set({ q: w, hs: '' }, { push: true })}
              onHeight={setSheetPx}
            />
          )}
        </div>
        {desktop && (
          <ResultsSheet
            entries={results}
            loading={load.status === 'loading' || waiting}
              error={load.status === 'error'}
            lang={lang}
            desktop
            selectedId={sel}
            distances={distances}
            hsFilter={hs ? formatHs(hs) : undefined}
            fromCache={fromCache}
            onSelect={select}
            onTry={(w) => set({ q: w, hs: '' }, { push: true })}
          />
        )}
      </main>
      {intro.open && (
        <IntroOverlay
          onDismiss={intro.dismiss}
          onSearch={(text) => void navigate(`/?q=${encodeURIComponent(text)}`)}
          returnFocus={introReturn}
        />
      )}
    </div>
  )
}
