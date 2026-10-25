import type { Dispatch, ReactNode } from 'react'
import type { Draft, DraftAction } from '../draft'

export type StepProps = {
  draft: Draft
  dispatch: Dispatch<DraftAction>
  /** i18n keys of the current step's errors, or [] until the user has tried Next. */
  errors: string[]
}

export const INPUT = 'min-h-control w-full rounded border border-line-strong bg-surface px-3 text-body text-ink-strong'

export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-1 text-caption text-red-700">
      {children}
    </p>
  )
}

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: ReactNode }) {
  return (
    <label className="mt-4 block first:mt-0">
      <span className="mb-1 block text-label font-semibold text-ink">{label}</span>
      {children}
      {error ? <FieldError>{error}</FieldError> : null}
    </label>
  )
}
