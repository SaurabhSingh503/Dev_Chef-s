import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { APP_WORDMARK, ROLE_HOME, ROUTES } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/services/api';
import { AuthBackdrop } from '@/components/auth/AuthBackdrop';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LanguageSelector } from '@/components/common/LanguageSelector';

/**
 * Login — reference screen 2.
 *
 * Composition is preserved exactly: full-bleed organic backdrop, large centred
 * white wordmark, left-aligned two-line serif headline, then ONE horizontal row
 * of [field] [field] [pill submit], then a centred Google option beneath. It is
 * deliberately not a centred white card, which is what makes it not look like
 * every other login page.
 *
 * Two honest departures from the reference, both forced by reality rather than
 * taste:
 *  - the first field is email, not "Name" — `POST /auth/login` takes an email
 *    per `shared/api-contracts/auth.md`, and the layout is unaffected.
 *  - the forgot-password and create-account links are not in the reference, but
 *    a login screen without them is broken. They sit small and out of the way.
 */

/** Google's mark, drawn rather than fetched so the page has no external deps. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);

  /** Where ProtectedRoute wanted to send us, if it bounced us here. */
  const from =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? ((location.state as { from: string }).from)
      : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setGoogleNotice(null);
    setSubmitting(true);

    try {
      const user = await login({ email: email.trim(), password });
      navigate(from ?? ROLE_HOME[user.role], { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fieldMap);
        // Show the summary only when there is no per-field message to point at.
        if (Object.keys(error.fieldMap).length === 0) setFormError(error.message);
      } else {
        setFormError(t('common.somethingWentWrong', 'Something went wrong'));
      }
      setSubmitting(false);
    }
  };

  /**
   * Google sign-in needs a real Google Identity client ID and an ID token from
   * Google's SDK. Neither is configured yet, so this reports the missing
   * dependency instead of faking a session — see `docs/AUTHENTICATION.md`.
   */
  const handleGoogle = () => {
    setFormError(null);
    setGoogleNotice(
      import.meta.env.VITE_GOOGLE_CLIENT_ID
        ? t(
            'auth.login.googlePending',
            'Google sign-in is configured but the Google Identity SDK is not loaded on this build yet.',
          )
        : t(
            'auth.login.googleUnconfigured',
            'Google sign-in is not configured on this deployment. Set VITE_GOOGLE_CLIENT_ID to enable it.',
          ),
    );
  };

  return (
    <main className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-umber">
      <AuthBackdrop />

      <div className="relative z-10 flex flex-1 flex-col px-5 py-8 sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <Link
            to={ROUTES.public.home}
            className="text-label text-white/85 transition-colors hover:text-white"
          >
            ← {t('nav.home', 'Home')}
          </Link>
          <LanguageSelector tone="onDark" />
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-10">
          <Link
            to={ROUTES.public.home}
            className="mx-auto block text-center"
            aria-label={t('nav.home', 'Home')}
          >
            <span className="manak-wordmark text-[clamp(3.5rem,11vw,7rem)] text-white">
              {APP_WORDMARK}
            </span>
          </Link>

          <h1 className="mt-10 max-w-xl font-display text-[clamp(1.75rem,4.6vw,3rem)] leading-[1.12] text-white">
            {t('auth.login.headline', 'Ready to go beyond standards?')}
          </h1>

          <form onSubmit={handleSubmit} noValidate className="mt-8">
            {formError ? (
              <p
                role="alert"
                className="mb-5 rounded-card border border-white/45 bg-black/25 px-4 py-3 text-body text-white"
              >
                {formError}
              </p>
            ) : null}

            {/* One row on desktop, exactly as in the reference; stacked on mobile. */}
            <div className="grid items-start gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                tone="onDark"
                type="email"
                name="email"
                autoComplete="email"
                required
                hideLabel
                label={t('auth.login.email', 'Email address')}
                placeholder={t('auth.login.email', 'Email address')}
                className="placeholder:text-center"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={fieldErrors.email ?? null}
              />

              <Input
                tone="onDark"
                type="password"
                name="password"
                autoComplete="current-password"
                required
                hideLabel
                label={t('auth.login.password', 'Password')}
                placeholder={t('auth.login.password', 'Password')}
                className="placeholder:text-center"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={fieldErrors.password ?? null}
              />

              <Button
                type="submit"
                variant="secondary"
                size="md"
                loading={submitting}
                loadingLabel={t('common.loading', 'Loading')}
                className="w-full px-10 uppercase tracking-[0.14em] sm:w-auto"
              >
                {t('auth.login.submit', 'Sign in')}
              </Button>
            </div>

            <div className="mt-3 flex justify-end">
              <Link
                to={ROUTES.auth.forgotPassword}
                className="text-label text-white/85 underline decoration-white/40 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
              >
                {t('auth.login.forgot', 'Forgot your password?')}
              </Link>
            </div>
          </form>

          {/* Centred Google option, as in the reference. */}
          <div className="mt-12 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={handleGoogle}
              className="inline-flex items-center gap-2.5 rounded-pill border border-white/55 px-5 py-2.5 text-body text-white transition-colors duration-300 hover:bg-white/10"
            >
              <GoogleMark />
              {t('auth.login.google', 'Continue with Google')}
            </button>

            {googleNotice ? (
              <p role="status" className="max-w-sm text-center text-label text-white/85">
                {googleNotice}
              </p>
            ) : null}
          </div>
        </div>

        <p className="text-center text-body text-white/85">
          {t('auth.login.noAccount', 'New to MANAK?')}{' '}
          <Link
            to={ROUTES.auth.register}
            className="font-medium text-white underline decoration-white/50 underline-offset-4 hover:decoration-white"
          >
            {t('auth.login.createAccount', 'Create an account')}
          </Link>
        </p>
      </div>
    </main>
  );
}

export default Login;
