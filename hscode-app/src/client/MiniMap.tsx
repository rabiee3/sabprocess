import { Marker } from 'react-leaflet'
import { useTranslation } from 'react-i18next'
import { MapView } from '../map/MapView'
import { pinIcon } from '../map/pins'

/** A static map with one pin and a Directions link into Google Maps. */
export function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby="loc-h" className="flex flex-col gap-2">
      <h2 id="loc-h" className="text-body-sm font-semibold text-ink-strong">{t('factory.location')}</h2>
      {/* A group, not an img: the map keeps focusable OSM attribution links, which an img may not contain. */}
      <div role="group" aria-label={t('factory.mapLabel')} className="relative z-0 h-44 overflow-hidden rounded-lg border border-line">
        <MapView center={{ lat, lng }} zoom={15} interactive={false} className="size-full">
          <Marker position={[lat, lng]} icon={pinIcon('selected')} interactive={false} keyboard={false} />
        </MapView>
      </div>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-touch items-center justify-center rounded bg-brand-500 px-4 text-sm font-semibold text-ink-strong"
      >
        {t('factory.directions')}
      </a>
    </section>
  )
}
