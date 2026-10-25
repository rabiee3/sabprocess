import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toAsciiDigits } from '../auth/invite'

type Props = { length?: number; value: string; onChange: (v: string) => void; error?: boolean }

export function DigitInput({ length = 6, value, onChange, error }: Props) {
  const { t } = useTranslation()
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const label = t('survey.invite.title')

  const focus = (i: number) => {
    const el = refs.current[Math.max(0, Math.min(length - 1, i))]
    el?.focus()
    el?.select()
  }

  // Places digits at box i (clamped so the value stays contiguous), replacing `replace` chars.
  const put = (i: number, digits: string, replace: number) => {
    const at = Math.min(i, value.length)
    onChange((value.slice(0, at) + digits + value.slice(at + replace)).slice(0, length))
    focus(at + digits.length)
  }

  const onInput = (i: number, raw: string) => {
    const digits = toAsciiDigits(raw)
    if (!digits) {
      if (raw === '' && i < value.length) onChange(value.slice(0, i) + value.slice(i + 1))
      return
    }
    put(i, digits, 1)
  }

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      e.preventDefault()
      onChange(value.slice(0, i - 1))
      focus(i - 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Boxes are visually LTR, so left is always the previous box.
      e.preventDefault()
      focus(i + (e.key === 'ArrowLeft' ? -1 : 1))
    }
  }

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const digits = toAsciiDigits(e.clipboardData.getData('text'))
    if (digits) put(i, digits, length)
  }

  return (
    <div role="group" aria-label={label} dir="ltr" className="flex justify-center gap-2">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`${label} ${i + 1}`}
          aria-invalid={error || undefined}
          value={value[i] ?? ''}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
          className={`min-h-cta w-12 rounded border bg-surface text-center text-title font-semibold text-ink-strong ${
            error ? 'border-red-600' : 'border-line-strong'
          }`}
        />
      ))}
    </div>
  )
}
