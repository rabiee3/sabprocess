import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Marker } from 'react-leaflet'
import { Link } from 'react-router'
import { areas } from '../data'
import type { Factory } from '../lib/types'
import { MapView } from '../map/MapView'
import { pinIcon } from '../map/pins'
import { factoryFlags } from './flags'
import { isSafeImage } from './safeImage'
import { displayName, formatDate } from './reviewForm'

const CAIRO = { lat: 30.0444, lng: 31.2357 }

type Props = {
  items: Factory[]
  selected?: string
  surveyors: Map<string, string>
  onSelect: (fid: string) => void
}

export function QueuePane({ items, selected, surveyors, onSelect }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const icons = useMemo(() => ({ default: pinIcon('default'), selected: pinIcon('selected'), flagged: pinIcon('flagged') }), [])
  const area = (f: Factory) => {
    const a = areas().find((x) => x.id === f.area)
    return f.area === 'other' ? (f.areaOther ?? '') : ((lang.startsWith('ar') ? a?.ar : a?.en) ?? f.area)
  }
  return (
    <div className="flex flex-col gap-4">
      <div role="region" aria-label={t('admin.review.mapLabel')}>
        <MapView center={items[0]?.location ?? CAIRO} zoom={10} className="h-56 w-full overflow-hidden rounded">
          {items.map((f) => (
            <Marker
              key={f.id}
              position={[f.location.lat, f.location.lng]}
              icon={f.id === selected ? icons.selected : factoryFlags(f).length > 0 ? icons.flagged : icons.default}
              title={displayName(f.name, lang)}
              eventHandlers={{ click: () => onSelect(f.id) }}
            />
          ))}
        </MapView>
      </div>
      <ul aria-label={t('admin.review.queueLabel')} className="flex flex-col gap-2">
        {items.map((f) => {
          const flags = factoryFlags(f)
          const isSel = f.id === selected
          return (
            <li key={f.id}>
              <Link
                to={`/admin/review/${f.id}`}
                aria-current={isSel ? 'true' : undefined}
                className={`flex min-h-touch gap-3 rounded border p-3 ${isSel ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface'}`}
              >
                {isSafeImage(f.thumb) ? (
                  <img src={f.thumb} alt="" loading="lazy" className="size-16 shrink-0 rounded object-cover" />
                ) : (
                  <span aria-hidden="true" className="size-16 shrink-0 rounded bg-surface-alt" />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <bdi className="truncate font-semibold text-ink-strong">
                    {displayName(f.name, lang, t('survey.list.untitled'))}
                  </bdi>
                  <span className="text-caption text-ink-subtle">
                    <bdi>{surveyors.get(f.createdBy) ?? t('admin.review.unknownSurveyor')}</bdi> · {formatDate(f.createdAt, lang)}
                  </span>
                  <span className="truncate text-caption text-ink">
                    <bdi>{area(f)}</bdi>
                  </span>
                  {flags.length > 0 && (
                    <span className="flex flex-wrap gap-1">
                      {flags.map((flag) => (
                        <span key={flag} className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                          {t(`admin.review.flag.${flag}`)}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
