import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { Marker, useMap } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import { pinIcon } from './pins'
import { clusterIcon } from './clusterIcon'

export type ClusterPoint = { id: string; lat: number; lng: number; flagged?: boolean; label?: string }

type Props = {
  points: ClusterPoint[]
  selectedId?: string
  onSelect: (id: string) => void
}

export function ClusterLayer({ points, selectedId, onSelect }: Props) {
  const map = useMap()
  const { t } = useTranslation()
  const group = useRef<L.MarkerClusterGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  })

  // Effects run in order: the group is created first, then filled below.
  useEffect(() => {
    const g = L.markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) => clusterIcon(c.getChildCount()),
    })
    group.current = g
    map.addLayer(g)
    return () => {
      map.removeLayer(g)
      group.current = null
    }
  }, [map])

  // Cluster icons are plain divs Leaflet makes focusable buttons: give each its count as a name.
  useEffect(() => {
    const el = map.getPane?.('markerPane')
    if (!el || typeof MutationObserver === 'undefined') return
    const label = () =>
      el.querySelectorAll<HTMLElement>('.hs-cluster').forEach((c) =>
        c.setAttribute('aria-label', t('map.cluster', { count: Number(c.textContent) || 0 })),
      )
    const mo = new MutationObserver(label)
    mo.observe(el, { childList: true, subtree: true })
    label()
    return () => mo.disconnect()
  }, [map, t])

  // The selected pin is drawn outside the group so it never hides inside a cluster.
  useEffect(() => {
    const g = group.current
    if (!g) return
    g.clearLayers()
    g.addLayers(
      points
        .filter((p) => p.id !== selectedId)
        .map((p) =>
          L.marker([p.lat, p.lng], { icon: pinIcon(p.flagged ? 'flagged' : 'default'), title: p.label }).on('click', () => onSelectRef.current(p.id)),
        ),
    )
  }, [map, points, selectedId])

  const sel = selectedId ? points.find((p) => p.id === selectedId) : undefined
  return sel ? (
    <Marker
      position={[sel.lat, sel.lng]}
      icon={pinIcon('selected')}
      zIndexOffset={1000}
      title={sel.label}
      eventHandlers={{ click: () => onSelectRef.current(sel.id) }}
    />
  ) : null
}
