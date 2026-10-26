import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { areas, sectors } from '../data'
import { BottomSheet } from '../ui/BottomSheet'
import { Icon } from '../ui/Icon'
import chevron from '../assets/icons/chevron-down.svg?raw'
import locate from '../assets/icons/locate.svg?raw'
import { areaLabel, sectorLabel, type Lang } from './labels'

type Kind = 'area' | 'sector'
type Props = {
  lang: Lang
  area: string
  sector: string
  near: boolean
  locating: boolean
  onArea: (id: string) => void
  onSector: (id: string) => void
  onNear: () => void
}

const chip =
  'inline-flex min-h-touch max-w-[calc(100vw-2rem)] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-sm font-semibold text-ink-strong shadow-sm'

export function FilterChips({ lang, area, sector, near, locating, onArea, onSector, onNear }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Kind | null>(null)

  const label = (k: Kind) => {
    const selected = k === 'area' ? area && areaLabel(area, lang) : sector && sectorLabel(sector, lang)
    return selected || t(k === 'area' ? 'map.chipArea' : 'map.chipSector')
  }
  const title = t(open === 'area' ? 'map.filterArea' : 'map.filterSector')
  const options =
    open === 'area'
      ? areas().map((a) => ({ id: a.id, label: a[lang] }))
      : sectors().map((s) => ({ id: s.id, label: s[lang] }))
  const current = open === 'area' ? area : sector
  const choose = (id: string) => {
    if (open === 'area') onArea(id)
    else onSector(id)
    setOpen(null)
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
      {(['area', 'sector'] as const).map((k) => {
        const on = k === 'area' ? !!area : !!sector
        return (
          <button
            key={k}
            type="button"
            aria-haspopup="dialog"
            title={label(k)}
            onClick={() => setOpen(k)}
            className={`${chip} ${on ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface'}`}
          >
            <span className="min-w-0 max-w-[14rem] truncate">{label(k)}</span>
            <Icon svg={chevron} />
          </button>
        )
      })}
      <button
        type="button"
        aria-pressed={near}
        onClick={onNear}
        className={`${chip} ${near ? 'border-brand-500 bg-brand-500' : 'border-line bg-surface'}`}
      >
        <span className="inline-flex size-4 shrink-0 items-center justify-center">
          {locating ? (
            <span
              role="status"
              aria-label={t('map.locating')}
              className="size-full animate-spin rounded-full border-2 border-ink-strong border-t-transparent"
            />
          ) : (
            <Icon svg={locate} className="size-full" />
          )}
        </span>
        {t('map.nearMe')}
      </button>

      <BottomSheet open={open !== null} title={title} onClose={() => setOpen(null)}>
        <div role="radiogroup" aria-label={title} className="flex-1 overflow-auto px-4 py-2">
          {[{ id: '', label: t('map.all') }, ...options].map((o) => (
            <label key={o.id} className="flex min-h-touch cursor-pointer items-center gap-3 text-body">
              <input
                type="radio"
                name="filter"
                className="size-5 accent-brand-600"
                checked={current === o.id}
                onChange={() => choose(o.id)}
              />
              <bdi>{o.label}</bdi>
            </label>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
