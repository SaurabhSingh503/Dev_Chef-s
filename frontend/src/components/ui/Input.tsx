import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * MANAK text input.
 *
 * Deliberately sharp-cornered — the reference contrasts rectangular fields
 * against pill buttons. Errors are wired through `aria-invalid` and
 * `aria-describedby` so screen readers announce them, not just sighted users.
 */

export type InputTone = 'default' | 'solid' | 'onDark';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-invalid'> {
  label: string;
  /** Hide the visual label but keep it for assistive tech. */
  hideLabel?: boolean;
  hint?: string;
  error?: string | null;
  leadingIcon?: ReactNode;
  /**
   * `solid` matches the reference facility-search screen, where fields are
   * filled orange blocks with the label set inside them.
   * `onDark` is for the dark handbook/library surfaces.
   */
  tone?: InputTone;
  fullWidth?: boolean;
}

/**
 * Opacity values here are measured, not eyeballed. Against the gold canvas
 * (#D6B319, relative luminance 0.466) a placeholder at `ink/45` is only 2.4:1
 * and a border at `ink/40` is 2.1:1 — both fail. `ink/75` reaches 4.7:1 (AA
 * text) and `ink/60` reaches 3.2:1 (AA non-text). `ink` and `surface-raised`
 * both invert together in dark mode, so these stay correct in both themes.
 */
const TONES: Record<InputTone, string> = {
  default:
    'bg-transparent border border-ink/60 text-ink placeholder:text-ink/75 hover:border-ink/80 focus:border-ink',
  solid:
    'bg-surface-raised border border-transparent text-ink placeholder:text-ink/85 hover:brightness-105 focus:border-ink/60',
  onDark:
    'bg-white/10 border border-white/55 text-invert placeholder:text-white/70 hover:bg-white/15 focus:border-white/85',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hideLabel = false,
    hint,
    error,
    leadingIcon,
    tone = 'default',
    fullWidth = true,
    className,
    id,
    required,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? `input-${generatedId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      <label
        htmlFor={inputId}
        className={cn(
          'text-label font-medium',
          tone === 'onDark' ? 'text-invert/90' : 'text-ink',
          hideLabel && 'sr-only',
        )}
      >
        {label}
        {required ? (
          <span className="ml-1 text-error" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="relative flex items-center">
        {leadingIcon ? (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-3 flex items-center',
              tone === 'onDark' ? 'text-invert/70' : 'text-ink/60',
            )}
          >
            {leadingIcon}
          </span>
        ) : null}

        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-errormessage={error ? errorId : undefined}
          className={cn(
            'h-11 w-full rounded-input px-3.5 text-body outline-none transition-colors duration-200',
            leadingIcon && 'pl-10',
            TONES[tone],
            error && 'border-error focus:border-error',
            className,
          )}
          {...rest}
        />
      </div>

      {hint && !error ? (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-caption font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
});
