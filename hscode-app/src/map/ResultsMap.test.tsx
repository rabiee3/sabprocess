import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

const map = {
  fitBounds: vi.fn(),
  setView: vi.fn(),
  panTo: vi.fn(),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
}
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  useMap: () => map,
  Marker: ({ position, icon, title }: { position: [number, number]; icon?: { options: { html?: string } }; title?: string }) => (
    <div data-testid="rl-marker" title={title} data-lat={position[0]} data-html={icon?.options.html ?? ''} />
  ),
}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('leaflet.markercluster/dist/MarkerCluster.css', () => ({}))
vi.mock('leaflet.markercluster', () => ({}))

type Marker = { icon: { options: { html: string } }; click: () => void }
const { created, group, factory } = vi.hoisted(() => {
  const group = {
    layers: [] as Marker[],
    clearLayers: vi.fn(() => {
      group.layers = []
    }),
    addLayers: vi.fn((ms: Marker[]) => {
      group.layers.push(...ms)
    }),
  }
  return { created: [] as Marker[], group, factory: vi.fn((_opts: Record<string, unknown>) => group) }
})
vi.mock('leaflet', async (orig) => {
  const L = ((await orig()) as { default: typeof import('leaflet') }).default
  const marker = (_ll: [number, number], o: { icon: Marker['icon'] }) => {
    let click = () => {}
    const m = {
      icon: o.icon,
      click: () => click(),
      on: (_e: string, h: () => void) => {
        click = h
        return m
      },
    }
    created.push(m)
    return m
  }
  const patched = { ...L, marker, markerClusterGroup: factory }
  return { default: patched, ...patched }
})

import { initI18n } from '../i18n'
import { ResultsMap } from './ResultsMap'
import { ClusterLayer } from './ClusterLayer'
import { clusterIcon } from './clusterIcon'
import type { IndexEntry } from '../lib/types'

const e = (id: string, lat: number, lng: number): IndexEntry => ({ id, n: { en: id, ar: id }, lat, lng, a: 'x', m: [], d: [] })

beforeEach(() => {
  initI18n()
  for (const f of Object.values(map)) f.mockClear()
  created.length = 0
  group.layers = []
  group.clearLayers.mockClear()
  group.addLayers.mockClear()
  factory.mockClear()
})

describe('ClusterLayer', () => {
  it('creates the group once with the pinned options and adds N markers', () => {
    const pts = [
      { id: '1', lat: 1, lng: 1 },
      { id: '2', lat: 2, lng: 2 },
      { id: '3', lat: 3, lng: 3 },
    ]
    const { rerender } = render(<ClusterLayer points={pts} onSelect={() => {}} />)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory.mock.calls[0][0]).toMatchObject({ maxClusterRadius: 50, showCoverageOnHover: false, spiderfyOnMaxZoom: true })
    expect(map.addLayer).toHaveBeenCalledWith(group)
    expect(group.layers).toHaveLength(3)
    rerender(<ClusterLayer points={pts.slice(0, 2)} onSelect={() => {}} />)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(group.clearLayers).toHaveBeenCalled()
    expect(group.layers).toHaveLength(2)
  })

  it('removes the group on unmount', () => {
    const { unmount } = render(<ClusterLayer points={[]} onSelect={() => {}} />)
    unmount()
    expect(map.removeLayer).toHaveBeenCalledWith(group)
  })

  it('clicking a marker selects its id', () => {
    const onSelect = vi.fn()
    render(<ClusterLayer points={[{ id: 'a', lat: 5, lng: 5 }]} onSelect={onSelect} />)
    created[0].click()
    expect(onSelect).toHaveBeenCalledWith('a')
  })

  it('the selected marker is kept out of the cluster group and drawn with the selected pin', () => {
    const pts = [
      { id: 'a', lat: 1, lng: 1 },
      { id: 'b', lat: 2, lng: 2 },
    ]
    render(<ClusterLayer points={pts} selectedId="b" onSelect={() => {}} />)
    expect(group.layers).toHaveLength(1)
    const sel = screen.getByTestId('rl-marker')
    expect(sel).toHaveAttribute('data-lat', '2')
    expect(sel.getAttribute('data-html')).toContain('<svg')
    // the pin differs from the default pin used inside the group
    expect(sel.getAttribute('data-html')).not.toBe(group.layers[0].icon.options.html)
  })

  it('the selected marker carries the factory name as its title', () => {
    render(<ClusterLayer points={[{ id: 'a', lat: 1, lng: 1, label: 'Delta Mill' }]} selectedId="a" onSelect={() => {}} />)
    expect(screen.getByTestId('rl-marker')).toHaveAttribute('title', 'Delta Mill')
  })

  it('flagged points use the flagged pin', () => {
    render(
      <ClusterLayer
        points={[
          { id: 'a', lat: 1, lng: 1, flagged: true },
          { id: 'b', lat: 2, lng: 2 },
        ]}
        onSelect={() => {}}
      />,
    )
    expect(created[0].icon.options.html).not.toBe(created[1].icon.options.html)
  })

  it('cluster icon sizes by count and shows only the number', () => {
    const size = (n: number) => clusterIcon(n).options.iconSize
    expect(size(5)).toEqual([40, 40])
    expect(size(10)).toEqual([48, 48])
    expect(size(99)).toEqual([48, 48])
    expect(size(100)).toEqual([56, 56])
    const html = clusterIcon(7).options.html as string
    expect(html).toContain('>7<')
    expect(html).toContain('#ffc53d')
    expect(html).toContain('#1f2224')
  })
})

describe('ResultsMap', () => {
  it('fits bounds when the entry ids change, not on re-render', () => {
    const a = [e('1', 29.9, 30.9), e('2', 30.1, 31.1)]
    const { rerender } = render(<ResultsMap entries={a} onSelect={() => {}} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    expect(map.fitBounds.mock.calls[0][1]).toEqual({ padding: [40, 40], maxZoom: 15 })
    rerender(<ResultsMap entries={[...a]} onSelect={() => {}} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    rerender(<ResultsMap entries={[...a, e('3', 30.5, 31.5)]} onSelect={() => {}} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(2)
  })

  it('with no entries views the 6th of October default', () => {
    render(<ResultsMap entries={[]} onSelect={() => {}} />)
    expect(map.setView).toHaveBeenCalledWith([29.96, 30.94], 12)
    expect(map.fitBounds).not.toHaveBeenCalled()
  })

  it('selecting pans without refitting', () => {
    const a = [e('1', 29.9, 30.9), e('2', 30.1, 31.1)]
    const { rerender } = render(<ResultsMap entries={a} onSelect={() => {}} />)
    rerender(<ResultsMap entries={a} selectedId="2" onSelect={() => {}} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    expect(map.panTo).toHaveBeenCalledWith([30.1, 31.1])
  })

  it('shows the my-location dot only with userPos', () => {
    const a = [e('1', 29.9, 30.9)]
    const { rerender } = render(<ResultsMap entries={a} onSelect={() => {}} />)
    expect(screen.queryByTestId('rl-marker')).toBeNull()
    rerender(<ResultsMap entries={a} userPos={{ lat: 30, lng: 31 }} onSelect={() => {}} />)
    expect(screen.getByTestId('rl-marker')).toHaveAttribute('data-lat', '30')
  })
})

describe('ResultsMap fit key', () => {
  it('does not refit when the same entries are only reordered (Near me)', () => {
    const a = [e('1', 29.9, 30.9), e('2', 30.1, 31.1), e('3', 30.2, 31.2)]
    const { rerender } = render(<ResultsMap entries={a} onSelect={() => {}} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    rerender(<ResultsMap entries={[a[2], a[0], a[1]]} onSelect={() => {}} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(1)
  })
})
