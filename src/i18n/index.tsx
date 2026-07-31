import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import ar from './ar';
import en from './en';
import type { Translations } from './ar';

export type Language = 'ar' | 'en';

interface LanguageContextType {
  lang: Language;
  t: Translations;
  setLanguage: (lang: Language) => void;
  isRTL: boolean;
}

const translations: Record<Language, Translations> = { ar, en };

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ar',
  t: ar,
  setLanguage: () => {},
  isRTL: true,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved === 'en' || saved === 'ar') ? saved : 'ar';
  });

  const t = translations[lang];
  const isRTL = lang === 'ar';

  const setLanguage = useCallback((newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('app_language', newLang);
  }, []);

  // Apply dir and lang to document
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isRTL]);

  // Sync with profile preferred_language when user logs in
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'app_language' && (e.newValue === 'ar' || e.newValue === 'en')) {
        setLang(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, t, setLanguage, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
