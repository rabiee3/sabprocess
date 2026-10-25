import { useTranslation } from 'react-i18next'
import { areas } from '../data'
import { LocationPicker } from '../map/LocationPicker'
import { draftReducer, type Draft, type DraftAction } from '../survey/draft'
import { FieldError } from '../survey/steps/shared'
import { StepBasics } from '../survey/steps/StepBasics'
import { StepProducts } from '../survey/steps/StepProducts'

const DEFAULT_CENTER = { lat: 29.9227638, lng: 30.9129223 }

type Props = {
  value: Draft
  onChange: (next: Draft) => void
  /** Validation errors to show (from `formErrors(value)` in reviewForm.ts), or [] until the admin has tried to approve. */
  errors: string[]
}

/**
 * Controlled editor for the admin-editable fields. It reuses the surveyor's basics and products steps
 * (same limits and checks) and the location picker, with the stored pin as the starting point.
 */
export function AdminFactoryForm({ value, onChange, errors }: Props) {
  const { t } = useTranslation()
  const dispatch = (a: DraftAction) => onChange(draftReducer(value, a))
  const center = areas().find((a) => a.id === value.area)?.center ?? value.location ?? DEFAULT_CENTER
  return (
    <div className="flex flex-col gap-6">
      <StepBasics draft={value} dispatch={dispatch} errors={errors} />
      <StepProducts draft={value} dispatch={dispatch} errors={errors} headingLevel={3} />
      <section>
        <h3 className="mb-2 text-title font-semibold text-ink-strong">{t('admin.review.location')}</h3>
        <LocationPicker
          value={value.location}
          areaCenter={center}
          gps={false}
          onChange={(location) => dispatch({ type: 'setLocation', location })}
        />
        {errors.includes('survey.location.required') && <FieldError>{t('survey.location.required')}</FieldError>}
      </section>
    </div>
  )
}
