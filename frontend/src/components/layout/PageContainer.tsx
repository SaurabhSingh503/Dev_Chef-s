import type { ElementType, HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Horizontal rhythm for the whole product.
 *
 * One component owns the shell width and gutters so pages cannot drift apart by
 * a few pixels each. `bleed` opts a section out — the reference's hero and gold
 * canvases run edge to edge, and that full-bleed quality is part of the design,
 * not an accident.
 */

export interface PageContainerProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  /** `wide` for dashboards, `narrow` for reading-width prose. */
  width?: 'default' | 'wide' | 'narrow';
  /** Vertical padding preset. */
  space?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const WIDTHS = {
  narrow: 'max-w-3xl',
  default: 'max-w-shell',
  wide: 'max-w-[100rem]',
} as const;

const SPACES = {
  none: '',
  sm: 'py-6',
  md: 'py-10 sm:py-14',
  lg: 'py-16 sm:py-24',
} as const;

export function PageContainer({
  as: Tag = 'div',
  width = 'default',
  space = 'md',
  className,
  children,
  ...rest
}: PageContainerProps) {
  return (
    <Tag
      className={cn('mx-auto w-full px-5 sm:px-8', WIDTHS[width], SPACES[space], className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Section heading used across the interior pages. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="mb-1.5 text-caption font-semibold uppercase tracking-[0.18em] text-ink-muted">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="font-display text-h2 text-ink">{title}</h2>
        {description ? <p className="mt-2 text-body text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
