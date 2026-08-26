import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { LanguageCode } from '@shared/types';

import { STORAGE_KEYS } from '@/lib/constants';
import i18n, { detectInitialLanguage } from '@/i18n/config';

/**
 * Language.
 *
 * Wraps i18next so the rest of the app never touches the i18n instance
 * directly. The selected language is also the default language for AI answers
 * and voice, which is why it lives in context rather than only inside i18next:
 * `services/aiApi.ts` needs to read it when posting a question.
 */

export interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

export const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => detectInitialLanguage());

  useEffect(() => {
    // Keeps assistive tech and font selection correct for Indic scripts.
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    void i18n.changeLanguage(next);
    try {
      localStorage.setItem(STORAGE_KEYS.language, next);
    } catch {
      // Non-fatal: the choice still applies for this session.
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
