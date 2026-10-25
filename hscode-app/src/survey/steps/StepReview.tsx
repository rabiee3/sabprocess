import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { areas, sectors } from '../../data'
import { HsBadge } from '../../hs/HsBadge'
import { hsString } from '../../lib/hs'
import { Banner } from '../../ui/Banner'
import { useOnline } from '../../ui/useOnline'
import type { ProductDraft, StepId } from '../draft'
import type { StepProps } from './shared'

const WEAK_M = 50

function Section({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <section className="border-b border-line py-3">
      <div className="flex items-center justify-between">
        <h2 className="text-section font-semibold text-ink-strong">{title}</h2>
        <button type="button" onClick={onEdit} className="min-h-touch px-2 text-body-sm font-semibold text-blue-800 underline">
          {t('survey.review.edit')}
          <span className="sr-only"> {title}</span>
        </button>
      </div>
      <div className="text-body-sm text-ink">{children}</div>
    </section>
  )
}

function Products({ list, variant }: { list: ProductDraft[]; variant: 'made' | 'needed' }) {
  return (
    <ul>
      {list.map((p) => {
        const code = hsString(p.hs)
        return (
          <li key={p.key} className="flex items-center gap-2 py-0.5">
            <span>{p.name.en || p.name.ar}</span>
            {code && <HsBadge code={code} variant={variant} />}
          </li>
        )
      })}
    </ul>
  )
}

export function StepReview({ draft, goTo }: StepProps & { goTo: (s: StepId) => void }) {
  const { t, i18n } = useTranslation()
  const online = useOnline()
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en'
  const area = areas().find((a) => a.id === draft.area)
  const sector = sectors().find((s) => s.id === draft.sector)
  const loc = draft.location
  const c = draft.contact
  const contactLines = (
    [
      ['phone', c.phone],
      ['whatsapp', c.whatsappSameAsPhone ? c.phone : c.whatsapp],
      ['website', c.website],
      ['facebook', c.facebook],
      ['person', c.contactPerson],
    ] as [string, string | undefined][]
  ).filter(([, v]) => v)
  return (
    <div>
      <h2 className="mb-2 text-title font-semibold text-ink-strong">{t('survey.review.title')}</h2>
      <div className="flex flex-col gap-2">
        {!online && <Banner tone="info">{t('survey.review.offlineBanner')}</Banner>}
        {loc && !loc.pinMoved && <Banner tone="warning">{t('survey.review.pinNotMoved')}</Banner>}
        {loc && loc.accuracyM !== null && loc.accuracyM > WEAK_M && <Banner tone="warning">{t('survey.review.weakGps')}</Banner>}
      </div>
      <Section title={t('survey.step.location')} onEdit={() => goTo('location')}>
        {loc && (
          <span dir="ltr">
            {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
            {loc.accuracyM !== null && ` ±${Math.round(loc.accuracyM)} m`}
          </span>
        )}
      </Section>
      <Section title={t('survey.step.basics')} onEdit={() => goTo('basics')}>
        <p className="font-semibold">{draft.name[lang] || draft.name.en || draft.name.ar}</p>
        <p>{area ? area[lang] : draft.area}{draft.area === 'other' && draft.areaOther ? ` — ${draft.areaOther}` : ''}</p>
        {sector && <p>{sector[lang]}</p>}
        {draft.address && <p>{draft.address}</p>}
      </Section>
      <Section title={t('survey.step.products')} onEdit={() => goTo('products')}>
        <p className="font-semibold">{t('survey.products.made')}</p>
        <Products list={draft.productsMade} variant="made" />
        <p className="mt-2 font-semibold">{t('survey.products.needed')}</p>
        <Products list={draft.productsNeeded} variant="needed" />
      </Section>
      <Section title={t('survey.step.contacts')} onEdit={() => goTo('contacts')}>
        {contactLines.map(([k, l]) => (
          <p key={k} dir="auto">
            {l}
          </p>
        ))}
      </Section>
      <Section title={t('survey.step.photos')} onEdit={() => goTo('photos')}>
        <div className="flex gap-2">
          {draft.photos.map((p) => (
            <img key={p.id} src={p.data} alt="" className="size-16 rounded object-cover" />
          ))}
        </div>
      </Section>
    </div>
  )
}
