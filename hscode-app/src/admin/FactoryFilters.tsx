import { useTranslation } from 'react-i18next'
import { areas, sectors } from '../data'

import type { Filters } from './filterRows'

const FIELD = 'min-h-touch rounded border border-line-strong bg-surface px-3 text-body text-ink'

export function FactoryFilters({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const { t, i18n } = useTranslation()
  const ar = i18n.language.startsWith('ar')
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-body-sm text-ink-subtle">
        {t('admin.factories.search')}
        <input
          type="search"
          value={value.text}
          placeholder={t('admin.factories.searchPlaceholder')}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1 text-body-sm text-ink-subtle">
        {t('admin.factories.filterArea')}
        <select value={value.area} onChange={(e) => onChange({ ...value, area: e.target.value })} className={FIELD}>
          <option value="">{t('admin.factories.allAreas')}</option>
          {areas().map((a) => (
            <option key={a.id} value={a.id}>
              {ar ? a.ar : a.en}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-body-sm text-ink-subtle">
        {t('admin.factories.filterSector')}
        <select value={value.sector} onChange={(e) => onChange({ ...value, sector: e.target.value })} className={FIELD}>
          <option value="">{t('admin.factories.allSectors')}</option>
          {sectors().map((s) => (
            <option key={s.id} value={s.id}>
              {ar ? s.ar : s.en}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
