import imageCompression from 'browser-image-compression'

export class PhotoTooLargeError extends Error {
  constructor() {
    super('Photo is too large after compression')
    this.name = 'PhotoTooLargeError'
  }
}

export class PhotoDecodeError extends Error {
  detail?: unknown
  constructor(cause?: unknown) {
    super('Photo could not be decoded')
    this.name = 'PhotoDecodeError'
    this.detail = cause
  }
}

type Opts = { maxSide?: number; quality?: number; maxChars?: number }

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

async function encode(file: File, maxSide: number, quality: number): Promise<string> {
  const base = { maxWidthOrHeight: maxSide, initialQuality: quality, useWebWorker: true }
  let out: Blob = await imageCompression(file, { ...base, fileType: 'image/webp' })
  if (out.type !== 'image/webp') {
    out = await imageCompression(file, { ...base, fileType: 'image/jpeg' })
  }
  return toDataUrl(out)
}

export async function compressPhoto(file: File, opts: Opts = {}): Promise<string> {
  const { maxSide = 500, quality = 0.6, maxChars = 122880 } = opts
  let url: string
  try {
    url = await encode(file, maxSide, quality)
    if (url.length > maxChars) {
      url = await encode(file, maxSide, Math.max(0.1, quality - 0.2))
    }
  } catch (e) {
    throw new PhotoDecodeError(e)
  }
  if (url.length > maxChars) throw new PhotoTooLargeError()
  return url
}

export function makeThumb(file: File): Promise<string> {
  return compressPhoto(file, { maxSide: 200, quality: 0.6, maxChars: 20480 })
}
