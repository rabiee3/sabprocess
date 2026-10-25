import { useTranslation } from 'react-i18next'
import { areas, sectors } from '../../data'
import { Field, INPUT, TextInput, type StepProps } from './shared'
import { useTooLong } from './useTooLong'

export function StepBasics({ draft, dispatch, errors }: StepProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en'
  const err = (k: string) => (errors.includes(k) ? t(k) : undefined)
  const long = useTooLong(errors)
  return (
    <section>
      <Field label={t('survey.basics.nameEn')} error={err('survey.basics.nameRequired') ?? long('name.en')}>
        <TextInput
          limit="name.en"
          dir="ltr"
          value={draft.name.en}
          onValue={(value) => dispatch({ type: 'setName', lang: 'en', value })}
        />
      </Field>
      <Field label={t('survey.basics.nameAr')} error={long('name.ar')}>
        <TextInput
          limit="name.ar"
          dir="rtl"
          value={draft.name.ar}
          onValue={(value) => dispatch({ type: 'setName', lang: 'ar', value })}
        />
      </Field>
      <Field label={t('survey.basics.area')} error={err('survey.basics.areaRequired')}>
        <select
          className={INPUT}
          value={draft.area}
          onChange={(e) => dispatch({ type: 'setField', field: 'area', value: e.target.value })}
        >
          <option value="" />
          {areas().map((a) => (
            <option key={a.id} value={a.id}>
              {a[lang]}
            </option>
          ))}
        </select>
      </Field>
      {draft.area === 'other' && (
        <Field label={t('survey.basics.areaOther')} error={err('survey.basics.areaOtherRequired') ?? long('areaOther')}>
          <TextInput
            limit="areaOther"
            value={draft.areaOther}
            onValue={(value) => dispatch({ type: 'setField', field: 'areaOther', value })}
          />
        </Field>
      )}
      <Field label={t('survey.basics.sector')}>
        <select
          className={INPUT}
          value={draft.sector}
          onChange={(e) => dispatch({ type: 'setField', field: 'sector', value: e.target.value })}
        >
          <option value="" />
          {sectors().map((s) => (
            <option key={s.id} value={s.id}>
              {s[lang]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('survey.basics.address')} error={long('address')}>
        <TextInput
          limit="address"
          value={draft.address}
          onValue={(value) => dispatch({ type: 'setField', field: 'address', value })}
        />
      </Field>
    </section>
  )
}
