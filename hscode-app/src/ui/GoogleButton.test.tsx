import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GoogleButton } from './GoogleButton'

describe('GoogleButton', () => {
  it('shows the 4-colour G and the label, and calls onClick', async () => {
    const onClick = vi.fn()
    render(<GoogleButton onClick={onClick} label="Continue with Google" />)
    const btn = screen.getByRole('button', { name: 'Continue with Google' })
    expect(btn.querySelectorAll('svg path')).toHaveLength(4)
    await userEvent.click(btn)
    expect(onClick).toHaveBeenCalled()
  })
  it('compact and disabled', () => {
    render(<GoogleButton compact disabled onClick={() => {}} label="Sign in" />)
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  })
})
