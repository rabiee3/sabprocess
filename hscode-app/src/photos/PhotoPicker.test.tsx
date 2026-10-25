import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { initI18n, setLanguage } from '../i18n'
import type { PhotoData } from '../survey/types'
import en from '../i18n/en.json'

const compressPhoto = vi.fn()
const makeThumb = vi.fn()
vi.mock('./compress', () => ({
  compressPhoto: (...a: unknown[]) => compressPhoto(...a),
  makeThumb: (...a: unknown[]) => makeThumb(...a),
}))

import { PhotoPicker } from './PhotoPicker'

const onChange = vi.fn()
function Harness({ initial = [] }: { initial?: PhotoData[] }) {
  const [photos, setPhotos] = useState<PhotoData[]>(initial)
  return (
    <PhotoPicker
      photos={photos}
      onChange={(p, thumb) => {
        onChange(p, thumb)
        setPhotos(p)
      }}
    />
  )
}
const f = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

describe('PhotoPicker', () => {
  beforeEach(async () => {
    initI18n()
    await setLanguage('en')
    onChange.mockReset()
    compressPhoto.mockReset().mockImplementation(async (file: File) => `data:image/webp;base64,${file.name}`)
    makeThumb.mockReset().mockResolvedValue('data:image/webp;base64,thumb')
  })

  const gallery = () => document.querySelector('input[type=file]:not([capture])') as HTMLInputElement

  it('fills p1-p3 and disables add buttons at 3', async () => {
    render(<Harness />)
    await userEvent.upload(gallery(), [f('a'), f('b'), f('c'), f('d')])
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(3))
    const last = onChange.mock.calls.at(-1)![0] as PhotoData[]
    expect(last.map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
    expect(screen.getByRole('button', { name: /Camera/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Gallery/ })).toBeDisabled()
  })

  it('assigns the lowest free id after removal', async () => {
    render(<Harness initial={[{ id: 'p1', data: 'd1' }, { id: 'p2', data: 'd2' }, { id: 'p3', data: 'd3' }]} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove photo' })[1])
    await userEvent.upload(gallery(), f('n'))
    await waitFor(() => expect(onChange.mock.calls.length).toBe(2))
    const last = onChange.mock.calls.at(-1)![0] as PhotoData[]
    expect(last.find((p) => p.data.endsWith('n'))?.id).toBe('p2')
  })

  it('shows the failed text and keeps others', async () => {
    compressPhoto.mockImplementation(async (file: File) => {
      if (file.name === 'bad') throw new Error('x')
      return `data:image/webp;base64,${file.name}`
    })
    render(<Harness />)
    await userEvent.upload(gallery(), [f('ok'), f('bad')])
    expect(await screen.findByText(en.survey.photos.failed)).toBeInTheDocument()
    expect(en.survey.photos.failed).toMatch(/Camera/)
    expect(en.survey.photos.failed).toMatch(/JPEG/)
    expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(1)
  })

  it('passes a thumb on the first add', async () => {
    render(<Harness />)
    await userEvent.upload(gallery(), f('a'))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][1]).toBe('data:image/webp;base64,thumb')
  })

  it('disables remove while a multi-file add is running, so no photo reappears', async () => {
    let release!: () => void
    compressPhoto.mockImplementation(
      (file: File) =>
        new Promise<string>((res) => {
          release = () => res(`data:image/webp;base64,${file.name}`)
        }),
    )
    render(<Harness initial={[{ id: 'p1', data: 'd1' }]} />)
    await userEvent.upload(gallery(), [f('a'), f('b')])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove photo' })).toBeDisabled())
    release()
    await waitFor(() => expect(compressPhoto).toHaveBeenCalledTimes(2))
    release()
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect((onChange.mock.calls.at(-1)![0] as PhotoData[]).map((p) => p.id)).toEqual(['p1', 'p2', 'p3'])
  })

  it('passes thumb undefined when the first photo is unchanged', async () => {
    render(<Harness initial={[{ id: 'p1', data: 'd1' }, { id: 'p2', data: 'd2' }]} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove photo' })[1])
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(onChange.mock.calls[0][1]).toBeUndefined()
  })

  it('passes thumb null when photos become empty', async () => {
    render(<Harness initial={[{ id: 'p1', data: 'd1' }]} />)
    await userEvent.click(screen.getByRole('button', { name: 'Remove photo' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([], null))
  })

  it('passes thumb null when the first photo changed and the thumb cannot be regenerated', async () => {
    makeThumb.mockRejectedValue(new Error('x'))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')))
    render(<Harness initial={[{ id: 'p1', data: 'd1' }, { id: 'p2', data: 'd2' }]} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove photo' })[0])
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(onChange.mock.calls[0][1]).toBeNull()
    vi.unstubAllGlobals()
  })
})
