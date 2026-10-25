import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Circle, Marker, useMap } from 'react-leaflet'
import { Banner } from '../ui/Banner'
import type { FactoryLocation } from '../lib/types'
import arrowIcon from '../assets/icons/arrow-back.svg?raw'
import locateIcon from '../assets/icons/locate.svg?raw'
import { MapView } from './MapView'
import { pinIcon } from './pins'
import { useGeolocation, type GpsStatus } from './useGeolocation'

type LatLng = { lat: number; lng: number }

type Props = {
  value?: FactoryLocation
  areaCenter: LatLng
  onChange: (loc: FactoryLocation, gpsStatus: GpsStatus) => void
}

const NUDGE_DEG = 0.000045 // ~5 m
const WEAK_M = 50

type Dir = 'Up' | 'Down' | 'Left' | 'Right'
const DIRS: { dir: Dir; rotate: string; cell: string }[] = [
  { dir: 'Up', rotate: 'rotate-90', cell: 'col-start-2 row-start-1' },
  { dir: 'Left', rotate: '', cell: 'col-start-1 row-start-2' },
  { dir: 'Right', rotate: 'rotate-180', cell: 'col-start-3 row-start-2' },
  { dir: 'Down', rotate: '-rotate-90', cell: 'col-start-2 row-start-3' },
]

function nudge(p: LatLng, dir: Dir): LatLng {
  switch (dir) {
    case 'Up':
      return { lat: p.lat + NUDGE_DEG, lng: p.lng }
    case 'Down':
      return { lat: p.lat - NUDGE_DEG, lng: p.lng }
    // Left/right are west/east regardless of UI language: the map is never mirrored.
    case 'Left':
      return { lat: p.lat, lng: p.lng - NUDGE_DEG / Math.cos((p.lat * Math.PI) / 180) }
    case 'Right':
      return { lat: p.lat, lng: p.lng + NUDGE_DEG / Math.cos((p.lat * Math.PI) / 180) }
  }
}

function Recenter({ pos }: { pos: LatLng }) {
  const map = useMap()
  useEffect(() => {
    map.setView([pos.lat, pos.lng], map.getZoom())
  }, [map, pos.lat, pos.lng])
  return null
}

export function LocationPicker({ value, areaCenter, onChange }: Props) {
  const { t } = useTranslation()
  const gps = useGeolocation()
  const [userPin, setPin] = useState<LatLng>(() => value ?? areaCenter)
  // A stored value is a fixed starting pin: GPS fixes never replace it.
  const [fixed] = useState(!!value)
  // Value-backed mode: where the emitted accuracy comes from (stored value, a deliberate GPS fix, or a manual move).
  const [accSrc, setAccSrc] = useState<'stored' | 'fix' | 'manual'>('stored')
  const [fixAcc, setFixAcc] = useState<number | null>(null) // accuracy snapshot taken at the My location tap
  const [moved, setMoved] = useState(value?.pinMoved ?? false)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  const hasFix = gps.status === 'ok' && !!gps.coords
  const liveAccuracyM = gps.status === 'ok' && gps.accuracyM !== undefined ? gps.accuracyM : (value?.accuracyM ?? null)
  const accuracyM = liveAccuracyM // display only: banner, circle, label
  const emitAccuracyM = !fixed
    ? liveAccuracyM
    : accSrc === 'stored'
      ? (value?.accuracyM ?? null)
      : accSrc === 'fix'
        ? fixAcc
        : null

  // The pin follows the GPS fix until the surveyor moves it (or the saved value was moved).
  const pin: LatLng = !fixed && !moved && hasFix && gps.coords ? gps.coords : userPin

  useEffect(() => {
    onChangeRef.current({ lat: pin.lat, lng: pin.lng, accuracyM: emitAccuracyM, pinMoved: moved }, gps.status)
  }, [pin.lat, pin.lng, emitAccuracyM, moved, gps.status])

  const icon = useMemo(() => pinIcon('selected'), [])
  const handlers = useMemo(
    () => ({
      dragend: (e: { target: { getLatLng(): LatLng } }) => {
        const ll = e.target.getLatLng()
        setPin({ lat: ll.lat, lng: ll.lng })
        setMoved(true)
        setAccSrc('manual')
      },
    }),
    [],
  )

  function move(dir: Dir) {
    setPin(nudge(pin, dir))
    setMoved(true)
    setAccSrc('manual')
  }

  function myLocation() {
    if (gps.coords) {
      setPin({ lat: gps.coords.lat, lng: gps.coords.lng })
      setMoved(fixed)
      setAccSrc('fix')
      setFixAcc(gps.accuracyM ?? null)
    }
    gps.retry()
  }

  const gpsOff = gps.status === 'denied' || gps.status === 'unavailable' || gps.status === 'timeout'
  const weak = hasFix && accuracyM !== null && accuracyM > WEAK_M

  return (
    <section className="flex flex-col gap-3">
      {gpsOff && <Banner tone="warning">{t('survey.location.gpsOff')}</Banner>}
      {weak && <Banner tone="warning">{t('survey.location.weak')}</Banner>}

      <div className="relative">
        <MapView center={pin} zoom={16} className="h-72 w-full overflow-hidden rounded">
          <Recenter pos={pin} />
          {hasFix && accuracyM !== null && gps.coords && (
            <Circle center={[gps.coords.lat, gps.coords.lng]} radius={accuracyM} />
          )}
          <Marker position={[pin.lat, pin.lng]} icon={icon} title={t('survey.location.hint')} draggable eventHandlers={handlers} />
        </MapView>
        <button
          type="button"
          onClick={myLocation}
          aria-label={t('survey.location.myLocation')}
          className="absolute end-2 top-2 z-[1000] flex min-h-touch items-center gap-2 rounded bg-white px-3 text-sm font-medium text-ink-strong shadow"
        >
          <span aria-hidden="true" className="size-5" dangerouslySetInnerHTML={{ __html: locateIcon }} />
          {t('survey.location.myLocation')}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div dir="ltr" className="font-mono text-sm text-ink-strong">
          {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </div>
        {accuracyM !== null && hasFix && (
          <div dir="ltr" className="text-sm text-ink">
            {t('survey.location.accuracy', { m: Math.round(accuracyM) })}
          </div>
        )}
      </div>

      <div dir="ltr" className="mx-auto grid grid-cols-3 grid-rows-3 gap-1">
        {DIRS.map(({ dir, rotate, cell }) => (
          <button
            key={dir}
            type="button"
            onClick={() => move(dir)}
            aria-label={t(`survey.location.nudge${dir}`)}
            className={`${cell} flex min-h-touch min-w-11 items-center justify-center rounded bg-white shadow`}
          >
            <span
              aria-hidden="true"
              className={`size-6 ${rotate}`}
              dangerouslySetInnerHTML={{ __html: arrowIcon }}
            />
          </button>
        ))}
      </div>
    </section>
  )
}
