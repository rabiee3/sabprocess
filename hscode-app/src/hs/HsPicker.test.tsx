import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n, setLanguage } from '../i18n'
import { HsPicker } from './HsPicker'
import { HsBadge } from './HsBadge'

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
initI18n()
afterEach(() => setLanguage('en'))

function setup(props: Partial<React.ComponentProps<typeof HsPicker>> = {}) {
  const onUse = vi.fn()
  const onClose = vi.fn()
  render(<HsPicker open productLabel="Cattle feed" onUse={onUse} onClose={onClose} {...props} />)
  return { onUse, onClose }
}

async function pickFeed() {
  await userEvent.type(screen.getByRole('searchbox'), 'feed')
  await userEvent.click(await screen.findByRole('button', { name: /2309/ }))
}

describe('HsPicker', () => {
  it('search feed lists 2309; select then Use returns heading', async () => {
    const { onUse } = setup()
    await pickFeed()
    await userEvent.click(screen.getByRole('button', { name: 'Use 2309' }))
    expect(onUse).toHaveBeenCalledWith({ heading: '2309' })
  })

  it('subheading pick then Use', async () => {
    const { onUse } = setup()
    await pickFeed()
    await userEvent.click(await screen.findByRole('radio', { name: /2309.90/ }))
    expect(screen.getByText(/That's enough/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Use 2309.90' }))
    expect(onUse).toHaveBeenCalledWith({ heading: '2309', sub: '230990' })
  })

  it('invalid tariff disables Use; valid returns all three', async () => {
    const { onUse } = setup()
    await pickFeed()
    await userEvent.click(await screen.findByRole('radio', { name: /2309.90/ }))
    await userEvent.click(screen.getByRole('button', { name: /full 10-digit/ }))
    const input = screen.getByRole('textbox', { name: /tariff/i })
    expect(input).toHaveAttribute('dir', 'ltr')
    await userEvent.type(input, '2309100010')
    expect(screen.getByText(/Enter digits only/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Use/ })).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, '2309.90.00.10')
    expect(screen.queryByText(/Enter digits only/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /^Use/ }))
    expect(onUse).toHaveBeenCalledWith({ heading: '2309', sub: '230990', tariff: '2309900010' })
  })

  it('Skip returns undefined', async () => {
    const { onUse } = setup()
    await userEvent.click(screen.getByRole('button', { name: /Skip/ }))
    expect(onUse).toHaveBeenCalledWith(undefined)
  })

  it('shows the Arabic heading name in AR', async () => {
    setLanguage('ar')
    setup()
    await userEvent.type(screen.getByRole('searchbox'), '2309')
    expect(await screen.findByText(/محضرات/)).toBeInTheDocument()
  })

  it('typing a 6-digit code preselects heading and sub', async () => {
    const { onUse } = setup()
    await userEvent.type(screen.getByRole('searchbox'), '230990')
    await waitFor(() => expect(screen.getByRole('radio', { name: /2309.90/ })).toBeChecked())
    expect(screen.queryByText(/No matching/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Use 2309.90' }))
    expect(onUse).toHaveBeenCalledWith({ heading: '2309', sub: '230990' })
  })

  it('typing a dotted 10-digit code preselects all three', async () => {
    const { onUse } = setup()
    await userEvent.type(screen.getByRole('searchbox'), '2309.90.00.10')
    await waitFor(() => expect(screen.getByRole('button', { name: /^Use 2309\.90\.00\.10/ })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: /^Use/ }))
    expect(onUse).toHaveBeenCalledWith({ heading: '2309', sub: '230990', tariff: '2309900010' })
  })

  it('a 6-digit code with unknown sub keeps the heading only', async () => {
    const { onUse } = setup()
    await userEvent.type(screen.getByRole('searchbox'), '230999')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Use 2309' })).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Use 2309' }))
    expect(onUse).toHaveBeenCalledWith({ heading: '2309' })
  })

  it('initialises from value and Change returns to search', async () => {
    setup({ value: { heading: '2309', sub: '230990' } })
    expect(await screen.findByRole('radio', { name: /2309.90/ })).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Change' }))
    expect(screen.getByRole('searchbox')).toBeInTheDocument()
  })

  it('Esc calls onClose', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('browse chapters lists headings of a chapter', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Browse chapters' }))
    await userEvent.click(await screen.findByRole('button', { name: /^23/ }))
    expect(await screen.findByRole('button', { name: /2309/ })).toBeInTheDocument()
  })
})

describe('HsBadge', () => {
  it('formats and is ltr', () => {
    render(<HsBadge code="230990" variant="made" />)
    expect(screen.getByText('2309.90')).toHaveAttribute('dir', 'ltr')
  })
})
