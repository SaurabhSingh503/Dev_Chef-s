import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * MANAK button.
 *
 * Shape note: the reference design pairs sharp-cornered inputs with fully
 * rounded pill buttons. That contrast is intentional, so `primary` and
 * `secondary` are pills by default. `square` exists for toolbar/segmented
 * contexts where a pill would break alignment.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium transition-all duration-300 ease-premium ' +
  'disabled:opacity-55 disabled:pointer-events-none select-none whitespace-nowrap';

const VARIANTS: Record<ButtonVariant, string> = {
  // `text-ink-fixed`, not `text-invert`: the pill stays orange in dark mode, so
  // a theme-flipping foreground would fail contrast. See index.css for numbers.
  primary:
    'bg-primary text-ink-fixed shadow-card hover:bg-primary-hover hover:shadow-raised active:translate-y-px',
  secondary:
    'bg-cream text-ink-fixed hover:bg-cream/85 shadow-card active:translate-y-px',
  outline:
    'border border-ink/35 text-ink hover:border-ink hover:bg-ink/5',
  ghost: 'text-ink hover:bg-ink/10',
  danger: 'bg-error text-invert hover:brightness-110 shadow-card',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-label',
  md: 'h-11 px-6 text-body',
  lg: 'h-14 px-9 text-body-lg',
};

/** Exported so anchors and `react-router` `Link`s can borrow button styling. */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra?: string,
  square = false,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], square ? 'rounded-input' : 'rounded-pill', extra);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner, disables interaction and announces busy state. */
  loading?: boolean;
  /** Accessible text announced while loading. */
  loadingLabel?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  /** Sharp corners instead of a pill — for segmented/toolbar groups. */
  square?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingLabel = 'Working…',
    leadingIcon,
    trailingIcon,
    fullWidth = false,
    square = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled ?? loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, cn(fullWidth && 'w-full', className), square)}
      {...rest}
    >
      {loading ? (
        <>
          <span
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
          <span className="sr-only">{loadingLabel}</span>
          <span aria-hidden={children ? undefined : true}>{children}</span>
        </>
      ) : (
        <>
          {leadingIcon ? <span aria-hidden="true">{leadingIcon}</span> : null}
          {children}
          {trailingIcon ? <span aria-hidden="true">{trailingIcon}</span> : null}
        </>
      )}
    </button>
  );
});
