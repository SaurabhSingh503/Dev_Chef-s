import type { HTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * MANAK surface primitives.
 *
 * The reference uses three distinct surface treatments, and mixing them up is
 * what makes a design look generic — so they are explicit variants here:
 *  - `card`   softly rounded content tile (handbook grid, standard results)
 *  - `panel`  larger radius container that frames a whole region
 *  - `flat`   bordered, no shadow — for dense tables and settings rows
 */

export type CardVariant = 'card' | 'panel' | 'flat' | 'dark';

const VARIANTS: Record<CardVariant, string> = {
  card: 'bg-surface rounded-card shadow-card border border-line',
  panel: 'bg-surface rounded-panel shadow-card border border-line',
  flat: 'bg-surface rounded-card border border-line',
  dark: 'bg-ink text-invert rounded-panel border border-white/10',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** Adds hover lift + pointer affordance. Use when the whole card is a link. */
  interactive?: boolean;
  padded?: boolean;
}

export function Card({
  variant = 'card',
  interactive = false,
  padded = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'relative transition-all duration-300 ease-premium',
        VARIANTS[variant],
        padded && 'p-5',
        interactive && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-raised',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...rest}>
      {children}
    </div>
  );
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3' | 'h4';
  eyebrow?: ReactNode;
}

export function CardTitle({
  as: Tag = 'h3',
  eyebrow,
  className,
  children,
  ...rest
}: CardTitleProps) {
  return (
    <div className="min-w-0">
      {eyebrow ? (
        <p className="mb-1 text-caption font-semibold uppercase tracking-widest text-ink/80">
          {eyebrow}
        </p>
      ) : null}
      <Tag className={cn('text-h3 font-semibold leading-snug text-ink', className)} {...rest}>
        {children}
      </Tag>
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  // `ink/85`, not `ink-muted`: cards sit on the orange surface, where the muted
  // brown measures 3.3:1. `ink/85` is 5.0:1 and still reads as secondary text.
  return (
    <div className={cn('text-body text-ink/85', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
