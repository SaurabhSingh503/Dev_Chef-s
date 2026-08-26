/**
 * MANAK — i18n bootstrap.
 *
 * Eight languages are in scope. English is complete and is the fallback, Hindi
 * is substantially translated, and the remaining locales are present with
 * partial coverage. Components call `t('key', 'English default')`, so an
 * untranslated key renders readable English rather than a raw dotted key —
 * which is what makes shipping partial locales safe.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { LanguageCode } from '@shared/types';
import { SUPPORTED_LANGUAGES } from '@shared/types';
import { STORAGE_KEYS } from '@/lib/constants';

import bn from './locales/bn.json';
import en from './locales/en.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import mr from './locales/mr.json';
import pa from './locales/pa.json';
import ta from './locales/ta.json';
import te from './locales/te.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  bn: { translation: bn },
  ta: { translation: ta },
  te: { translation: te },
  mr: { translation: mr },
  kn: { translation: kn },
  pa: { translation: pa },
} as const;

function isLanguageCode(value: string | null): value is LanguageCode {
  return value !== null && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Stored choice → browser language → English. */
export function detectInitialLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.language);
    if (isLanguageCode(stored)) return stored;
  } catch {
    // Storage unavailable — fall through to browser detection.
  }

  const browser = typeof navigator === 'undefined' ? '' : navigator.language.split('-')[0];
  return isLanguageCode(browser ?? null) ? (browser as LanguageCode) : 'en';
}

void i18n.use(initReactI18next).init({
  resources,
  lng: detectInitialLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...SUPPORTED_LANGUAGES],
  defaultNS: 'translation',
  interpolation: { escapeValue: false },
  // Empty strings in a partial locale should fall back, not render blank.
  returnEmptyString: false,
  react: { useSuspense: false },
});

export default i18n;
