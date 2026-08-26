import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import type {
  AuthSession,
  AuthUser,
  GoogleAuthRequest,
  IndividualRegisterRequest,
  LoginRequest,
  OrganizationRegisterRequest,
  UpdateProfileRequest,
} from '@shared/types';

import { STORAGE_KEYS } from '@/lib/constants';
import { setAccessToken, setUnauthorizedHandler } from '@/services/api';
import { authApi } from '@/services/authApi';

/**
 * Session state.
 *
 * Two rules shape this file:
 *
 * 1. The *role* is never read from storage. Only tokens are persisted; on every
 *    load the user object is fetched from `GET /auth/me`, so the server decides
 *    what the user is allowed to be. A tampered `localStorage` entry cannot
 *    promote anyone to admin — it can only cause a failed rehydration.
 *
 * 2. Nothing secret is stored here. The browser holds the tokens the backend
 *    issued and nothing else: no Supabase service-role key, no OpenAI key, no
 *    project secret. Those exist only on the server.
 *
 * Storage caveat: tokens in `localStorage` are readable by any script that gets
 * injected into the page, so a strict CSP matters in production. The trade-off
 * is deliberate and documented in `docs/AUTHENTICATION.md`.
 */

export type AuthStatus = 'initialising' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (body: LoginRequest) => Promise<AuthUser>;
  loginWithGoogle: (body: GoogleAuthRequest) => Promise<AuthUser>;
  registerIndividual: (body: IndividualRegisterRequest) => Promise<AuthUser>;
  registerOrganization: (body: OrganizationRegisterRequest) => Promise<AuthUser>;
  updateProfile: (body: UpdateProfileRequest) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Re-reads `GET /auth/me`, e.g. after email verification. */
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

function readTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.session);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTokens>;
    if (typeof parsed.accessToken !== 'string' || parsed.accessToken.length === 0) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === 'string' ? parsed.refreshToken : '',
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : '',
    };
  } catch {
    return null;
  }
}

function writeTokens(session: AuthSession): void {
  try {
    const tokens: StoredTokens = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
    };
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(tokens));
  } catch {
    // Storage blocked — the session simply will not survive a reload.
  }
}

function clearTokens(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.session);
  } catch {
    // Nothing to do.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('initialising');

  /** Guards against a rehydration response arriving after an explicit logout. */
  const generation = useRef(0);

  const endSession = useCallback(() => {
    generation.current += 1;
    setAccessToken(null);
    clearTokens();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const beginSession = useCallback((session: AuthSession): AuthUser => {
    generation.current += 1;
    setAccessToken(session.accessToken);
    writeTokens(session);
    setUser(session.user);
    setStatus('authenticated');
    return session.user;
  }, []);

  // A 401 from any request tears the session down exactly once.
  useEffect(() => {
    setUnauthorizedHandler(() => endSession());
    return () => setUnauthorizedHandler(null);
  }, [endSession]);

  // Rehydrate on mount: trust the server's view of the user, not storage.
  useEffect(() => {
    const tokens = readTokens();
    if (!tokens) {
      setStatus('anonymous');
      return;
    }

    const current = generation.current;
    setAccessToken(tokens.accessToken);

    authApi
      .me()
      .then((fresh) => {
        if (generation.current !== current) return;
        setUser(fresh);
        setStatus('authenticated');
      })
      .catch(() => {
        if (generation.current !== current) return;
        // Expired, revoked or belonging to a broken account — start clean.
        endSession();
      });
  }, [endSession]);

  const login = useCallback(
    async (body: LoginRequest) => beginSession(await authApi.login(body)),
    [beginSession],
  );

  const loginWithGoogle = useCallback(
    async (body: GoogleAuthRequest) => beginSession(await authApi.google(body)),
    [beginSession],
  );

  const registerIndividual = useCallback(
    async (body: IndividualRegisterRequest) =>
      beginSession(await authApi.registerIndividual(body)),
    [beginSession],
  );

  const registerOrganization = useCallback(
    async (body: OrganizationRegisterRequest) =>
      beginSession(await authApi.registerOrganization(body)),
    [beginSession],
  );

  const updateProfile = useCallback(async (body: UpdateProfileRequest) => {
    const updated = await authApi.updateProfile(body);
    setUser(updated);
    return updated;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout must never be blocked by a failed request — clear locally anyway.
    } finally {
      endSession();
    }
  }, [endSession]);

  const refresh = useCallback(async () => {
    try {
      setUser(await authApi.me());
      setStatus('authenticated');
    } catch {
      endSession();
    }
  }, [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated' && user !== null,
      login,
      loginWithGoogle,
      registerIndividual,
      registerOrganization,
      updateProfile,
      logout,
      refresh,
    }),
    [
      status,
      user,
      login,
      loginWithGoogle,
      registerIndividual,
      registerOrganization,
      updateProfile,
      logout,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
