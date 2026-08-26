/**
 * MANAK — core HTTP client.
 *
 * Every network call in the application goes through here. Components never
 * call `fetch` directly, and no module outside `services/` constructs a URL.
 *
 * Responsibilities:
 *  - unwrap the shared `ApiResponse<T>` envelope into plain `T`
 *  - convert failures into a typed `ApiError` (so callers `catch` one shape)
 *  - attach the bearer token
 *  - time out via AbortController
 *  - surface 401s once, through a single subscriber, so `AuthContext` can
 *    clear the session without every caller re-implementing that
 */

import type {
  ApiErrorBody,
  ApiErrorCode,
  ApiResponse,
  FieldError,
  ResponseMeta,
} from '@shared/types';
import { API_BASE_URL } from '@/lib/constants';

const DEFAULT_TIMEOUT_MS = 20_000;

/** Typed transport/domain error. `fields` is populated for validation failures. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields: FieldError[];
  readonly requestId?: string;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message);
    this.name = 'ApiError';
    this.code = body.code;
    this.status = status;
    this.fields = body.fields ?? [];
    if (body.requestId !== undefined) this.requestId = body.requestId;
  }

  /** Convenience for form handling: `{ email: 'Already registered' }`. */
  get fieldMap(): Record<string, string> {
    return this.fields.reduce<Record<string, string>>((acc, field) => {
      acc[field.field] = field.message;
      return acc;
    }, {});
  }

  /** Serialisable body, so it can flow into `AsyncState.error`. */
  toBody(): ApiErrorBody {
    const body: ApiErrorBody = { code: this.code, message: this.message };
    if (this.fields.length > 0) body.fields = this.fields;
    if (this.requestId !== undefined) body.requestId = this.requestId;
    return body;
  }
}

/* ------------------------------- auth plumbing ------------------------------- */

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** Called by `AuthContext` whenever the session changes. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Registers the single 401 handler (session teardown + redirect to login). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/* --------------------------------- requests --------------------------------- */

export type QueryValue = string | number | boolean | undefined | null | (string | number)[];

/** Serialises a query object, dropping empty values and repeating arrays. */
export function toQueryString(params: Record<string, QueryValue> | undefined): string {
  if (!params) return '';
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((entry) => search.append(key, String(entry)));
      return;
    }
    search.set(key, String(value));
  });

  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON-serialisable body. Ignored for GET. */
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Skip the bearer header (used by public auth endpoints). */
  anonymous?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Set when sending FormData (file upload) — body is passed through as-is. */
  formData?: FormData;
}

function networkError(message: string, code: ApiErrorCode = 'UPSTREAM_UNAVAILABLE'): ApiError {
  return new ApiError({ code, message }, 0);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    anonymous = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    formData,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Propagate an external abort (component unmount) into our controller.
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (!formData && body !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}${toQueryString(query)}`, {
      method,
      headers,
      credentials: 'omit',
      signal: controller.signal,
      ...(formData ? { body: formData } : body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw networkError('The request timed out. Please try again.', 'UPSTREAM_UNAVAILABLE');
    }
    throw networkError(
      error instanceof Error && error.message
        ? `Could not reach the MANAK service. ${error.message}`
        : 'Could not reach the MANAK service.',
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onExternalAbort);
  }

  if (response.status === 401 && !anonymous) {
    onUnauthorized?.();
  }

  // 204 and other empty successes have no JSON body.
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    if (!response.ok) {
      throw new ApiError({ code: 'INTERNAL_ERROR', message: response.statusText }, response.status);
    }
    return undefined as T;
  }

  let payload: ApiResponse<T> | undefined;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      {
        code: response.ok ? 'INTERNAL_ERROR' : 'UPSTREAM_UNAVAILABLE',
        message: 'The server returned a response that could not be read.',
      },
      response.status,
    );
  }

  if (!response.ok || !payload || payload.success !== true) {
    const errorBody: ApiErrorBody =
      payload && payload.success === false
        ? payload.error
        : { code: 'INTERNAL_ERROR', message: response.statusText || 'Request failed.' };
    throw new ApiError(errorBody, response.status);
  }

  return payload.data;
}

/**
 * Variant that returns the envelope's `meta` alongside the data — needed by
 * paginated lists, which must read `meta.pagination`.
 */
async function requestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta?: ResponseMeta }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!options.anonymous && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    const response = await fetch(
      `${API_BASE_URL}${path}${toQueryString(options.query)}`,
      {
        method: options.method ?? 'GET',
        headers,
        credentials: 'omit',
        signal: controller.signal,
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      },
    );

    if (response.status === 401 && !options.anonymous) onUnauthorized?.();

    const payload = (await response.json()) as ApiResponse<T>;

    if (!response.ok || payload.success !== true) {
      const errorBody: ApiErrorBody =
        payload && payload.success === false
          ? payload.error
          : { code: 'INTERNAL_ERROR', message: response.statusText || 'Request failed.' };
      throw new ApiError(errorBody, response.status);
    }

    return { data: payload.data, meta: payload.meta };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw networkError('The request timed out. Please try again.');
    throw networkError('Could not reach the MANAK service.');
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onExternalAbort);
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),

  upload: <T>(path: string, formData: FormData, options?: Omit<RequestOptions, 'method' | 'formData'>) =>
    request<T>(path, { ...options, method: 'POST', formData }),

  /** Use when the caller needs `meta.pagination`. */
  list: requestWithMeta,
};

/** Normalises anything thrown into an `ApiErrorBody`, for `AsyncState.error`. */
export function toErrorBody(error: unknown): ApiErrorBody {
  if (error instanceof ApiError) return error.toBody();
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Something went wrong.',
  };
}
