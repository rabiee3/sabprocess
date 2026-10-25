import { useTranslation } from 'react-i18next'
import { PhotoPicker } from '../../photos/PhotoPicker'
import type { StepProps } from './shared'

export function StepPhotos({ draft, dispatch }: StepProps) {
  const { t } = useTranslation()
  return (
    <section>
      <p className="mb-3 text-body-sm text-ink-subtle">{t('survey.photos.intro')}</p>
      <PhotoPicker photos={draft.photos} onChange={(photos, thumb) => dispatch({ type: 'setPhotos', photos, thumb })} />
    </section>
  )
}
