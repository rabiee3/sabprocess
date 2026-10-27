import { useTranslation } from 'react-i18next'
import { useSignOut } from '../auth/useSignOut'
import { Banner } from './Banner'

/** After a sign-out that kept unsynced survey data: an info note under the header, positioned by FloatingBanners. */
export function SignOutKeptBanner() {
  const { t } = useTranslation()
  const { kept, dismiss } = useSignOut()
  if (!kept) return null
  return (
    <div>
      <Banner tone="info" onClose={dismiss}>{t('nav.signOutKeptData')}</Banner>
    </div>
  )
}
