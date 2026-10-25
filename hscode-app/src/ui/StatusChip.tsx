import { useTranslation } from 'react-i18next'
import clockIcon from '../assets/icons/clock.svg?raw'
import checkIcon from '../assets/icons/check-circle.svg?raw'
import alertIcon from '../assets/icons/alert-circle.svg?raw'
import cloudOffIcon from '../assets/icons/cloud-off.svg?raw'
import warningIcon from '../assets/icons/warning.svg?raw'

export type ChipStatus = 'pending' | 'approved' | 'rejected' | 'savedOnPhone' | 'uploadFailed'

const STYLES: Record<ChipStatus, { box: string; svg: string }> = {
  pending: { box: 'bg-amber-50 text-amber-900', svg: clockIcon },
  approved: { box: 'bg-green-50 text-green-700', svg: checkIcon },
  rejected: { box: 'bg-red-50 text-red-700', svg: alertIcon },
  savedOnPhone: { box: 'bg-blue-50 text-blue-800', svg: cloudOffIcon },
  uploadFailed: { box: 'bg-red-50 text-red-700', svg: warningIcon },
}

/** Icon + text, never colour alone. */
export function StatusChip({ status }: { status: ChipStatus }) {
  const { t } = useTranslation()
  const s = STYLES[status]
  return (
    <span data-chip className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold ${s.box}`}>
      <span aria-hidden="true" className="size-4 shrink-0 [&>svg]:size-4" dangerouslySetInnerHTML={{ __html: s.svg }} />
      {t(`survey.list.${status}`)}
    </span>
  )
}
