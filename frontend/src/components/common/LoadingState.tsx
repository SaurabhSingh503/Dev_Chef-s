import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

/**
 * Loading presentation.
 *
 * `skeleton` variants are preferred for content regions because they preserve
 * layout and avoid the reflow jolt a centred spinner causes. A spinner is only
 * right for short, indeterminate waits.
 */

export type LoadingVariant = 'spinner' | 'inline' | 'cards' | 'rows' | 'page';

export interface LoadingStateProps {
  variant?: LoadingVariant;
  /** Announced to assistive tech and shown for spinner variants. */
  label?: string;
  /** Number of skeleton placeholders for `cards` / `rows`. */
  count?: number;
  className?: string;
}

export function LoadingState({
  variant = 'spinner',
  label = 'Loading',
  count = 8,
  className,
}: LoadingStateProps) {
  if (variant === 'inline') {
    return (
      <span className={cn('inline-flex items-center gap-2 text-body text-ink-muted', className)}>
        <Spinner size="sm" label={null} />
        {label}
      </span>
    );
  }

  if (variant === 'cards') {
    return (
      <div
        role="status"
        aria-label={label}
        className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-4', className)}
      >
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="rounded-card border border-line bg-surface p-5">
            <Skeleton className="mb-4 h-32 w-full" />
            <Skeleton shape="text" className="mb-2 w-3/4" />
            <Skeleton shape="text" className="w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'rows') {
    return (
      <div role="status" aria-label={label} className={cn('flex flex-col gap-3', className)}>
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-card border border-line bg-surface p-4"
          >
            <Skeleton shape="circle" className="h-10 w-10 shrink-0" />
            <div className="flex-1">
              <Skeleton shape="text" className="mb-2 w-1/3" />
              <Skeleton shape="text" className="w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'page') {
    return (
      <div
        role="status"
        aria-label={label}
        className={cn('flex min-h-[60vh] flex-col items-center justify-center gap-4', className)}
      >
        <Spinner size="lg" label={null} className="text-primary" />
        <p className="text-body text-ink-muted">{label}…</p>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-center gap-3 py-12', className)}>
      <Spinner size="md" label={null} className="text-primary" />
      <p className="text-body text-ink-muted">{label}…</p>
    </div>
  );
}

/** Wraps a skeleton region with a visually hidden live announcement. */
export function LoadingRegion({
  label = 'Loading',
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-label={label}>
      {children}
    </div>
  );
}
