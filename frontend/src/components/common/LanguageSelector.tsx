import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import type { LanguageCode } from '@shared/types';

import { LANGUAGES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';

/**
 * Language selector.
 *
 * Built on a native `select` deliberately. A custom listbox would need roving
 * focus, type-ahead and screen-reader semantics reimplemented; the native
 * control gets all of that free, works on touch, and can still be styled as the
 * small pill the reference shows. Each option is labelled in its own script,
 * because someone looking for Tamil is looking for "தமிழ்", not "Tamil".
 */
export function LanguageSelector({
  className,
  tone = 'default',
}: {
  className?: string;
  tone?: 'default' | 'onDark';
}) {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {t('common.language', 'Language')}
      </label>

      <select
        id={id}
        value={language}
        onChange={(event) => setLanguage(event.target.value as LanguageCode)}
        className={cn(
          'cursor-pointer appearance-none rounded-pill py-1.5 pl-4 pr-8 text-label font-medium transition-colors duration-300',
          tone === 'onDark'
            ? 'bg-white/15 text-invert hover:bg-white/25'
            : 'bg-primary text-invert hover:bg-primary-hover',
        )}
      >
        {LANGUAGES.map((option) => (
          <option key={option.code} value={option.code} className="bg-surface text-ink">
            {option.native}
          </option>
        ))}
      </select>

      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2',
          tone === 'onDark' ? 'text-invert' : 'text-invert',
        )}
      >
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="m1 1 4 4 4-4" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}
