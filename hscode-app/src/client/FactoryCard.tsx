import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { HsBadge } from '../hs/HsBadge'
import type { IndexEntry } from '../lib/types'
import plant from '../assets/placeholders/photo-plant.svg'
import silo from '../assets/placeholders/photo-silo.svg'
import warehouse from '../assets/placeholders/photo-warehouse.svg'
import { areaLabel, pickName, sectorLabel, type Lang } from './labels'
import { useThumb } from './useThumb'

const PLACEHOLDERS = [plant, silo, warehouse]
const placeholder = (id: string) => PLACEHOLDERS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % PLACEHOLDERS.length]

type Props = {
  entry: IndexEntry
  lang: Lang
  selected?: boolean
  distanceKm?: number
  showNeeds?: boolean
  onSelect: (id: string) => void
}

export function FactoryCard({ entry: e, lang, selected, distanceKm, showNeeds, onSelect }: Props) {
  const { t } = useTranslation()
  const loc = useLocation()
  const { ref, src } = useThumb<HTMLDivElement>(e.id)
  const name = pickName(e.n, lang) || t('map.noName')
  const meta = [areaLabel(e.a, lang), sectorLabel(e.s, lang)].filter(Boolean).join(' · ')
  const made = e.m.slice(0, 3).map((p) => pickName(p.n, lang)).filter(Boolean)
  const needed = e.d.slice(0, 3)
  const dist =
    distanceKm === undefined
      ? ''
      : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(distanceKm)} ${t('map.km')}`

  return (
    <article
      id={`card-${e.id}`}
      aria-current={selected ? 'true' : undefined}
      className={`relative rounded-lg border-2 bg-surface p-3 ${selected ? 'border-brand-500' : 'border-line'}`}
    >
      <div className="flex min-h-touch items-start gap-3">
        <div ref={ref} className="size-16 shrink-0 overflow-hidden rounded bg-surface-alt">
          <img src={src ?? placeholder(e.id)} alt="" className="size-full object-cover" loading="lazy" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-body-sm font-semibold text-ink-strong">
              <button
                type="button"
                onClick={() => onSelect(e.id)}
                className="text-start after:absolute after:inset-0 after:content-['']"
              >
                <bdi>{name}</bdi>
              </button>
            </h3>
            {dist && <span className="shrink-0 text-caption text-ink-muted">{dist}</span>}
          </div>
          {e.x && (
            <span className="me-2 inline-block rounded-sm bg-amber-50 px-2 py-0.5 text-caption font-semibold text-amber-900">
              {t('map.demo')}
            </span>
          )}
          {meta && <p className="text-caption text-ink-muted">{meta}</p>}
          {made.length > 0 && (
            <p className="text-caption text-ink">
              {t('map.makes')}: {made.join(' · ')}
            </p>
          )}
        </div>
      </div>
      {showNeeds && needed.length > 0 && (
        <ul className="relative z-10 mt-2 flex flex-wrap gap-1 text-caption text-ink">
          <li className="me-1 font-semibold">{t('map.needs')}:</li>
          {needed.map((p, i) => (
            <li key={i} className="flex items-center gap-1">
              {pickName(p.n, lang)}
              {p.h && <HsBadge code={p.h} variant="needed" />}
            </li>
          ))}
        </ul>
      )}
      <Link
        to={`/f/${e.id}`}
        state={{ from: `${loc.pathname}${loc.search}` }}
        className="relative z-10 mt-2 inline-flex min-h-touch w-full items-center justify-center rounded bg-brand-500 px-4 text-sm font-semibold text-ink-strong"
      >
        {t('map.viewFactory')}
      </Link>
    </article>
  )
}
