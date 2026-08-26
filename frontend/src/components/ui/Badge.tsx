import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Status pill. Tones map to semantic tokens so certification/test/report
 * statuses stay consistent everywhere they appear.
 */

export type BadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'ai'
  | 'gold'
  | 'outline';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-muted/60 text-ink',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-ink',
  error: 'bg-error/12 text-error',
  info: 'bg-info/15 text-info',
  ai: 'bg-ai/12 text-ai',
  // `bg-gold` is a raw palette hue that does not darken in dark mode, so the
  // foreground must not flip with the theme. Never white text on #D6B319.
  gold: 'bg-gold text-ink-fixed',
  outline: 'border border-line-strong text-ink-muted',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  /** Small leading dot, useful for live/status semantics. */
  dot?: boolean;
  icon?: ReactNode;
}

export function Badge({
  tone = 'neutral',
  size = 'sm',
  dot = false,
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-pill font-medium',
        size === 'sm' ? 'px-2.5 py-0.5 text-caption' : 'px-3 py-1 text-label',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {dot ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {icon ? (
        <span aria-hidden="true" className="flex items-center">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
