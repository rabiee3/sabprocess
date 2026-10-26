import { useEffect, useMemo, useRef, type RefObject } from 'react'
import L from 'leaflet'
import { useTranslation } from 'react-i18next'
import { Marker, useMap } from 'react-leaflet'
import { MapView } from './MapView'
import { ClusterLayer } from './ClusterLayer'
import myLocation from '../assets/map/my-location.svg?raw'
import type { IndexEntry } from '../lib/types'

const DEFAULT_VIEW = { lat: 29.96, lng: 30.94, zoom: 12 } // 6th of October

type Props = {
  entries: IndexEntry[]
  selectedId?: string
  onSelect: (id: string) => void
  userPos?: { lat: number; lng: number }
  className?: string
  /** Desktop keeps a plain 40px fit padding; a phone pads for its overlays (below). */
  desktop?: boolean
  /** Phone: the search and filter overlay at the top of the map; its bottom edge is the top padding. */
  topOverlayRef?: RefObject<HTMLElement | null>
  /** Phone: the current height of the results sheet over the bottom of the map. */
  sheetPx?: number
}

type Fit = Pick<Props, 'desktop' | 'topOverlayRef' | 'sheetPx'>

/** Top padding when the overlay has not been laid out (or measured as nothing). */
export const TOP_OVERLAY_FALLBACK_PX = 120
const SIDE_PX = 16

function fitOptions({ desktop = true, topOverlayRef, sheetPx = 0 }: Fit): L.FitBoundsOptions {
  if (desktop) return { padding: [40, 40], maxZoom: 15 }
  const el = topOverlayRef?.current
  const top = (el ? el.offsetTop + el.offsetHeight : 0) || TOP_OVERLAY_FALLBACK_PX
  return { paddingTopLeft: [SIDE_PX, top], paddingBottomRight: [SIDE_PX, sheetPx], maxZoom: 15 }
}

const userIcon = L.divIcon({ html: myLocation, className: 'hs-me', iconSize: [28, 28], iconAnchor: [14, 14] })

function Viewport({ entries, selectedId, ...fit }: Pick<Props, 'entries' | 'selectedId'> & Fit) {
  const map = useMap()
  const key = entries.map((e) => e.id).sort().join('|')
  const latest = useRef(entries)
  // Read at fit time only: a sheet or overlay size change on its own never refits the map.
  const latestFit = useRef(fit)
  useEffect(() => {
    latest.current = entries
    latestFit.current = fit
  })

  useEffect(() => {
    const list = latest.current
    if (list.length === 0) map.setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom)
    else map.fitBounds(L.latLngBounds(list.map((e) => [e.lat, e.lng] as [number, number])), fitOptions(latestFit.current))
  }, [map, key])

  useEffect(() => {
    const e = selectedId ? latest.current.find((x) => x.id === selectedId) : undefined
    if (e) map.panTo([e.lat, e.lng])
  }, [map, selectedId])

  return null
}

export function ResultsMap({ entries, selectedId, onSelect, userPos, className, desktop, topOverlayRef, sheetPx }: Props) {
  const { i18n } = useTranslation()
  const ar = (i18n.resolvedLanguage ?? i18n.language) === 'ar'
  const points = useMemo(
    () => entries.map((e) => ({ id: e.id, lat: e.lat, lng: e.lng, label: (ar ? e.n.ar || e.n.en : e.n.en || e.n.ar) || undefined })),
    [entries, ar],
  )
  return (
    <MapView center={DEFAULT_VIEW} zoom={DEFAULT_VIEW.zoom} className={className}>
      <Viewport entries={entries} selectedId={selectedId} desktop={desktop} topOverlayRef={topOverlayRef} sheetPx={sheetPx} />
      <ClusterLayer points={points} selectedId={selectedId} onSelect={onSelect} />
      {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={userIcon} interactive={false} keyboard={false} />}
    </MapView>
  )
}
