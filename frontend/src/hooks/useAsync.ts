import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { AsyncState } from '@shared/types';

import { toErrorBody } from '@/services/api';

/**
 * Turns a promise-returning fetcher into the shared `AsyncState<T>` union.
 *
 * This exists so that "loading / error / empty / success" is produced in exactly
 * one place. Every page then hands the result to `<AsyncBoundary>` and cannot
 * accidentally ship a happy path only — which is the requirement.
 *
 * Two things it gets right that ad-hoc `useEffect` fetching usually does not:
 *
 *  - **Stale responses are dropped.** Each run gets a sequence number; a
 *    response is only committed if it belongs to the newest run. Without this, a
 *    slow first request can land after a fast second one and overwrite it.
 *  - **State is never set after unmount**, which is what causes the classic
 *    "can't perform a React state update on an unmounted component" warning.
 *
 * Emptiness is a first-class outcome, not something each page re-derives: pass
 * `isEmpty` when "no data" is more subtle than an empty array.
 */

export interface UseAsyncOptions<T> {
  /** When false the fetcher never runs and the state stays `idle`. */
  enabled?: boolean;
  /**
   * Decides whether a successful result should render as `empty`.
   * Defaults to "an array with no items".
   */
  isEmpty?: (data: T) => boolean;
}

export interface UseAsyncResult<T> {
  state: AsyncState<T>;
  /** Re-runs the fetcher, showing the loading state again. */
  reload: () => void;
  /**
   * Replaces the loaded data without a round trip — for optimistic updates such
   * as toggling "saved" on a standard. No-op unless the state is `success`.
   */
  mutate: (update: (current: T) => T) => void;
}

const defaultIsEmpty = (data: unknown): boolean => Array.isArray(data) && data.length === 0;

export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[] = [],
  options: UseAsyncOptions<T> = {},
): UseAsyncResult<T> {
  const { enabled = true, isEmpty } = options;

  const [state, setState] = useState<AsyncState<T>>(enabled ? { status: 'loading' } : { status: 'idle' });
  const [reloadToken, setReloadToken] = useState(0);

  // Kept in refs so changing them does not re-trigger the request. The fetcher
  // is typically an inline arrow function and would otherwise be a new value on
  // every render, causing an infinite fetch loop.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const isEmptyRef = useRef(isEmpty);
  isEmptyRef.current = isEmpty;

  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle' });
      return;
    }

    runIdRef.current += 1;
    const runId = runIdRef.current;
    /** Only the most recent run may write to state. */
    const isCurrent = () => mountedRef.current && runIdRef.current === runId;

    setState({ status: 'loading' });

    fetcherRef.current()
      .then((data) => {
        if (!isCurrent()) return;
        const empty = (isEmptyRef.current ?? defaultIsEmpty)(data);
        setState(empty ? { status: 'empty' } : { status: 'success', data });
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return;
        setState({ status: 'error', error: toErrorBody(error) });
      });
    // `deps` is the caller's dependency list; `fetcher` is intentionally excluded
    // (see the refs above). eslint cannot statically verify a spread dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadToken, ...deps]);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  const mutate = useCallback((update: (current: T) => T) => {
    setState((current) =>
      current.status === 'success' ? { status: 'success', data: update(current.data) } : current,
    );
  }, []);

  return useMemo(() => ({ state, reload, mutate }), [state, reload, mutate]);
}
