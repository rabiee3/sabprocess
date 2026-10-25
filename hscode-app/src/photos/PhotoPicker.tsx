import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banner } from '../ui/Banner'
import type { PhotoData } from '../survey/types'
import cameraIcon from '../assets/icons/camera.svg?raw'
import imageIcon from '../assets/icons/image.svg?raw'
import closeIcon from '../assets/icons/close.svg?raw'
import { compressPhoto, makeThumb } from './compress'

const IDS: PhotoData['id'][] = ['p1', 'p2', 'p3']
const MAX = IDS.length

type Props = {
  photos: PhotoData[]
  /** thumb: undefined = unchanged, null = clear, string = new thumb */
  onChange: (photos: PhotoData[], thumb?: string | null) => void
}

function sorted(photos: PhotoData[]): PhotoData[] {
  return [...photos].sort((a, b) => a.id.localeCompare(b.id))
}

async function fileFromDataUrl(url: string): Promise<File> {
  const blob = await (await fetch(url)).blob()
  return new File([blob], 'photo', { type: blob.type })
}

export function PhotoPicker({ photos, onChange }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  // Source files for photos added in this session, used to regenerate the thumb.
  const sources = useRef(new Map<string, File>())
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const full = photos.length >= MAX
  const disabled = busy || full

  async function thumbFor(first: PhotoData): Promise<string | undefined> {
    try {
      const src = sources.current.get(first.id) ?? (await fileFromDataUrl(first.data))
      return await makeThumb(src)
    } catch {
      return undefined
    }
  }

  async function addFiles(list: FileList | null) {
    const files = Array.from(list ?? [])
    if (files.length === 0) return
    setBusy(true)
    setFailed(false)
    const before = sorted(photos)
    let next = before
    let hadFailure = false
    for (const file of files) {
      if (next.length >= MAX) break
      const id = IDS.find((i) => !next.some((p) => p.id === i))
      if (!id) break
      try {
        const data = await compressPhoto(file)
        sources.current.set(id, file)
        next = sorted([...next, { id, data }])
      } catch {
        hadFailure = true
      }
    }
    if (hadFailure) setFailed(true)
    if (next !== before) await emit(before, next)
    setBusy(false)
  }

  async function emit(before: PhotoData[], next: PhotoData[]) {
    const first = next[0]
    if (!first) return onChange(next, null)
    const changed = first.id !== before[0]?.id || first.data !== before[0]?.data
    onChange(next, changed ? ((await thumbFor(first)) ?? null) : undefined)
  }

  async function remove(id: PhotoData['id']) {
    sources.current.delete(id)
    setFailed(false)
    const before = sorted(photos)
    const next = before.filter((p) => p.id !== id)
    setBusy(true)
    await emit(before, next)
    setBusy(false)
  }

  function input(ref: React.RefObject<HTMLInputElement | null>, capture: boolean) {
    return (
      <input
        ref={ref}
        type="file"
        accept="image/*"
        {...(capture ? { capture: 'environment' as const } : { multiple: true })}
        className="hidden"
        tabIndex={-1}
        onChange={(e) => {
          const el = e.currentTarget
          const files = el.files
          void addFiles(files).then(() => {
            el.value = ''
          })
        }}
      />
    )
  }

  const btn =
    'flex min-h-control flex-1 items-center justify-center gap-2 rounded border border-line bg-surface px-3 text-sm font-semibold text-ink-strong disabled:opacity-50'
  const slots = IDS.map((id) => sorted(photos).find((p) => p.id === id))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink">{t('survey.photos.intro')}</p>
      <div className="flex gap-3">
        <button type="button" disabled={disabled} className={btn} onClick={() => cameraRef.current?.click()}>
          <span aria-hidden="true" className="size-6" dangerouslySetInnerHTML={{ __html: cameraIcon }} />
          {t('survey.photos.camera')}
        </button>
        <button type="button" disabled={disabled} className={btn} onClick={() => galleryRef.current?.click()}>
          <span aria-hidden="true" className="size-6" dangerouslySetInnerHTML={{ __html: imageIcon }} />
          {t('survey.photos.gallery')}
        </button>
        {input(cameraRef, true)}
        {input(galleryRef, false)}
      </div>
      {failed && <Banner tone="danger">{t('survey.photos.failed')}</Banner>}
      <ul className="grid grid-cols-3 gap-3">
        {slots.map((p, i) => (
          <li
            key={IDS[i]}
            className="relative aspect-square overflow-hidden rounded border border-dashed border-line bg-surface-alt"
          >
            {p && (
              <>
                <img src={p.data} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  aria-label={t('survey.photos.remove')}
                  disabled={busy}
                  onClick={() => void remove(p.id)}
                  className="absolute end-1 top-1 flex min-h-touch min-w-11 items-center justify-center rounded-full bg-surface/90 text-ink-strong"
                >
                  <span aria-hidden="true" className="size-5" dangerouslySetInnerHTML={{ __html: closeIcon }} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
