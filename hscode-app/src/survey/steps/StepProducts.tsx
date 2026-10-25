import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HsBadge } from '../../hs/HsBadge'
import { HsPicker } from '../../hs/HsPicker'
import { hsString, validateHs } from '../../lib/hs'
import trashIcon from '../../assets/icons/trash.svg?raw'
import type { ProductList } from '../draft'
import { Field, FieldError, INPUT, type StepProps } from './shared'

const SECTIONS: { list: ProductList; title: string; variant: 'made' | 'needed' }[] = [
  { list: 'productsMade', title: 'survey.products.made', variant: 'made' },
  { list: 'productsNeeded', title: 'survey.products.needed', variant: 'needed' },
]

const blank = (s: string) => s.trim() === ''

export function StepProducts({ draft, dispatch, errors }: StepProps) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState<{ list: ProductList; key: string } | null>(null)
  const picked = picking ? draft[picking.list].find((p) => p.key === picking.key) : undefined
  return (
    <section>
      {SECTIONS.map(({ list, title, variant }) => (
        <div key={list} className="mb-6">
          <h2 className="text-title font-semibold text-ink-strong">{t(title)}</h2>
          <ul>
            {draft[list].map((p) => {
              const code = hsString(p.hs)
              return (
                <li key={p.key} className="mt-3 rounded border border-line p-3">
                  <Field
                    label={t('survey.products.nameEn')}
                    error={
                      errors.includes('survey.products.nameRequired') && blank(p.name.en) && blank(p.name.ar)
                        ? t('survey.products.nameRequired')
                        : undefined
                    }
                  >
                    <input
                      className={INPUT}
                      dir="ltr"
                      value={p.name.en}
                      onChange={(e) =>
                        dispatch({ type: 'updateProduct', list, key: p.key, patch: { name: { ...p.name, en: e.target.value } } })
                      }
                    />
                  </Field>
                  <Field label={t('survey.products.nameAr')}>
                    <input
                      className={INPUT}
                      dir="rtl"
                      value={p.name.ar}
                      onChange={(e) =>
                        dispatch({ type: 'updateProduct', list, key: p.key, patch: { name: { ...p.name, ar: e.target.value } } })
                      }
                    />
                  </Field>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPicking({ list, key: p.key })}
                      className="min-h-touch flex-1 rounded border border-line-strong px-3 text-start text-body-sm font-semibold text-blue-800"
                    >
                      {t('survey.products.hsOptional')}
                    </button>
                    {code && <HsBadge code={code} variant={variant} />}
                    <button
                      type="button"
                      aria-label={t('survey.products.remove')}
                      onClick={() => dispatch({ type: 'removeProduct', list, key: p.key })}
                      className="flex min-h-touch min-w-11 items-center justify-center text-red-700"
                    >
                      <span aria-hidden="true" className="size-6" dangerouslySetInnerHTML={{ __html: trashIcon }} />
                    </button>
                  </div>
                  {errors.includes('hs.tariffInvalid') && p.hs && !validateHs(p.hs).ok && (
                    <FieldError>{t('hs.tariffInvalid')}</FieldError>
                  )}
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            onClick={() => dispatch({ type: 'addProduct', list })}
            className="mt-3 min-h-control w-full rounded border border-dashed border-line-strong text-body font-semibold text-ink-strong"
          >
            {t('survey.products.add')}
          </button>
        </div>
      ))}
      <HsPicker
        open={!!picking}
        productLabel={picked ? picked.name.en || picked.name.ar : ''}
        value={picked?.hs}
        onUse={(hs) => {
          if (picking) dispatch({ type: 'updateProduct', list: picking.list, key: picking.key, patch: { hs } })
          setPicking(null)
        }}
        onClose={() => setPicking(null)}
      />
    </section>
  )
}
