import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Logo } from './Logo'

export type Portal = 'surveyor' | 'admin'

/** The logo plus a portal tag. The whole thing always links back to the client map at `/`. */
export function PortalBrand({ portal, variant = 'light' }: { portal: Portal; variant?: 'light' | 'dark' }) {
  const { t } = useTranslation()
  const dark = variant === 'dark'
  return (
    <Link to="/" aria-label={t('nav.backToMap')} className="inline-flex min-h-touch items-center gap-2 rounded">
      <Logo variant={variant} />
      <span
        className={`rounded px-2 py-1 text-xs font-semibold ${dark ? 'bg-white/15 text-white' : 'bg-surface-alt text-ink'}`}
      >
        {t(`portal.${portal}`)}
      </span>
    </Link>
  )
}
