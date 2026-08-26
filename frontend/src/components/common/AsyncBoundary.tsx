import type { ReactNode } from 'react';

import type { AsyncState } from '@shared/types';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';

/**
 * Renders the five required states from a single discriminated union, so no
 * page can accidentally ship with only a happy path.
 *
 *   <AsyncBoundary state={standards} loading={<LoadingState variant="cards" />}>
 *     {(data) => <StandardsGrid items={data} />}
 *   </AsyncBoundary>
 *
 * `children` is a render prop rather than plain nodes because `data` is only
 * available — and only type-safe — inside the `success` branch.
 */

export interface AsyncBoundaryProps<T> {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  /** Defaults to a centred spinner; pass a shaped skeleton where possible. */
  loading?: ReactNode;
  /** Shown for `status: 'empty'`. */
  empty?: ReactNode;
  /** Shown for `status: 'idle'` — e.g. "search to begin". Defaults to nothing. */
  idle?: ReactNode;
  onRetry?: () => void;
  errorTitle?: string;
  errorVariant?: 'inline' | 'page';
}

export function AsyncBoundary<T>({
  state,
  children,
  loading,
  empty,
  idle = null,
  onRetry,
  errorTitle,
  errorVariant = 'inline',
}: AsyncBoundaryProps<T>) {
  switch (state.status) {
    case 'idle':
      return <>{idle}</>;

    case 'loading':
      return <>{loading ?? <LoadingState />}</>;

    case 'error':
      return (
        <ErrorState
          error={state.error}
          {...(errorTitle ? { title: errorTitle } : {})}
          {...(onRetry ? { onRetry } : {})}
          variant={errorVariant}
        />
      );

    case 'empty':
      return (
        <>
          {empty ?? (
            <EmptyState
              title="Nothing to show yet"
              description="There is no data for this view at the moment."
            />
          )}
        </>
      );

    case 'success':
      return <>{children(state.data)}</>;

    default: {
      // Exhaustiveness guard: adding a state to the shared union breaks the build here.
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
