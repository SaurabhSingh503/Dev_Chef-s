import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { STORAGE_KEYS } from '@/lib/constants';

/**
 * Theme.
 *
 * The reference design is predominantly warm and light, with one deliberately
 * dark screen (the handbook/library). Dark mode promotes that treatment to the
 * whole interface rather than inventing a new palette — every colour is already
 * a token, so `[data-theme='dark']` in `index.css` does the work.
 *
 * First visit follows the OS preference; an explicit choice is remembered.
 */

export type Theme = 'light' | 'dark';

export interface ThemeContextValue {
  theme: Theme;
  /** True when the value came from the OS rather than an explicit choice. */
  isSystem: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // Private-browsing or blocked storage: fall back to the OS preference.
    return null;
  }
}

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Theme | null>(() => readStoredTheme());
  const [system, setSystem] = useState<Theme>(() => systemTheme());

  const theme = stored ?? system;

  // Track OS changes only while the user has not made an explicit choice.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light');
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    // Keeps native form controls and scrollbars consistent with the theme.
    root.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setStored(next);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, next);
    } catch {
      // Non-fatal: the theme still applies for this session.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, isSystem: stored === null, setTheme, toggleTheme }),
    [theme, stored, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
