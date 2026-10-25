import { useTranslation } from 'react-i18next'
import { areas } from '../../data'
import { LocationPicker } from '../../map/LocationPicker'
import { FieldError, type StepProps } from './shared'

const DEFAULT_CENTER = areas().find((a) => a.id === 'oct6-zone-1')?.center ?? { lat: 29.9227638, lng: 30.9129223 }

export function StepLocation({ draft, dispatch, errors }: StepProps) {
  const { t } = useTranslation()
  const center = areas().find((a) => a.id === draft.area)?.center ?? DEFAULT_CENTER
  return (
    <section>
      <h2 className="text-title font-semibold text-ink-strong">{t('survey.location.title')}</h2>
      <p className="mb-3 text-body-sm text-ink-subtle">{t('survey.location.hint')}</p>
      <LocationPicker
        value={draft.mode === 'edit' || draft.location?.pinMoved ? draft.location : undefined}
        areaCenter={center}
        onChange={(location, status) => {
          dispatch({ type: 'setLocation', location })
          dispatch({ type: 'setGpsStatus', status })
        }}
      />
      {errors.map((k) => (
        <FieldError key={k}>{t(k)}</FieldError>
      ))}
    </section>
  )
}
