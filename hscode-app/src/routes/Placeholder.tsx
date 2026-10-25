import { useTranslation } from 'react-i18next'
import type { Role } from '../auth/useAuth'
import { AppHeader } from '../ui/AppHeader'

export function Placeholder({ titleKey, role }: { titleKey: string; role?: Role }) {
  const { t } = useTranslation()
  return (
    <>
      <AppHeader role={role} />
      <main className="p-4">
        <h1 className="text-xl font-semibold text-ink-strong">{t(titleKey)}</h1>
        <p className="mt-2 text-ink-subtle">{t('common.comingSoon')}</p>
      </main>
    </>
  )
}
