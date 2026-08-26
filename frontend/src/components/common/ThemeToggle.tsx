import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/useTheme';

/**
 * Theme toggle.
 *
 * The reference draws this as a bare sun with radiating strokes rather than a
 * boxed icon button, so the control keeps that silhouette — but it is a real
 * `button` with `aria-pressed`, not a decorative glyph.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      title={isDark ? t('common.lightMode', 'Light mode') : t('common.darkMode', 'Dark mode')}
      className={cn(
        'group relative flex h-10 w-10 items-center justify-center rounded-full text-primary transition-transform duration-500 ease-premium hover:scale-110',
        className,
      )}
    >
      <span className="sr-only">
        {isDark ? t('common.lightMode', 'Light mode') : t('common.darkMode', 'Dark mode')}
      </span>

      {isDark ? (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7Z" />
        </svg>
      ) : (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4.1" fill="currentColor" stroke="none" />
          <g className="origin-center transition-transform duration-700 ease-premium group-hover:rotate-45">
            <path d="M12 2.4v2.3M12 19.3v2.3M2.4 12h2.3M19.3 12h2.3M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
          </g>
        </svg>
      )}
    </button>
  );
}
