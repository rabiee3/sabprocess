import g from '../assets/icons/google-g.svg?raw'
import { Icon } from './Icon'

type Props = {
  onClick: () => void
  label: string
  compact?: boolean
  disabled?: boolean
  /** Below 640px show only the G (Google's icon-only button); the label stays the accessible name. */
  iconOnlyOnPhone?: boolean
}

/** Google-branded sign-in button. The G sits at the inline start and is never mirrored. */
export function GoogleButton({ onClick, label, compact, disabled, iconOnlyOnPhone }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'inline-flex min-h-touch items-center gap-2 rounded border border-[#747775] bg-white font-medium whitespace-nowrap text-ink-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60 ' +
        (compact ? 'px-3 text-sm' : 'w-full justify-center px-4 text-body') +
        (iconOnlyOnPhone ? ' min-w-11 justify-center' : '')
      }
    >
      <Icon svg={g} className="size-[18px]" />
      <span className={iconOnlyOnPhone ? 'max-sm:sr-only' : undefined}>{label}</span>
    </button>
  )
}
