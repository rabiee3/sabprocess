import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Banner } from '../ui/Banner'
import type { Factory } from '../lib/types'
import type { PhotoData } from '../survey/types'
import { ClientHeader } from './ClientHeader'
import { ContactsPanel } from './ContactsPanel'
import { FactoryProducts } from './FactoryProducts'
import { getCached, setCached, type LoadedFactory } from './factoryCache'
import { isFromMap } from './isFromMap'
import { MiniMap } from './MiniMap'
import { PhotoCarousel } from './PhotoCarousel'
import { areaLabel, pickName, sectorLabel, type Lang } from './labels'
import { loadPhotos, loadPublicFactory } from './publicRepo'

type State = { status: 'loading' } | { status: 'error' } | { status: 'missing' } | { status: 'ready'; factory: Factory }

const BACK = 'inline-flex min-h-touch items-center gap-1 px-4 text-sm font-semibold text-ink-strong'
const shell = 'mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-10'

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface text-ink">
      <ClientHeader />
      <main className="flex-1">{children}</main>
    </div>
  )
}

export function Component() {
  const { t, i18n } = useTranslation()
  const lang: Lang = (i18n.resolvedLanguage ?? i18n.language) === 'ar' ? 'ar' : 'en'
  const { id = '' } = useParams()
  const location = useLocation()
  const from = (location.state as { from?: unknown } | null)?.from
  const navigate = useNavigate()
  const fromMap = isFromMap(from)
  // A factory already seen this session renders at once from the session cache (spec §8).
  const hit = getCached(id)
  const [state, setState] = useState<State>(hit ? { status: 'ready', factory: hit.factory } : { status: 'loading' })
  const [photos, setPhotos] = useState<PhotoData[] | null>(hit?.photos ?? null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    const fetchPhotos = (factory: LoadedFactory) =>
      loadPhotos(id).then(
        (p) => {
          setCached(id, { factory, photos: p })
          if (live) setPhotos(p)
        },
        () => live && setPhotos([]),
      )
    const cached = getCached(id)
    if (cached) {
      setState({ status: 'ready', factory: cached.factory })
      setPhotos(cached.photos)
      if (!cached.photos) void fetchPhotos(cached.factory)
    } else {
      setState({ status: 'loading' })
      setPhotos(null)
      loadPublicFactory(id).then(
        (factory) => {
          if (factory) setCached(id, { factory, photos: null })
          if (!live) return
          setState(factory ? { status: 'ready', factory } : { status: 'missing' })
          if (factory) void fetchPhotos(factory)
        },
        () => live && setState({ status: 'error' }),
      )
    }
    return () => {
      live = false
    }
  }, [id, attempt])

  if (state.status === 'loading') {
    return <Page><h1 className={`${shell} pt-6 text-base font-normal text-ink-muted`}>{t('factory.loading')}</h1></Page>
  }
  if (state.status === 'error') {
    return (
      <Page>
        <div className={`${shell} pt-6`}>
          <h1 className="sr-only">{t('factory.errorTitle')}</h1>
          <Banner tone="danger">{t('factory.loadError')}</Banner>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="inline-flex min-h-touch items-center justify-center rounded border-2 border-ink-strong px-4 text-sm font-semibold">
            {t('factory.retry')}
          </button>
        </div>
      </Page>
    )
  }
  if (state.status === 'missing') {
    return (
      <Page>
        <div className={`${shell} items-start pt-10`}>
          <h1 className="text-xl font-bold text-ink-strong">{t('factory.notFoundTitle')}</h1>
          <p className="text-ink-muted">{t('factory.notFoundBody')}</p>
          <Link to="/" className="inline-flex min-h-touch items-center justify-center rounded bg-brand-500 px-4 text-sm font-semibold text-ink-strong">
            {t('factory.backToMap')}
          </Link>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="inline-flex min-h-touch items-center justify-center rounded border-2 border-ink-strong px-4 text-sm font-semibold">
            {t('factory.tryAgain')}
          </button>
        </div>
      </Page>
    )
  }

  const f = state.factory
  const name = pickName(f.name, lang) || t('map.noName')
  const otherLang: Lang = lang === 'ar' ? 'en' : 'ar'
  const other = f.name[otherLang]
  const meta = [areaLabel(f.area, lang), sectorLabel(f.sector, lang)].filter(Boolean)
  const verified = f.approvedAt
    ? t('factory.verified', { date: new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(f.approvedAt) })
    : ''

  return (
    <Page>
      {fromMap ? (
        <button type="button" onClick={() => void navigate(-1)} className={BACK}>
          <span aria-hidden="true" className="rtl:rotate-180">&larr;</span>
          {t('factory.back')}
        </button>
      ) : (
        <Link to="/" className={BACK}>
          <span aria-hidden="true" className="rtl:rotate-180">&larr;</span>
          {t('factory.back')}
        </Link>
      )}
      <div className="mx-auto w-full max-w-2xl">
        <PhotoCarousel photos={photos} name={name} seed={f.id} />
      </div>
      <div className={`${shell} pt-4`}>
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-ink-strong"><bdi>{name}</bdi></h1>
          {other && other !== name && <p lang={otherLang} className="text-ink-muted">{other}</p>}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
            {f.sample && (
              <span className="inline-block rounded-sm bg-amber-50 px-2 py-0.5 text-caption font-semibold text-amber-900">{t('factory.demo')}</span>
            )}
            {meta.length > 0 && <span>{meta.join(' · ')}</span>}
          </p>
          {verified && <p className="text-sm text-green-700">{verified}</p>}
        </header>
        <FactoryProducts id="made-h" title={t('factory.makes')} products={f.productsMade} variant="made" lang={lang} />
        <FactoryProducts id="needs-h" title={t('factory.needs')} products={f.productsNeeded} variant="needed" lang={lang} />
        <MiniMap lat={f.location.lat} lng={f.location.lng} />
        <ContactsPanel factoryId={f.id} />
      </div>
    </Page>
  )
}
