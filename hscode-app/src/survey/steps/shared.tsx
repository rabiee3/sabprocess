import type { ClipboardEvent, Dispatch, InputHTMLAttributes, ReactNode } from 'react'
import { LIMITS, type Draft, type DraftAction, type LimitField } from '../draft'

export type StepProps = {
  draft: Draft
  dispatch: Dispatch<DraftAction>
  /** stepErrors entries of the current step (i18n keys or tooLong(field)), or [] until the user has tried Next. */
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

type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'maxLength'> & {
  limit: LimitField
  value: string
  onValue: (v: string) => void
}

function selection(el: HTMLInputElement, fallback: number): [number, number] {
  try {
    return [el.selectionStart ?? fallback, el.selectionEnd ?? fallback]
  } catch {
    return [fallback, fallback] // type=url/email have no selection API in some browsers
  }
}

/**
 * A text input capped at LIMITS[limit]: maxLength stops typing. A paste that would overflow is kept whole
 * (the browser would cut it silently) so stepErrors can flag it and the surveyor sees what was cut.
 */
export function TextInput({ limit, value, onValue, className = INPUT, ...rest }: TextInputProps) {
  const max = LIMITS[limit]
  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text')
    const [start, end] = selection(e.currentTarget, value.length)
    const next = value.slice(0, start) + text + value.slice(end)
    if (next.length <= max) return
    e.preventDefault()
    onValue(next)
  }
  return (
    <input {...rest} className={className} maxLength={max} value={value} onChange={(e) => onValue(e.target.value)} onPaste={onPaste} />
  )
}
