import type { ReactNode } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

type Props = {
  center: { lat: number; lng: number }
  zoom: number
  children?: ReactNode
  className?: string
}

/** The map is never mirrored in RTL: the wrapper is always dir="ltr". */
export function MapView({ center, zoom, children, className }: Props) {
  return (
    <div dir="ltr" className={className}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} className="size-full" scrollWheelZoom zoomControl={false}>
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
