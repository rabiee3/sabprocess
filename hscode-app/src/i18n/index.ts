import i18n, { type i18n as I18n } from 'i18next'
import { initReactI18next } from 'react-i18next'
import { safeStorage } from '../lib/safeStorage'
import en from './en.json'
import ar from './ar.json'

export type Lang = 'en' | 'ar'
export const LANG_KEY = 'hscode.lang'

function isLang(v: string | null): v is Lang {
  return v === 'en' || v === 'ar'
}

function applyToDocument(lang: Lang) {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}

export function initI18n(): I18n {
  const saved = safeStorage.get(LANG_KEY)
  const lang: Lang = isLang(saved) ? saved : 'en'
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources: { en: { translation: en }, ar: { translation: ar } },
      lng: lang,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      initAsync: false,
    })
  } else {
    void i18n.changeLanguage(lang)
  }
  applyToDocument(lang)
  return i18n
}

export function setLanguage(lang: Lang): void {
  void i18n.changeLanguage(lang)
  applyToDocument(lang)
  safeStorage.set(LANG_KEY, lang)
}
