import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { HsBadge } from '../hs/HsBadge'
import { hsString } from '../lib/hs'
import type { Product } from '../lib/types'
import { pickName, type Lang } from './labels'

type Props = { id: string; title: string; products: Product[]; variant: 'made' | 'needed'; lang: Lang }

/** A product list; needed products link to the map to find who supplies them. */
export function FactoryProducts({ id, title, products, variant, lang }: Props) {
  const { t } = useTranslation()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-body-sm font-semibold text-ink-strong">{title}</h2>
      {products.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('factory.noneListed')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {products.map((p, i) => {
            const name = pickName(p.name, lang)
            const hs = hsString(p.hs)
            const other = lang === 'ar' ? p.name.en : p.name.ar
            const to = hs ? `/?hs=${hs}` : `/?q=${encodeURIComponent(name).replace(/%20/g, '+')}`
            return (
              <li key={i} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-strong"><bdi>{name}</bdi></p>
                    {other && other !== name && <p lang={lang === 'ar' ? 'en' : 'ar'} className="text-caption text-ink-muted">{other}</p>}
                  </div>
                  {hs && <HsBadge code={hs} variant={variant} />}
                </div>
                {variant === 'needed' && (
                  <Link to={to} className="mt-1 inline-flex min-h-touch items-center text-sm font-semibold text-blue-800 underline">
                    {t('factory.whoSupplies')}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
