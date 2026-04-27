import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import es from './locales/es.json'
import pt from './locales/pt.json'

export const SUPPORTED_LANGUAGES = ['pt', 'en', 'es'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_STORAGE_KEY = 'roi.i18n.language'

function detectInitialLanguage(): SupportedLanguage {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored && (SUPPORTED_LANGUAGES as readonly string[]).includes(stored)) {
    return stored as SupportedLanguage
  }
  const browser = navigator.language?.slice(0, 2).toLowerCase()
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(browser)) {
    return browser as SupportedLanguage
  }
  return 'pt'
}

void i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    en: { translation: en },
    es: { translation: es },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'pt',
  interpolation: { escapeValue: false },
  returnNull: false,
})

i18n.on('languageChanged', (lng) => {
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(lng)) {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
  }
})

export default i18n
