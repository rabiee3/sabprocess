import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isSafeImage } from '../lib/safeImage'
import type { PhotoData } from '../survey/types'
import plant from '../assets/placeholders/photo-plant.svg'
import silo from '../assets/placeholders/photo-silo.svg'
import warehouse from '../assets/placeholders/photo-warehouse.svg'

const PLACEHOLDERS = [plant, silo, warehouse]
const SWIPE_PX = 40
const arrow =
  'absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-lg text-ink-strong shadow disabled:opacity-40'

type Props = { photos: PhotoData[] | null; name: string; seed: string }

/** Up to 3 photos with arrows, dots and swipe. The strip is always LTR so swipe direction matches the arrows. */
export function PhotoCarousel({ photos, name, seed }: Props) {
  const { t } = useTranslation()
  const safe = (photos ?? []).filter((p) => isSafeImage(p.data)).slice(0, 3)
  const [i, setI] = useState(0)
  const startX = useRef<number | null>(null)
  const total = safe.length

  if (total === 0) {
    const art = PLACEHOLDERS[[...seed].reduce((s, c) => s + c.charCodeAt(0), 0) % PLACEHOLDERS.length]
    return <img src={art} alt={photos === null ? '' : t('factory.noPhotos')} className="aspect-[4/3] w-full bg-surface-alt object-cover" />
  }

  const go = (n: number) => setI(Math.min(total - 1, Math.max(0, n)))
  return (
    <div
      dir="ltr"
      className="relative aspect-[4/3] w-full touch-pan-y overflow-hidden bg-surface-alt"
      onPointerDown={(e) => {
        startX.current = e.clientX
      }}
      onPointerUp={(e) => {
        if (startX.current === null) return
        const dx = e.clientX - startX.current
        startX.current = null
        if (Math.abs(dx) >= SWIPE_PX) go(i + (dx < 0 ? 1 : -1))
      }}
      onPointerCancel={() => {
        startX.current = null
      }}
    >
      <img
        src={safe[i].data}
        alt={t('factory.photoAlt', { n: i + 1, total, name })}
        className="size-full select-none object-cover"
        draggable={false}
      />
      {total > 1 && (
        <>
          <button type="button" aria-label={t('factory.photoPrev')} disabled={i === 0} onClick={() => go(i - 1)} className={`${arrow} start-2`}>
            <span aria-hidden="true">&lsaquo;</span>
          </button>
          <button type="button" aria-label={t('factory.photoNext')} disabled={i === total - 1} onClick={() => go(i + 1)} className={`${arrow} end-2`}>
            <span aria-hidden="true">&rsaquo;</span>
          </button>
          <span className="absolute end-2 top-2 rounded-sm bg-ink-strong/70 px-2 py-0.5 text-caption text-surface">
            {t('factory.photoCount', { n: i + 1, total })}
          </span>
          <div className="absolute inset-x-0 bottom-1 flex justify-center">
            {safe.map((p, n) => (
              <button
                key={p.id}
                type="button"
                aria-label={t('factory.photoDot', { n: n + 1 })}
                aria-current={n === i ? 'true' : undefined}
                onClick={() => go(n)}
                className="flex size-11 items-center justify-center"
              >
                <span className={`block size-2.5 rounded-full ${n === i ? 'bg-brand-500' : 'bg-surface/80'}`} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
