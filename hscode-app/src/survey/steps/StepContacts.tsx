import { useTranslation } from 'react-i18next'
import type { ContactDraft } from '../types'
import { Field, INPUT, type StepProps } from './shared'

export function StepContacts({ draft, dispatch }: StepProps) {
  const { t } = useTranslation()
  const c = draft.contact
  const set = (patch: Partial<ContactDraft>) => dispatch({ type: 'setContact', contact: { ...c, ...patch } })
  const text = (k: 'website' | 'facebook' | 'contactPerson', label: string) => (
    <Field label={label}>
      <input className={INPUT} value={c[k] ?? ''} onChange={(e) => set({ [k]: e.target.value })} />
    </Field>
  )
  return (
    <section>
      <p className="mb-4 text-body-sm text-ink-subtle">{t('survey.contacts.intro')}</p>
      <Field label={t('survey.contacts.phone')}>
        <input
          className={INPUT}
          type="tel"
          inputMode="tel"
          dir="ltr"
          value={c.phone ?? ''}
          onChange={(e) => set({ phone: e.target.value })}
        />
      </Field>
      <Field label={t('survey.contacts.whatsapp')}>
        <input
          className={INPUT}
          type="tel"
          inputMode="tel"
          dir="ltr"
          disabled={!!c.whatsappSameAsPhone}
          value={c.whatsappSameAsPhone ? (c.phone ?? '') : (c.whatsapp ?? '')}
          onChange={(e) => set({ whatsapp: e.target.value })}
        />
      </Field>
      <label className="mt-2 flex min-h-touch items-center gap-2 text-body-sm text-ink">
        <input
          type="checkbox"
          className="size-5"
          checked={!!c.whatsappSameAsPhone}
          onChange={(e) => set({ whatsappSameAsPhone: e.target.checked })}
        />
        {t('survey.contacts.sameAsPhone')}
      </label>
      {text('website', t('survey.contacts.website'))}
      {text('facebook', t('survey.contacts.facebook'))}
      {text('contactPerson', t('survey.contacts.person'))}
    </section>
  )
}
