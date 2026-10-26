import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Logo } from './Logo'

export type Portal = 'surveyor' | 'admin'

/**
 * The logo plus a portal tag. The whole thing always links back to the client map at `/`. No aria-label:
 * the name must contain the visible text (WCAG 2.5.3), so it is the logo's name plus the tag, and
 * "Back to the map" is the title (the description and a pointer hint).
 */
export function PortalBrand({ portal, variant = 'light' }: { portal: Portal; variant?: 'light' | 'dark' }) {
  const { t } = useTranslation()
  const dark = variant === 'dark'
  return (
    <Link to="/" title={t('nav.backToMap')} className="inline-flex min-h-touch items-center gap-2 rounded">
      {/* 32px tall, like the client header's logo, so logo · tag · EN/ع · Sign out fit a 360px phone. */}
      <span className="inline-flex [&_svg]:h-8 [&_svg]:w-auto">
        <Logo variant={variant} />
      </span>
      {/* A space, so the name reads "HSCode Surveyor", not "HSCodeSurveyor" (flex drops it visually). */}
      {' '}
      <span
        className={`rounded px-2 py-1 text-xs font-semibold ${dark ? 'bg-white/15 text-white' : 'bg-surface-alt text-ink'}`}
      >
        {t(`portal.${portal}`)}
      </span>
    </Link>
  )
}
