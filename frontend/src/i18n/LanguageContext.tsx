import React, { createContext, useContext, useState } from 'react';
import { translations, Language } from './translations';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('manak_language');
    if (['en', 'hi', 'kn', 'ta', 'te', 'or', 'bn', 'gu'].includes(saved || '')) return saved as Language;
    return 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('manak_language', lang);
  };

  const t = (key: string): string => {
    const dict = translations[language];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (dict as any)?.[key];
    if (val !== undefined) return val;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (translations['en'] as any)[key] ?? key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
