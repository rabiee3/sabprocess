import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { Banner } from '../ui/Banner'
import { DemoBadge } from '../ui/DemoBadge'
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
import { firestoreErrorKey } from '../lib/firestoreErrors'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'missing' }
  | { status: 'ready'; load: LoadedFactory }
type View = { key: string; state: State; photos: PhotoData[] | null }

const viewKey = (id: string, attempt: number) => `${attempt}:${id}`

/** A factory already seen this session renders at once from the session cache (spec §8); else it loads. */
function initialView(id: string, key: string): View {
  const hit = getCached(id)
  return { key, state: hit ? { status: 'ready', load: hit.load } : { status: 'loading' }, photos: hit?.photos ?? null }
}

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
  const { role } = useAuth()
  const fromMap = isFromMap(from)
  const [attempt, setAttempt] = useState(0)
  // Each factory id (and each retry) starts from its own view; switching is done during render, not in an effect.
  const key = viewKey(id, attempt)
  const [stored, setView] = useState<View>(() => initialView(id, key))
  let view = stored
  if (stored.key !== key) {
    view = initialView(id, key)
    setView(view)
  }
  const { state, photos } = view

  useEffect(() => {
    let live = true
    const k = viewKey(id, attempt)
    // Only the view this load belongs to is updated: a late answer for another id or attempt is dropped.
    const update = (patch: Partial<View>) => {
      if (live) setView((v) => (v.key === k ? { ...v, ...patch } : v))
    }
    const fetchPhotos = (load: LoadedFactory) =>
      loadPhotos(id).then(
        (p) => {
          setCached(id, { load, photos: p })
          update({ photos: p })
        },
        () => update({ photos: [] }),
      )
    const cached = getCached(id)
    if (cached) {
      if (!cached.photos) void fetchPhotos(cached.load)
    } else {
      loadPublicFactory(id).then(
        (load) => {
          if (load) setCached(id, { load, photos: null })
          if (!live) return
          update({ state: load ? { status: 'ready', load } : { status: 'missing' } })
          if (load) void fetchPhotos(load)
        },
        (e: unknown) => update({ state: { status: 'error', message: firestoreErrorKey(e, 'factory.loadError') } }),
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
          <Banner tone="danger">{t(state.message)}</Banner>
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

  const { factory: f, isPublic } = state.load
  // Not public: only its owner or the admin can read it (the rules). Contacts stay admin-only (spec §9 M2).
  const showContacts = isPublic || role === 'admin'
  const name = pickName(f.name, lang) || t('map.noName')
  const otherLang: Lang = lang === 'ar' ? 'en' : 'ar'
  const other = f.name[otherLang]
  const meta = [areaLabel(f.area, lang, f.areaOther), sectorLabel(f.sector, lang)].filter(Boolean)
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
            {f.sample && <DemoBadge />}
            {meta.length > 0 && <span>{meta.join(' · ')}</span>}
          </p>
          {verified && <p className="text-sm text-green-700">{verified}</p>}
        </header>
        {!isPublic && <Banner tone="warning">{t('factory.notPublic')}</Banner>}
        <FactoryProducts id="made-h" title={t('factory.makes')} products={f.productsMade} variant="made" lang={lang} />
        <FactoryProducts id="needs-h" title={t('factory.needs')} products={f.productsNeeded} variant="needed" lang={lang} />
        <MiniMap lat={f.location.lat} lng={f.location.lng} />
        {showContacts && <ContactsPanel factoryId={f.id} />}
      </div>
    </Page>
  )
}
