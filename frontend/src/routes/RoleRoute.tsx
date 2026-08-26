import { Navigate, Outlet } from 'react-router-dom';

import type { UserRole } from '@shared/types';

import { LoadingState } from '@/components/common/LoadingState';
import { ROLE_HOME, ROUTES } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';

/**
 * Restricts a branch of the router to specific roles.
 *
 * A wrong-role user is sent to *their own* home rather than to /login. Bouncing
 * an authenticated person to a sign-in screen implies their session is broken,
 * which it is not — they simply followed a link meant for someone else.
 *
 * Nest inside `ProtectedRoute`, which handles the no-session case. Like that
 * guard, this is presentation only: the API re-checks the role on every call.
 */
export interface RoleRouteProps {
  allow: readonly UserRole[];
}

export function RoleRoute({ allow }: RoleRouteProps) {
  const { status, user } = useAuth();

  if (status === 'initialising') {
    return <LoadingState variant="page" label="Checking your access" />;
  }

  if (!user) {
    return <Navigate to={ROUTES.auth.login} replace />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return <Outlet />;
}
