/**
 * MANAK — authentication & authorization contracts.
 *
 * Roles are fixed by the brief: individual | organization | admin.
 * Backend enforces these via `role.middleware`; frontend mirrors them in
 * `RoleRoute`. Tokens are issued by Supabase auth and never minted client-side.
 */

import type { LanguageCode } from './api';

export type UserRole = 'individual' | 'organization' | 'admin';

export const USER_ROLES: readonly UserRole[] = ['individual', 'organization', 'admin'] as const;

/** Account lifecycle. `pending_verification` blocks protected routes. */
export type AccountStatus = 'pending_verification' | 'active' | 'suspended';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  preferredLanguage: LanguageCode;
  avatarUrl: string | null;
  /** Set only when role === 'organization'. */
  organizationId: string | null;
  createdAt: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** ISO timestamp. Frontend refreshes ahead of this. */
  expiresAt: string;
  user: AuthUser;
}

/* ---------------------------------- requests --------------------------------- */

export interface LoginRequest {
  email: string;
  password: string;
}

/** Shared registration fields. */
interface RegisterBase {
  email: string;
  password: string;
  fullName: string;
  preferredLanguage?: LanguageCode;
}

export interface IndividualRegisterRequest extends RegisterBase {
  role: 'individual';
  /** Optional — powers pincode-based facility discovery. */
  pincode?: string;
}

export interface OrganizationRegisterRequest extends RegisterBase {
  role: 'organization';
  organizationName: string;
  /** Industry sector key, e.g. `food_processing`. */
  sector: string;
  /** GSTIN or equivalent registration id. */
  registrationNumber: string;
  contactPhone: string;
  pincode: string;
  address: string;
}

export type RegisterRequest = IndividualRegisterRequest | OrganizationRegisterRequest;

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/**
 * `POST /auth/google`. The browser completes the Google flow via Supabase and
 * posts the resulting credential here; the backend verifies it. `role` applies
 * only on first sign-in, and `admin` is never self-assignable.
 */
export interface GoogleAuthRequest {
  /** Google ID token (JWT) obtained by the browser from the Supabase OAuth flow. */
  idToken: string;
  /** Applied only when this is a first sign-in; ignored for an existing account. */
  role?: 'individual' | 'organization';
  preferredLanguage?: LanguageCode;
}

export interface UpdateProfileRequest {
  fullName?: string;
  preferredLanguage?: LanguageCode;
  avatarUrl?: string | null;
  pincode?: string;
}

/* ---------------------------------- responses -------------------------------- */

/** `POST /auth/login`, `POST /auth/register/*`, `POST /auth/google`. */
export type AuthResponse = AuthSession;

/** `GET /auth/me` */
export type CurrentUserResponse = AuthUser;

/** Endpoints that only acknowledge, e.g. forgot-password. */
export interface AcknowledgementResponse {
  acknowledged: true;
  message: string;
}

/** Password policy shared by frontend validators and backend validators. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_POLICY_HINT =
  'At least 8 characters, including one letter and one number.';
