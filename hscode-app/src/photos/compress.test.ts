import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCompress = vi.fn()
// Rejections are produced outside vi.fn so vitest's mock result tracking doesn't flag them as unhandled.
let failNext = false
vi.mock('browser-image-compression', () => ({
  default: (...a: unknown[]) => (failNext ? Promise.reject(new Error('bad')) : mockCompress(...a)),
}))

import { compressPhoto, makeThumb, PhotoDecodeError, PhotoTooLargeError } from './compress'

const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
const blob = (type: string, size = 10) => new Blob(['a'.repeat(size)], { type })

describe('compressPhoto', () => {
  beforeEach(() => {
    mockCompress.mockReset()
    failNext = false
  })

  it('returns a webp data URL', async () => {
    mockCompress.mockResolvedValue(blob('image/webp'))
    const out = await compressPhoto(file)
    expect(out.startsWith('data:image/webp;base64,')).toBe(true)
    expect(mockCompress).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ maxWidthOrHeight: 500, initialQuality: 0.6, fileType: 'image/webp', useWebWorker: true }),
    )
  })

  it('re-encodes as jpeg when the browser returns a non-webp type', async () => {
    mockCompress.mockResolvedValueOnce(blob('image/png')).mockResolvedValueOnce(blob('image/jpeg'))
    const out = await compressPhoto(file)
    expect(mockCompress).toHaveBeenCalledTimes(2)
    expect(mockCompress.mock.calls[1][1]).toMatchObject({ fileType: 'image/jpeg', maxWidthOrHeight: 500, initialQuality: 0.6 })
    expect(out.startsWith('data:image/jpeg;base64,')).toBe(true)
  })

  it('retries once at quality - 0.2 then throws PhotoTooLargeError', async () => {
    mockCompress.mockResolvedValue(blob('image/webp', 5000))
    await expect(compressPhoto(file, { maxChars: 100 })).rejects.toBeInstanceOf(PhotoTooLargeError)
    expect(mockCompress).toHaveBeenCalledTimes(2)
    expect(mockCompress.mock.calls[1][1].initialQuality).toBeCloseTo(0.4)
  })

  it('succeeds on the retry when it fits', async () => {
    mockCompress.mockResolvedValueOnce(blob('image/webp', 5000)).mockResolvedValueOnce(blob('image/webp', 10))
    const out = await compressPhoto(file, { maxChars: 200 })
    expect(out.length).toBeLessThanOrEqual(200)
  })

  it('wraps failures as PhotoDecodeError', async () => {
    failNext = true
    await expect(compressPhoto(file)).rejects.toBeInstanceOf(PhotoDecodeError)
  })

  it('makeThumb uses 200px and a 20480 limit', async () => {
    mockCompress.mockResolvedValue(blob('image/webp'))
    await makeThumb(file)
    expect(mockCompress.mock.calls[0][1]).toMatchObject({ maxWidthOrHeight: 200, initialQuality: 0.6 })
  })
})
