import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingState } from '@/components/common/LoadingState';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';

/**
 * Gate for any route that needs a session.
 *
 * Three distinct outcomes, which is the part that is easy to get wrong:
 *  - still rehydrating  → a loading screen, never a redirect (redirecting here
 *    would bounce a signed-in user to /login on every hard refresh)
 *  - no session         → redirect to /login, remembering where they wanted to go
 *  - session but the account is not `active` → an explanatory gate, because the
 *    backend will reject their requests with FORBIDDEN anyway
 *
 * This is a UX guard, not a security boundary. Authorisation is enforced by the
 * API and by Postgres row-level security; hiding a route only hides the UI.
 */
export function ProtectedRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'initialising') {
    return <LoadingState variant="page" label="Restoring your session" />;
  }

  if (status === 'anonymous' || !user) {
    return <Navigate to={ROUTES.auth.login} state={{ from: location.pathname }} replace />;
  }

  if (user.status === 'pending_verification') {
    return (
      <div className="mx-auto max-w-shell px-5 py-16">
        <EmptyState
          variant="page"
          title="Verify your email to continue"
          description={`We sent a verification link to ${user.email}. Once verified, your workspace unlocks immediately.`}
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              I have verified — reload
            </Button>
          }
        />
      </div>
    );
  }

  if (user.status === 'suspended') {
    return (
      <div className="mx-auto max-w-shell px-5 py-16">
        <ErrorState
          variant="page"
          title="This account is suspended"
          error={{
            code: 'FORBIDDEN',
            message: 'Contact MANAK support to have your account reviewed.',
          }}
        />
      </div>
    );
  }

  return <Outlet />;
}
