import { useId, useRef } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

/**
 * MANAK search field.
 *
 * `hero` reproduces the reference's signature element: a very wide pill with a
 * centred placeholder sitting directly beneath the headline, which is the main
 * entry point to the whole product. Search is a first-class object in this
 * design, not a utility tucked into a corner — so it gets its own component
 * rather than being a styled `Input`.
 */

export type SearchBarVariant = 'hero' | 'default' | 'onDark';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired on submit (Enter or the button). Omit for live-filter usage. */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  /** Visually hidden label. Required — a bare search box is not accessible. */
  label: string;
  variant?: SearchBarVariant;
  loading?: boolean;
  autoFocus?: boolean;
  /** Renders a submit button with this content instead of an icon-only button. */
  submitLabel?: ReactNode;
  /** Suggestion/filter chips rendered under the field. */
  footer?: ReactNode;
  name?: string;
  className?: string;
}

/**
 * Contrast notes (measured, sRGB):
 *   ink on cream #F2E6B9 ....... 13.0:1  ✓
 *   ink/70 placeholder on cream .. 4.6:1  ✓
 *   ink on orange #E98C25 ....... 6.0:1  ✓ but ink/45 placeholder is 2.2:1  ✗
 * So the pill is cream, not `bg-surface`. This also matches the reference, where
 * the full-width search pill is light against the page rather than orange.
 */
const SHELLS: Record<SearchBarVariant, string> = {
  hero:
    'h-16 bg-cream border border-ink/12 shadow-raised focus-within:border-ink/35 sm:h-[4.25rem]',
  default: 'h-12 bg-cream border border-line-strong focus-within:border-ink/50 shadow-card',
  onDark: 'h-12 bg-white/10 border border-white/25 focus-within:border-white/60 backdrop-blur',
};

const FIELDS: Record<SearchBarVariant, string> = {
  // Centred placeholder is the reference behaviour; text left-aligns once typed.
  hero: 'text-body-lg text-ink-fixed placeholder:text-ink-fixed/70 text-center focus:text-left',
  default: 'text-body text-ink-fixed placeholder:text-ink-fixed/70',
  onDark: 'text-body text-invert placeholder:text-white/75',
};

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search standards, products or certifications',
  label,
  variant = 'default',
  loading = false,
  autoFocus = false,
  submitLabel,
  footer,
  name = 'q',
  className,
}: SearchBarProps) {
  const generatedId = useId();
  const inputId = `search-${generatedId}`;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(value.trim());
  };

  const clear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('w-full', className)}>
      <form role="search" onSubmit={handleSubmit} className="w-full">
        <label htmlFor={inputId} className="sr-only">
          {label}
        </label>

        <div
          className={cn(
            'flex w-full items-center gap-2 rounded-pill transition-colors duration-300',
            variant === 'hero' ? 'px-6 sm:px-8' : 'px-4',
            SHELLS[variant],
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'shrink-0',
              variant === 'onDark' ? 'text-invert/70' : 'text-ink/55',
              variant === 'hero' && 'hidden sm:block',
            )}
          >
            <SearchGlyph />
          </span>

          <input
            ref={inputRef}
            id={inputId}
            name={name}
            type="search"
            value={value}
            autoFocus={autoFocus}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            className={cn(
              'min-w-0 flex-1 bg-transparent outline-none',
              // Suppress the browser's own clear button; we render our own.
              '[&::-webkit-search-cancel-button]:appearance-none',
              FIELDS[variant],
            )}
          />

          {loading ? (
            <Spinner
              size="sm"
              label="Searching"
              className={variant === 'onDark' ? 'text-invert' : 'text-primary'}
            />
          ) : null}

          {value && !loading ? (
            <button
              type="button"
              onClick={clear}
              className={cn(
                'shrink-0 rounded-pill px-2 text-caption font-medium transition-colors',
                variant === 'onDark'
                  ? 'text-invert/70 hover:text-invert'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              Clear
              <span className="sr-only"> search</span>
            </button>
          ) : null}

          {onSubmit ? (
            <button
              type="submit"
              className={cn(
                'shrink-0 rounded-pill bg-primary font-medium text-ink-fixed transition-all duration-300 ease-premium hover:bg-primary-hover active:translate-y-px',
                variant === 'hero' ? 'h-11 px-6 text-body' : 'h-9 px-4 text-label',
              )}
            >
              {submitLabel ?? (
                <>
                  <span aria-hidden="true">Search</span>
                  <span className="sr-only">Submit search</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </form>

      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7.75" cy="7.75" r="5.25" />
      <path d="m11.75 11.75 3.75 3.75" />
    </svg>
  );
}
