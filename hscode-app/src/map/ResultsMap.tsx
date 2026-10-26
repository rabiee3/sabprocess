import { useEffect, useMemo, useRef } from 'react'
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
}

const userIcon = L.divIcon({ html: myLocation, className: 'hs-me', iconSize: [28, 28], iconAnchor: [14, 14] })

function Viewport({ entries, selectedId }: Pick<Props, 'entries' | 'selectedId'>) {
  const map = useMap()
  const key = entries.map((e) => e.id).sort().join('|')
  const latest = useRef(entries)
  useEffect(() => {
    latest.current = entries
  })

  useEffect(() => {
    const list = latest.current
    if (list.length === 0) map.setView([DEFAULT_VIEW.lat, DEFAULT_VIEW.lng], DEFAULT_VIEW.zoom)
    else map.fitBounds(L.latLngBounds(list.map((e) => [e.lat, e.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 })
  }, [map, key])

  useEffect(() => {
    const e = selectedId ? latest.current.find((x) => x.id === selectedId) : undefined
    if (e) map.panTo([e.lat, e.lng])
  }, [map, selectedId])

  return null
}

export function ResultsMap({ entries, selectedId, onSelect, userPos, className }: Props) {
  const { i18n } = useTranslation()
  const ar = (i18n.resolvedLanguage ?? i18n.language) === 'ar'
  const points = useMemo(
    () => entries.map((e) => ({ id: e.id, lat: e.lat, lng: e.lng, label: (ar ? e.n.ar || e.n.en : e.n.en || e.n.ar) || undefined })),
    [entries, ar],
  )
  return (
    <MapView center={DEFAULT_VIEW} zoom={DEFAULT_VIEW.zoom} className={className}>
      <Viewport entries={entries} selectedId={selectedId} />
      <ClusterLayer points={points} selectedId={selectedId} onSelect={onSelect} />
      {userPos && <Marker position={[userPos.lat, userPos.lng]} icon={userIcon} interactive={false} keyboard={false} />}
    </MapView>
  )
}
