import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Empty presentation.
 *
 * An empty state is a design opportunity, not an error: it explains why the
 * region is blank and offers the single most useful next action.
 */

export interface EmptyStateProps {
  title: string;
  description?: string;
  /** Decorative glyph or icon. Kept simple so no icon dependency is required. */
  icon?: ReactNode;
  /** Primary call to action. */
  action?: ReactNode;
  /** Secondary suggestions, e.g. example searches. */
  footer?: ReactNode;
  variant?: 'inline' | 'page';
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  footer,
  variant = 'inline',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 rounded-card border border-dashed border-line-strong bg-surface px-6 text-center',
        variant === 'page' ? 'min-h-[50vh] justify-center py-16' : 'py-14',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60 font-devanagari text-h2 text-ink-muted"
      >
        {icon ?? 'मा'}
      </span>

      <div className="max-w-md">
        <h2 className="text-h3 font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1.5 text-body text-ink-muted">{description}</p> : null}
      </div>

      {action}
      {footer ? <div className="mt-1">{footer}</div> : null}
    </div>
  );
}
