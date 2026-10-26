import { useId, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { DarkBackdrop } from '../../ui/DarkBackdrop'
import { Icon } from '../../ui/Icon'
import { LangToggle } from '../../ui/LangToggle'
import { Logo } from '../../ui/Logo'
import mapArt from '../../assets/map/map-placeholder.svg'
import pinDefault from '../../assets/map/pin-default.svg'
import pinSelected from '../../assets/map/pin-selected.svg'
import siloPhoto from '../../assets/placeholders/photo-silo.svg'
import searchIcon from '../../assets/icons/search.svg?raw'
import closeIcon from '../../assets/icons/close.svg?raw'
import { useFocusTrap } from './useFocusTrap'

const CHIP =
  'inline-flex min-h-touch items-center rounded-full border border-white/40 px-4 text-sm font-semibold text-white hover:bg-white/10'

const PINS = [
  { cls: 'start-[22%] top-[10%]', src: pinDefault },
  { cls: 'start-[44%] top-[24%]', src: pinSelected },
  { cls: 'start-[70%] top-[16%]', src: pinDefault },
  { cls: 'start-[84%] top-[44%]', src: pinDefault },
  { cls: 'start-[36%] top-[52%]', src: pinDefault },
]

/**
 * The first-visit intro (the former splash) as a full-screen modal over the map.
 * One staff link only (surveyors); there is deliberately no admin link.
 */
export function IntroOverlay({ onDismiss, onSearch }: { onDismiss: () => void; onSearch: (q: string) => void }) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  useFocusTrap(dialog, title, onDismiss)

  function search(text: string) {
    const query = text.trim()
    if (query) onSearch(query)
    onDismiss()
  }
  function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    search(q)
  }

  const chips = [t('home.chipFeed'), t('home.chipHs'), t('home.chipPlastic')]
  const features = [1, 2, 3]

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[1400] overflow-y-auto overscroll-contain"
    >
      <DarkBackdrop className="min-h-dvh">
        <div className="flex items-center gap-2 px-4 pt-3 lg:px-10 lg:pt-6">
          <Logo variant="dark" />
          <div className="ms-auto flex items-center gap-2 lg:gap-4">
            <LangToggle />
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t('intro.close')}
              className="inline-flex size-11 min-h-touch items-center justify-center rounded text-white hover:bg-white/10"
            >
              <Icon svg={closeIcon} className="size-6" />
            </button>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center gap-10 px-4 py-8 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-10">
          <div className="flex flex-col items-start gap-5">
            <span className="rounded bg-brand-500 px-3 py-1 text-caption font-semibold text-ink-strong">
              {t('home.badge')}
            </span>
            <h1
              id={titleId}
              ref={title}
              tabIndex={-1}
              className="text-4xl leading-tight font-bold text-white focus:outline-none lg:text-6xl lg:leading-[1.1]"
            >
              {t('home.headline')}
            </h1>
            <p className="max-w-xl text-body text-white/85 lg:text-xl">{t('home.subtitle')}</p>

            {/* Phone: the hero button closes the intro onto the map */}
            <button
              type="button"
              onClick={onDismiss}
              className="mt-2 inline-flex min-h-cta w-full items-center justify-center rounded bg-brand-500 px-6 text-body font-semibold text-ink-strong lg:hidden"
            >
              {t('home.findFactories')}
            </button>

            {/* Desktop: search + chips + features */}
            <form role="search" onSubmit={onSubmit} className="hidden w-full max-w-xl gap-3 lg:flex">
              <label className="relative flex-1">
                <span className="sr-only">{t('home.searchLabel')}</span>
                <Icon
                  svg={searchIcon}
                  className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
                />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('home.searchPlaceholder')}
                  className="min-h-cta w-full rounded bg-surface ps-12 pe-3 text-body text-ink-strong placeholder:text-ink-muted"
                />
              </label>
              <button
                type="submit"
                className="min-h-cta rounded bg-brand-500 px-6 text-body font-semibold whitespace-nowrap text-ink-strong"
              >
                {t('home.findFactories')}
              </button>
            </form>
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              <span className="text-sm text-white/85">{t('home.try')}</span>
              {chips.map((c) => (
                <Link
                  key={c}
                  to={`/?q=${encodeURIComponent(c)}`}
                  onClick={(e) => {
                    e.preventDefault()
                    search(c)
                  }}
                  className={CHIP}
                >
                  <span
                    lang={c === t('home.chipFeed') ? 'ar' : undefined}
                    dir={c === t('home.chipFeed') ? 'rtl' : undefined}
                  >
                    {c}
                  </span>
                </Link>
              ))}
            </div>
            <ul className="mt-4 hidden w-full max-w-xl grid-cols-3 gap-6 lg:grid">
              {features.map((n) => (
                <li key={n} className="border-t-2 border-brand-500 pt-3">
                  <h2 className="text-sm font-semibold text-white">{t(`home.f${n}Title`)}</h2>
                  <p className="mt-1 text-caption text-white/80">{t(`home.f${n}Body`)}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* Desktop: static map illustration with a sample factory card */}
          <div className="relative hidden lg:block">
            <div className="relative aspect-[4/3.4] overflow-hidden rounded-lg shadow-md" dir="ltr">
              <img src={mapArt} alt="" className="size-full object-cover" />
              {PINS.map((p, i) => (
                <img key={i} src={p.src} alt="" className={`absolute w-8 ${p.cls}`} />
              ))}
            </div>
            <div className="absolute inset-x-6 -bottom-8 flex items-center gap-4 rounded-md bg-surface p-4 shadow-md">
              <img src={siloPhoto} alt="" className="size-[72px] shrink-0 rounded object-cover" />
              <div className="min-w-0 text-start">
                <p className="text-body font-semibold text-ink-strong">{t('home.sampleName')}</p>
                <p className="text-caption text-ink-subtle">{t('home.sampleMeta')}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-caption">
                  <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-900">
                    {t('home.sampleMakes')} <span dir="ltr" className="font-mono">2309</span>
                  </span>
                  <span className="rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-blue-800">
                    {t('home.sampleNeeds')} <span dir="ltr" className="font-mono">1005</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-white/15 px-4 py-3 text-sm text-white/85 lg:px-10 lg:py-5">
          <p>
            {t('home.by')}
            {' · '}
            <a href="https://sabprocess.com" dir="ltr" className="underline">
              sabprocess.com
            </a>
          </p>
          <Link to="/survey" className="inline-flex min-h-touch items-center font-semibold text-brand-500 underline">
            {t('home.surveyorCta')}
          </Link>
        </div>
      </DarkBackdrop>
    </div>
  )
}
