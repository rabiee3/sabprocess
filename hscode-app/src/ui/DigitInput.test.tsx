import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initI18n } from '../i18n'
import { DigitInput } from './DigitInput'

function Harness({ onChange }: { onChange: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <DigitInput
      length={6}
      value={v}
      onChange={(n) => {
        setV(n)
        onChange(n)
      }}
    />
  )
}

describe('DigitInput', () => {
  initI18n()

  it('typing 6 digits emits the joined value', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getAllByRole('textbox')[0])
    await userEvent.keyboard('482913')
    expect(onChange).toHaveBeenLastCalledWith('482913')
  })

  it('pasting Arabic-Indic digits fills all boxes as ASCII', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.click(screen.getAllByRole('textbox')[0])
    await userEvent.paste('٤٨٢٩١٣')
    expect(onChange).toHaveBeenLastCalledWith('482913')
  })

  it('backspace on an empty box focuses the previous one', async () => {
    render(<Harness onChange={() => {}} />)
    const boxes = screen.getAllByRole('textbox')
    await userEvent.click(boxes[0])
    await userEvent.keyboard('12')
    expect(boxes[2]).toHaveFocus()
    await userEvent.keyboard('{Backspace}')
    expect(boxes[1]).toHaveFocus()
  })
})
