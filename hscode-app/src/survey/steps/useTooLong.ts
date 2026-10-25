import { useTranslation } from 'react-i18next'
import { LIMITS, tooLong, type LimitField } from '../draft'

/** The "too long" message for `field` when stepErrors flagged it. */
export function useTooLong(errors: string[]): (field: LimitField) => string | undefined {
  const { t } = useTranslation()
  return (field) => (errors.includes(tooLong(field)) ? t('errors.tooLong', { max: LIMITS[field] }) : undefined)
}
