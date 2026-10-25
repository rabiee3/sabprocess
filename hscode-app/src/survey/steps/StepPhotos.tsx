import { PhotoPicker } from '../../photos/PhotoPicker'
import type { StepProps } from './shared'

/** PhotoPicker renders the intro itself. */
export function StepPhotos({ draft, dispatch }: StepProps) {
  return (
    <section>
      <PhotoPicker photos={draft.photos} onChange={(photos, thumb) => dispatch({ type: 'setPhotos', photos, thumb })} />
    </section>
  )
}
