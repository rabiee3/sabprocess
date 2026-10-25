import { useTranslation } from 'react-i18next'
import { setLanguage, type Lang } from '../i18n'

const LANGS: { code: Lang; labelKey: string; font: string }[] = [
  { code: 'en', labelKey: 'lang.en', font: 'font-sans' },
  { code: 'ar', labelKey: 'lang.ar', font: 'font-ar' },
]

export function LangToggle() {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage ?? i18n.language
  return (
    <div role="group" aria-label={t('lang.label')} className="inline-flex overflow-hidden rounded border border-line">
      {LANGS.map(({ code, labelKey, font }) => {
        const active = current === code
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            onClick={() => setLanguage(code)}
            className={`${font} min-h-touch min-w-11 px-3 text-sm font-semibold ${
              active ? 'bg-brand-500 text-ink-strong' : 'bg-surface text-ink'
            }`}
          >
            {t(labelKey)}
          </button>
        )
      })}
    </div>
  )
}
