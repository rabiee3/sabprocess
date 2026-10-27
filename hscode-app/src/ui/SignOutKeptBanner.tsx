import { useTranslation } from 'react-i18next'
import { useSignOut } from '../auth/useSignOut'
import { Banner } from './Banner'

/** After a sign-out that kept unsynced survey data: a fixed info note under the header, like the other floating banners. */
export function SignOutKeptBanner() {
  const { t } = useTranslation()
  const { kept, dismiss } = useSignOut()
  if (!kept) return null
  return (
    <div className="fixed inset-x-2 top-14 z-[1300] lg:end-2 lg:start-auto lg:w-96">
      <Banner tone="info" onClose={dismiss}>{t('nav.signOutKeptData')}</Banner>
    </div>
  )
}
