/**
 * MANAK — authentication endpoints.
 *
 * Mirrors `shared/api-contracts/auth.md` exactly. Public endpoints pass
 * `anonymous: true` so a stale bearer token can never turn a login attempt into
 * a 401. No token is ever created here — the backend is the only tier that
 * talks to Supabase with elevated privileges.
 */

import type {
  AcknowledgementResponse,
  AuthResponse,
  AuthUser,
  ForgotPasswordRequest,
  GoogleAuthRequest,
  IndividualRegisterRequest,
  LoginRequest,
  OrganizationRegisterRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
} from '@shared/types';

import { api } from './api';

export const authApi = {
  login: (body: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', body, { anonymous: true }),

  registerIndividual: (body: IndividualRegisterRequest) =>
    api.post<AuthResponse>('/auth/register/individual', body, { anonymous: true }),

  registerOrganization: (body: OrganizationRegisterRequest) =>
    api.post<AuthResponse>('/auth/register/organization', body, { anonymous: true }),

  google: (body: GoogleAuthRequest) =>
    api.post<AuthResponse>('/auth/google', body, { anonymous: true }),

  logout: () => api.post<AcknowledgementResponse>('/auth/logout'),

  /** Rehydration endpoint — the server's view of `role`/`status` is the truth. */
  me: () => api.get<AuthUser>('/auth/me'),

  updateProfile: (body: UpdateProfileRequest) => api.patch<AuthUser>('/auth/me', body),

  forgotPassword: (body: ForgotPasswordRequest) =>
    api.post<AcknowledgementResponse>('/auth/forgot-password', body, { anonymous: true }),

  resetPassword: (body: ResetPasswordRequest) =>
    api.post<AcknowledgementResponse>('/auth/reset-password', body, { anonymous: true }),
};
