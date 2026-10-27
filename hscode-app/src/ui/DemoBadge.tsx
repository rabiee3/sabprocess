import { useTranslation } from 'react-i18next'

/** The one "Demo" tag for sample factories, on the map cards and the factory page. */
export function DemoBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      data-demo-badge=""
      className={`inline-block rounded-sm bg-amber-50 px-2 py-0.5 text-caption font-semibold text-amber-900 ${className}`.trim()}
    >
      {t('demo.badge')}
    </span>
  )
}
