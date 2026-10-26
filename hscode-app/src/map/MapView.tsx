import type { ReactNode } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  center: { lat: number; lng: number }
  zoom: number
  children?: ReactNode
  className?: string
  /** false: a static map (no drag, zoom or keyboard). */
  interactive?: boolean
}

/** The map is never mirrored in RTL: the wrapper is always dir="ltr". */
export function MapView({ center, zoom, children, className, interactive = true }: Props) {
  return (
    <div dir="ltr" className={className}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} className="size-full"
        zoomControl={false}
        scrollWheelZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        boxZoom={interactive}
        keyboard={interactive}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
        />
        {children}
      </MapContainer>
    </div>
  )
}
