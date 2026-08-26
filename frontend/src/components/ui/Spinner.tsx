import { cn } from '@/lib/utils';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  /** Announced to screen readers. Set to null for purely decorative use. */
  label?: string | null;
  className?: string;
}

const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
} as const;

export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-live={label ? 'polite' : undefined}
      className={cn('inline-flex items-center', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'animate-spin rounded-full border-current border-t-transparent opacity-80',
          SIZES[size],
        )}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
