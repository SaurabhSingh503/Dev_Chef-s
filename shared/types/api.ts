/**
 * MANAK — shared API primitives
 *
 * Single source of truth for the HTTP envelope used by every MANAK service.
 * Consumed by `backend/` (when serialising responses) and `frontend/` (when
 * narrowing them). Do not fork these shapes per-module: the whole point of
 * `shared/` is that one team cannot invent a divergent response structure.
 */

/** Stable, machine-readable failure codes. Extend deliberately, never rename. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UPSTREAM_UNAVAILABLE'
  | 'RAG_UNAVAILABLE'
  | 'INSUFFICIENT_KNOWLEDGE'
  | 'INTERNAL_ERROR';

/** Field-level validation detail. `field` uses dot paths, e.g. `address.pincode`. */
export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  /** Human-readable, safe to surface in UI. Never contains stack traces. */
  message: string;
  /** Present for VALIDATION_ERROR. */
  fields?: FieldError[];
  /** Correlates a client report with server logs. */
  requestId?: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ResponseMeta;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Narrowing helper usable from both frontend and backend. */
export function isApiSuccess<T>(res: ApiResponse<T>): res is ApiSuccess<T> {
  return res.success === true;
}

export interface ResponseMeta {
  pagination?: Pagination;
  /** Server processing time in ms — surfaced in admin/AI analytics views. */
  durationMs?: number;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Query shape every paginated MANAK list endpoint accepts. */
export interface PaginationQuery {
  page?: number;
  pageSize?: number;
}

export type SortDirection = 'asc' | 'desc';

export interface SortQuery {
  sortBy?: string;
  sortDir?: SortDirection;
}

/** Supported interface + voice languages. Drives `frontend/src/i18n/locales`. */
export type LanguageCode = 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr' | 'kn' | 'pa';

export const SUPPORTED_LANGUAGES: readonly LanguageCode[] = [
  'en',
  'hi',
  'bn',
  'ta',
  'te',
  'mr',
  'kn',
  'pa',
] as const;

/** Discriminated async state — mirrors the loading/error/empty/success rule. */
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: ApiErrorBody }
  | { status: 'empty' }
  | { status: 'success'; data: T };

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 100;
