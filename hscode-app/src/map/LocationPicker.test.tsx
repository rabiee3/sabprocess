import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { initI18n, setLanguage } from '../i18n'

let mapClick: ((e: { latlng: { lat: number; lng: number } }) => void) | undefined
const fireClick = (lat: number, lng: number) => act(() => mapClick?.({ latlng: { lat, lng } }))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Circle: ({ radius }: { radius: number }) => <div data-testid="circle" data-radius={radius} />,
  useMap: () => ({ setView: vi.fn(), getZoom: () => 16 }),
  useMapEvents: (h: { click: typeof mapClick }) => {
    mapClick = h.click
    return {}
  },
  Marker: ({ position, draggable }: { position: [number, number]; draggable?: boolean }) => (
    <div data-testid="marker" data-lat={position[0]} data-lng={position[1]} data-draggable={String(!!draggable)} />
  ),
}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

const geo = vi.fn()
vi.mock('./useGeolocation', () => ({ useGeolocation: (o: unknown) => geo(o) }))

import { LocationPicker } from './LocationPicker'

const area = { lat: 30.0, lng: 31.0 }
const retry = vi.fn()
const onChange = vi.fn()
const last = () => onChange.mock.calls.at(-1)!

describe('LocationPicker', () => {
  beforeEach(async () => {
    initI18n()
    await setLanguage('en')
    onChange.mockReset()
    retry.mockReset()
    geo.mockReturnValue({ status: 'pending', retry })
  })

  it('denied: starts at area centre with gpsOff banner', () => {
    geo.mockReturnValue({ status: 'denied', retry })
    render(<LocationPicker areaCenter={area} onChange={onChange} />)
    const m = screen.getByTestId('marker')
    expect(m).toHaveAttribute('data-lat', '30')
    expect(m).toHaveAttribute('data-lng', '31')
    expect(screen.getByText(/Location is off/)).toBeInTheDocument()
    expect(last()[0]).toEqual({ lat: 30, lng: 31, accuracyM: null, pinMoved: false })
    expect(last()[1]).toBe('denied')
  })

  it('nudge north sets pinMoved', async () => {
    geo.mockReturnValue({ status: 'denied', retry })
    render(<LocationPicker areaCenter={area} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Move pin north' }))
    const [loc] = last()
    expect(loc.pinMoved).toBe(true)
    expect(loc.lat).toBeCloseTo(30.000045, 6)
    expect(loc.lng).toBe(31)
    await userEvent.click(screen.getByRole('button', { name: 'Move pin east' }))
    expect(last()[0].lng).toBeCloseTo(31 + 0.000045 / Math.cos((30.000045 * Math.PI) / 180), 7)
  })

  it('a map click places the pin by hand: pinMoved, accuracy null', () => {
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 12, retry })
    render(<LocationPicker areaCenter={area} onChange={onChange} />)
    fireClick(30.5, 31.5)
    expect(last()[0]).toEqual({ lat: 30.5, lng: 31.5, accuracyM: null, pinMoved: true })
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '30.5')
  })

  it('new mode: after a tap there is no live GPS circle, label or weak banner, only "Placed by hand"', () => {
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 80, retry })
    render(<LocationPicker areaCenter={area} onChange={onChange} />)
    expect(screen.getByTestId('circle')).toBeInTheDocument()
    expect(screen.getByText(/signal is weak/)).toBeInTheDocument()
    fireClick(30.5, 31.5)
    expect(screen.queryByTestId('circle')).toBeNull()
    expect(screen.queryByText(/GPS ±/)).toBeNull()
    expect(screen.queryByText(/signal is weak/)).toBeNull()
    expect(screen.getByText('Placed by hand')).toBeInTheDocument()
  })

  it('the marker is not draggable', () => {
    render(<LocationPicker areaCenter={area} onChange={onChange} />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-draggable', 'false')
  })

  it('value-backed: a click replaces the stored pin and its circle', () => {
    const value = { lat: 28, lng: 30, accuracyM: 7, pinMoved: false }
    render(<LocationPicker areaCenter={area} value={value} onChange={onChange} gps={false} />)
    expect(screen.getByTestId('circle')).toBeInTheDocument()
    fireClick(28.1, 30.1)
    expect(screen.queryByTestId('circle')).toBeNull()
    expect(last()[0]).toEqual({ lat: 28.1, lng: 30.1, accuracyM: null, pinMoved: true })
  })

  it('GPS fix places the pin unmoved, with accuracy and circle', () => {
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 12, retry })
    render(<LocationPicker areaCenter={area} onChange={onChange} />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '29.9')
    expect(last()[0]).toEqual({ lat: 29.9, lng: 31.2, accuracyM: 12, pinMoved: false })
    expect(last()[1]).toBe('ok')
    expect(screen.getByTestId('circle')).toHaveAttribute('data-radius', '12')
    expect(screen.getByText(/GPS ±/).closest('[dir="ltr"]')).not.toBeNull()
    expect(screen.queryByText(/signal is weak/)).toBeNull()
  })

  it('accuracy 80 shows weak banner', () => {
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 80, retry })
    render(<LocationPicker areaCenter={area} onChange={onChange} />)
    expect(screen.getByText(/signal is weak/)).toBeInTheDocument()
  })

  it('pin follows a later fix until tapped, then stays put with accuracy null', async () => {
    geo.mockReturnValue({ status: 'pending', retry })
    const { rerender } = render(<LocationPicker areaCenter={area} onChange={onChange} />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '30')
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 30, retry })
    rerender(<LocationPicker areaCenter={area} onChange={onChange} />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '29.9')
    fireClick(30.5, 31.5)
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.8, lng: 31.3 }, accuracyM: 10, retry })
    rerender(<LocationPicker areaCenter={area} onChange={onChange} />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '30.5')
    expect(last()[0]).toEqual({ lat: 30.5, lng: 31.5, accuracyM: null, pinMoved: true })
  })

  it('My location re-centres on the fix and retries', async () => {
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 12, retry })
    render(<LocationPicker areaCenter={area} onChange={onChange} />)
    fireClick(30.5, 31.5)
    await userEvent.click(screen.getByRole('button', { name: 'My location' }))
    expect(retry).toHaveBeenCalled()
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '29.9')
    expect(last()[0]).toMatchObject({ lat: 29.9, lng: 31.2, pinMoved: false })
  })

  it('a stored value is never replaced by a GPS fix; My location moves it deliberately', async () => {
    geo.mockReturnValue({ status: 'pending', retry })
    const value = { lat: 28, lng: 30, accuracyM: 7, pinMoved: false }
    const { rerender } = render(<LocationPicker areaCenter={area} value={value} onChange={onChange} />)
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 12, retry })
    rerender(<LocationPicker areaCenter={area} value={value} onChange={onChange} />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '28')
    for (const [loc] of onChange.mock.calls) {
      expect(loc.lat).toBe(28)
      expect(loc.pinMoved).toBe(false)
    }
    expect(last()[0]).toEqual({ lat: 28, lng: 30, accuracyM: 7, pinMoved: false })
    expect(screen.getByText('GPS ±7 m')).toBeInTheDocument() // the stored accuracy, not the live fix
    expect(screen.queryByText(/GPS ±12/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'My location' }))
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '29.9')
    expect(last()[0]).toEqual({ lat: 29.9, lng: 31.2, accuracyM: 12, pinMoved: true })
  })

  it('value-backed: tap or nudge emits accuracyM null', async () => {
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 12, retry })
    const value = { lat: 28, lng: 30, accuracyM: 7, pinMoved: false }
    render(<LocationPicker areaCenter={area} value={value} onChange={onChange} />)
    fireClick(30.5, 31.5)
    expect(last()[0]).toEqual({ lat: 30.5, lng: 31.5, accuracyM: null, pinMoved: true })
    await userEvent.click(screen.getByRole('button', { name: 'Move pin north' }))
    expect(last()[0].accuracyM).toBeNull()
  })

  it('value-backed: My location snapshots the fix; later fixes do not change the emitted record', async () => {
    const value = { lat: 28, lng: 30, accuracyM: 7, pinMoved: false }
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 12, retry })
    const { rerender } = render(<LocationPicker areaCenter={area} value={value} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'My location' }))
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.8, lng: 31.3 }, accuracyM: 3, retry })
    rerender(<LocationPicker areaCenter={area} value={value} onChange={onChange} />)
    expect(last()[0]).toEqual({ lat: 29.9, lng: 31.2, accuracyM: 12, pinMoved: true })
  })

  it('value-backed: My location with no fix changes nothing that is emitted', async () => {
    const value = { lat: 28, lng: 30, accuracyM: 7, pinMoved: false }
    geo.mockReturnValue({ status: 'pending', retry })
    const { rerender } = render(<LocationPicker areaCenter={area} value={value} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'My location' }))
    expect(retry).toHaveBeenCalled()
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 12, retry })
    rerender(<LocationPicker areaCenter={area} value={value} onChange={onChange} />)
    expect(last()[0]).toEqual({ lat: 28, lng: 30, accuracyM: 7, pinMoved: false })
  })

  it('uses value as initial pin', () => {
    geo.mockReturnValue({ status: 'denied', retry })
    render(
      <LocationPicker
        areaCenter={area}
        value={{ lat: 28, lng: 30, accuracyM: null, pinMoved: true }}
        onChange={onChange}
      />,
    )
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '28')
  })

  it('value-backed: draws the stored accuracy circle, no gpsOff, ignores the live fix', () => {
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 12, retry })
    render(<LocationPicker value={{ lat: 28, lng: 30, accuracyM: 85, pinMoved: true }} areaCenter={area} onChange={onChange} gps={false} />)
    expect(screen.getByTestId('circle')).toHaveAttribute('data-radius', '85')
    expect(screen.getByText('GPS ±85 m')).toBeInTheDocument()
    expect(screen.queryByText(/Location is off/)).toBeNull()
    expect(screen.queryByText(/GPS signal is weak/)).toBeNull()
  })

  it('gps={false}: geolocation is disabled and My location is absent', () => {
    geo.mockReturnValue({ status: 'unavailable', retry })
    render(<LocationPicker value={{ lat: 28, lng: 30, accuracyM: null, pinMoved: false }} areaCenter={area} onChange={onChange} gps={false} />)
    expect(geo).toHaveBeenCalledWith({ enabled: false })
    expect(screen.queryByRole('button', { name: 'My location' })).toBeNull()
    expect(screen.queryByText(/Location is off/)).toBeNull()
    expect(screen.queryByTestId('circle')).toBeNull()
  })
})
