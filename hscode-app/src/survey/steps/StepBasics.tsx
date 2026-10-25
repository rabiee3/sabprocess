import { useTranslation } from 'react-i18next'
import { areas, sectors } from '../../data'
import { Field, INPUT, type StepProps } from './shared'

export function StepBasics({ draft, dispatch, errors }: StepProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en'
  const err = (k: string) => (errors.includes(k) ? t(k) : undefined)
  return (
    <section>
      <Field label={t('survey.basics.nameEn')} error={err('survey.basics.nameRequired')}>
        <input
          className={INPUT}
          dir="ltr"
          value={draft.name.en}
          onChange={(e) => dispatch({ type: 'setName', lang: 'en', value: e.target.value })}
        />
      </Field>
      <Field label={t('survey.basics.nameAr')}>
        <input
          className={INPUT}
          dir="rtl"
          value={draft.name.ar}
          onChange={(e) => dispatch({ type: 'setName', lang: 'ar', value: e.target.value })}
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
        <Field label={t('survey.basics.areaOther')} error={err('survey.basics.areaOtherRequired')}>
          <input
            className={INPUT}
            value={draft.areaOther}
            onChange={(e) => dispatch({ type: 'setField', field: 'areaOther', value: e.target.value })}
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
      <Field label={t('survey.basics.address')}>
        <input
          className={INPUT}
          value={draft.address}
          onChange={(e) => dispatch({ type: 'setField', field: 'address', value: e.target.value })}
        />
      </Field>
    </section>
  )
}
