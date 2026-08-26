import type { ApiErrorBody } from '@shared/types';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/**
 * Failure presentation.
 *
 * Messages are written for the person reading them, not for the developer:
 * we map known error codes to plain language and never print a stack trace.
 */

/**
 * Every `ApiErrorCode` is mapped, so a new code added to the shared union
 * becomes a compile error here rather than a silent "Something went wrong".
 */
const FRIENDLY: Record<ApiErrorBody['code'], { title: string; message: string }> = {
  VALIDATION_ERROR: {
    title: 'Please check the details',
    message: 'Some of the information provided was not accepted.',
  },
  UNAUTHENTICATED: {
    title: 'Please sign in again',
    message: 'Your session has expired. Sign in to continue where you left off.',
  },
  FORBIDDEN: {
    title: 'You do not have access',
    message: 'This area is restricted. Contact your organisation administrator if you need access.',
  },
  NOT_FOUND: {
    title: 'Not found',
    message: 'We could not find what you were looking for. It may have been moved or removed.',
  },
  CONFLICT: {
    title: 'That conflicts with existing data',
    message: 'This record already exists or has changed since you loaded it. Reload and try again.',
  },
  RATE_LIMITED: {
    title: 'Too many requests',
    message: 'You have made a lot of requests in a short time. Please wait a moment and try again.',
  },
  PAYLOAD_TOO_LARGE: {
    title: 'File is too large',
    message: 'Please upload a smaller file and try again.',
  },
  UNSUPPORTED_MEDIA_TYPE: {
    title: 'Unsupported file type',
    message: 'That file format is not accepted here. Check the allowed formats and try again.',
  },
  UPSTREAM_UNAVAILABLE: {
    title: 'Service unreachable',
    message: 'We could not reach the MANAK service. Check your connection and try again.',
  },
  RAG_UNAVAILABLE: {
    title: 'Assistant is unavailable',
    message:
      'The MANAK assistant is temporarily offline. You can still search and browse standards directly.',
  },
  INSUFFICIENT_KNOWLEDGE: {
    title: 'Not enough grounded information',
    message:
      'We will not guess on standards. There was no reliable source for this question, so no answer was generated.',
  },
  INTERNAL_ERROR: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred on our side. Please try again.',
  },
};

export interface ErrorStateProps {
  error?: ApiErrorBody | null;
  /** Overrides the code-derived title. */
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** `inline` for a section, `page` for a full route failure. */
  variant?: 'inline' | 'page';
  className?: string;
}

export function ErrorState({
  error,
  title,
  onRetry,
  retryLabel = 'Try again',
  variant = 'inline',
  className,
}: ErrorStateProps) {
  const friendly = error ? FRIENDLY[error.code] : FRIENDLY.INTERNAL_ERROR;
  const heading = title ?? friendly.title;

  // Prefer a server message when it is human-readable; fall back to our copy.
  const detail = error?.message && error.message.length < 180 ? error.message : friendly.message;

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-4 rounded-card border border-error/25 bg-error/5 px-6 text-center',
        variant === 'page' ? 'min-h-[50vh] justify-center py-16' : 'py-12',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-error/12 text-h3 font-semibold text-error"
      >
        !
      </span>

      <div className="max-w-md">
        <h2 className="text-h3 font-semibold text-ink">{heading}</h2>
        <p className="mt-1.5 text-body text-ink-muted">{detail}</p>
        {error?.fields?.length ? (
          <ul className="mt-3 space-y-1 text-left text-label text-error">
            {error.fields.map((field) => (
              <li key={`${field.field}-${field.message}`}>
                <span className="font-medium">{field.field}:</span> {field.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}

      {error?.requestId ? (
        <p className="text-caption text-ink-muted">
          Reference: <span className="font-mono">{error.requestId}</span>
        </p>
      ) : null}
    </div>
  );
}
