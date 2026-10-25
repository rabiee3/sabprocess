import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HsBadge } from '../../hs/HsBadge'
import { HsPicker } from '../../hs/HsPicker'
import { hsString, validateHs } from '../../lib/hs'
import trashIcon from '../../assets/icons/trash.svg?raw'
import { LIMITS, MAX_PRODUCTS, tooLong, type ProductList } from '../draft'
import { Field, FieldError, TextInput, type StepProps } from './shared'

const SECTIONS: { list: ProductList; title: string; variant: 'made' | 'needed' }[] = [
  { list: 'productsMade', title: 'survey.products.made', variant: 'made' },
  { list: 'productsNeeded', title: 'survey.products.needed', variant: 'needed' },
]

const blank = (s: string) => s.trim() === ''
const tooLongName = (s: string) => s.trim().length > LIMITS.productName

export function StepProducts({ draft, dispatch, errors }: StepProps) {
  const { t } = useTranslation()
  const longMsg = t('errors.tooLong', { max: LIMITS.productName })
  const maxMsg = t('survey.products.max', { max: MAX_PRODUCTS })
  const flagLong = errors.includes(tooLong('productName'))
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
                        : flagLong && tooLongName(p.name.en)
                          ? longMsg
                          : undefined
                    }
                  >
                    <TextInput
                      limit="productName"
                      dir="ltr"
                      value={p.name.en}
                      onValue={(en) => dispatch({ type: 'updateProduct', list, key: p.key, patch: { name: { ...p.name, en } } })}
                    />
                  </Field>
                  <Field label={t('survey.products.nameAr')} error={flagLong && tooLongName(p.name.ar) ? longMsg : undefined}>
                    <TextInput
                      limit="productName"
                      dir="rtl"
                      value={p.name.ar}
                      onValue={(ar) => dispatch({ type: 'updateProduct', list, key: p.key, patch: { name: { ...p.name, ar } } })}
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
          {draft[list].length > MAX_PRODUCTS && errors.includes('survey.products.max') ? (
            <FieldError>{maxMsg}</FieldError>
          ) : (
            draft[list].length >= MAX_PRODUCTS && <p className="mt-3 text-body-sm text-ink-subtle">{maxMsg}</p>
          )}
          <button
            type="button"
            disabled={draft[list].length >= MAX_PRODUCTS}
            onClick={() => dispatch({ type: 'addProduct', list })}
            className="mt-3 min-h-control w-full rounded border border-dashed border-line-strong text-body font-semibold text-ink-strong disabled:opacity-50"
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
