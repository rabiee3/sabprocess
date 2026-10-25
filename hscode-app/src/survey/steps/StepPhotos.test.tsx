import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { initI18n } from '../../i18n'
import en from '../../i18n/en.json'
import { emptyDraft } from '../draft'
import { StepPhotos } from './StepPhotos'

initI18n()

describe('StepPhotos', () => {
  it('shows the photo intro once', () => {
    render(<StepPhotos draft={emptyDraft('f')} dispatch={vi.fn()} errors={[]} />)
    expect(screen.getAllByText(en.survey.photos.intro)).toHaveLength(1)
  })
})
