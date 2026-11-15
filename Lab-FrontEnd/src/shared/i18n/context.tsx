import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { TRANSLATIONS, localizeStatus, type Lang } from './translations'

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  tr: (typeof TRANSLATIONS)['id'] | (typeof TRANSLATIONS)['en']
  statusLabel: (raw: string) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function readSavedLang(): Lang {
  try {
    const val = window.localStorage.getItem('ifa-lang')
    return val === 'en' ? 'en' : 'id'
  } catch {
    return 'id'
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readSavedLang)

  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      window.localStorage.setItem('ifa-lang', next)
    } catch {
      /* ignore storage errors */
    }
  }

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value: I18nContextValue = {
    lang,
    setLang,
    tr: TRANSLATIONS[lang],
    statusLabel: (raw: string) => localizeStatus(raw, lang),
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    return {
      lang: 'id',
      setLang: () => undefined,
      tr: TRANSLATIONS.id,
      statusLabel: (raw: string) => raw,
    }
  }
  return ctx
}
