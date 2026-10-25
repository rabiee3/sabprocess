import { useTranslation } from 'react-i18next'
import type { ContactDraft } from '../types'
import { Field, TextInput, useTooLong, type StepProps } from './shared'

export function StepContacts({ draft, dispatch, errors }: StepProps) {
  const { t } = useTranslation()
  const long = useTooLong(errors)
  const c = draft.contact
  const set = (patch: Partial<ContactDraft>) => dispatch({ type: 'setContact', contact: { ...c, ...patch } })
  const url = (k: 'website' | 'facebook', label: string) => (
    <Field label={label} error={long(k)}>
      <TextInput limit={k} type="url" inputMode="url" dir="ltr" value={c[k] ?? ''} onValue={(v) => set({ [k]: v })} />
    </Field>
  )
  return (
    <section>
      <p className="mb-4 text-body-sm text-ink-subtle">{t('survey.contacts.intro')}</p>
      <Field label={t('survey.contacts.phone')} error={long('phone')}>
        <TextInput limit="phone" type="tel" inputMode="tel" dir="ltr" value={c.phone ?? ''} onValue={(v) => set({ phone: v })} />
      </Field>
      <Field label={t('survey.contacts.whatsapp')} error={c.whatsappSameAsPhone ? undefined : long('whatsapp')}>
        <TextInput
          limit="whatsapp"
          type="tel"
          inputMode="tel"
          dir="ltr"
          disabled={!!c.whatsappSameAsPhone}
          value={c.whatsappSameAsPhone ? (c.phone ?? '') : (c.whatsapp ?? '')}
          onValue={(v) => set({ whatsapp: v })}
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
      {url('website', t('survey.contacts.website'))}
      {url('facebook', t('survey.contacts.facebook'))}
      <Field label={t('survey.contacts.person')} error={long('contactPerson')}>
        <TextInput limit="contactPerson" value={c.contactPerson ?? ''} onValue={(v) => set({ contactPerson: v })} />
      </Field>
    </section>
  )
}
