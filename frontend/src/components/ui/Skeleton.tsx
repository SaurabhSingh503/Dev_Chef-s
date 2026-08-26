import { cn } from '@/lib/utils';

/**
 * Shimmer placeholder. Loading skeletons mirror the shape of the real content
 * (a card grid loads as card-shaped blocks) so the page does not visibly
 * reflow when data arrives.
 */

export interface SkeletonProps {
  className?: string;
  /** `text` gets a slightly smaller radius; `circle` is for avatars. */
  shape?: 'block' | 'text' | 'circle';
}

export function Skeleton({ className, shape = 'block' }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'shimmer block bg-muted/70',
        shape === 'circle' && 'rounded-full',
        shape === 'text' && 'h-3 rounded-input',
        shape === 'block' && 'rounded-card',
        className,
      )}
    />
  );
}

/** Convenience: several text lines with a shortened last line. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span className={cn('flex flex-col gap-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          shape="text"
          className={index === lines - 1 ? 'w-2/3' : 'w-full'}
        />
      ))}
    </span>
  );
}
