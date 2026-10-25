import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import infoIcon from '../assets/icons/alert-circle.svg?raw'
import warningIcon from '../assets/icons/warning.svg?raw'
import successIcon from '../assets/icons/check-circle.svg?raw'
import closeIcon from '../assets/icons/close.svg?raw'

export type BannerTone = 'info' | 'warning' | 'danger' | 'success'

const TONES: Record<BannerTone, { box: string; icon: string; svg: string }> = {
  info: { box: 'bg-blue-50 text-blue-800', icon: 'text-blue-800', svg: infoIcon },
  warning: { box: 'bg-amber-50 text-ink-strong', icon: 'text-amber-900', svg: warningIcon },
  danger: { box: 'bg-red-50 text-red-700', icon: 'text-red-600', svg: infoIcon },
  success: { box: 'bg-green-50 text-green-700', icon: 'text-green-700', svg: successIcon },
}

type Props = {
  tone: BannerTone
  title?: string
  children?: ReactNode
  onClose?: () => void
}

export function Banner({ tone, title, children, onClose }: Props) {
  const { t } = useTranslation()
  const c = TONES[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded p-3 text-sm ${c.box}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 size-6 shrink-0 ${c.icon}`}
        dangerouslySetInnerHTML={{ __html: c.svg }}
      />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="-m-2 flex min-h-touch min-w-11 shrink-0 items-center justify-center"
        >
          <span aria-hidden="true" className="size-6" dangerouslySetInnerHTML={{ __html: closeIcon }} />
        </button>
      )}
    </div>
  )
}
