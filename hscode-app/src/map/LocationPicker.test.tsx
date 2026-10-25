import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { initI18n, setLanguage } from '../i18n'

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Circle: ({ radius }: { radius: number }) => <div data-testid="circle" data-radius={radius} />,
  useMap: () => ({ setView: vi.fn(), getZoom: () => 16 }),
  Marker: ({
    position,
    eventHandlers,
  }: {
    position: [number, number]
    eventHandlers?: { dragend?: (e: unknown) => void }
  }) => (
    <button
      data-testid="marker"
      data-lat={position[0]}
      data-lng={position[1]}
      onClick={() => eventHandlers?.dragend?.({ target: { getLatLng: () => ({ lat: 30.5, lng: 31.5 }) } })}
    />
  ),
}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

const geo = vi.fn()
vi.mock('./useGeolocation', () => ({ useGeolocation: () => geo() }))

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

  it('drag sets pinMoved', async () => {
    geo.mockReturnValue({ status: 'denied', retry })
    render(<LocationPicker areaCenter={area} onChange={onChange} />)
    await userEvent.click(screen.getByTestId('marker'))
    expect(last()[0]).toMatchObject({ lat: 30.5, lng: 31.5, pinMoved: true })
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

  it('pin follows a later fix until moved, then only accuracy updates', async () => {
    geo.mockReturnValue({ status: 'pending', retry })
    const { rerender } = render(<LocationPicker areaCenter={area} onChange={onChange} />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '30')
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 30, retry })
    rerender(<LocationPicker areaCenter={area} onChange={onChange} />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '29.9')
    await userEvent.click(screen.getByTestId('marker')) // drag to 30.5
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.8, lng: 31.3 }, accuracyM: 10, retry })
    rerender(<LocationPicker areaCenter={area} onChange={onChange} />)
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '30.5')
    expect(last()[0]).toMatchObject({ lat: 30.5, lng: 31.5, accuracyM: 10, pinMoved: true })
  })

  it('My location re-centres on the fix and retries', async () => {
    geo.mockReturnValue({ status: 'ok', coords: { lat: 29.9, lng: 31.2 }, accuracyM: 12, retry })
    render(<LocationPicker areaCenter={area} onChange={onChange} />)
    await userEvent.click(screen.getByTestId('marker'))
    await userEvent.click(screen.getByRole('button', { name: 'My location' }))
    expect(retry).toHaveBeenCalled()
    expect(screen.getByTestId('marker')).toHaveAttribute('data-lat', '29.9')
    expect(last()[0]).toMatchObject({ lat: 29.9, lng: 31.2, pinMoved: false })
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
})
