import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import closeIcon from '../assets/icons/close.svg?raw'

type Props = {
  step: number
  total: number
  title: string
  onClose: () => void
  onBack?: () => void
  onNext: () => void
  nextLabel: string
  nextDisabled?: boolean
  children: ReactNode
}

export function Stepper({ step, total, title, onClose, onBack, onNext, nextLabel, nextDisabled, children }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-line bg-surface p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="-ms-2 flex min-h-touch min-w-11 items-center justify-center"
          >
            <span aria-hidden="true" className="size-6" dangerouslySetInnerHTML={{ __html: closeIcon }} />
          </button>
          <div className="min-w-0">
            <p className="text-caption text-ink-muted">{t('survey.step.counter', { n: step, total })}</p>
            <h1 className="truncate text-section font-semibold text-ink-strong">{title}</h1>
          </div>
        </div>
        <div className="mt-2 flex gap-1" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-brand-600' : 'bg-line'}`} />
          ))}
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 p-4 pb-28">{children}</main>
      <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-surface p-3">
        <div className="mx-auto flex max-w-md gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="min-h-cta rounded border border-line-strong bg-surface px-5 text-body font-semibold text-ink-strong"
            >
              {t('survey.step.back')}
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="min-h-cta flex-1 rounded bg-brand-500 px-4 text-body font-semibold text-ink-strong disabled:opacity-50"
          >
            {nextLabel}
          </button>
        </div>
      </footer>
    </div>
  )
}
