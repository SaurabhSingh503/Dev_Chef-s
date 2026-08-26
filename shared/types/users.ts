/**
 * MANAK — user, organization and consumer-profile contracts.
 */

import type { LanguageCode } from './api';
import type { AccountStatus, UserRole } from './auth';
import type { SearchHistoryEntry, WhatsNewItem } from './reports';
import type { StandardSummary } from './standards';

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  avatarUrl: string | null;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface UserDetail extends UserSummary {
  preferredLanguage: LanguageCode;
  pincode: string | null;
  organization: OrganizationSummary | null;
  /** Aggregates shown on profile pages. */
  stats: UserActivityStats;
}

export interface UserActivityStats {
  searchCount: number;
  savedCount: number;
  reportCount: number;
  aiConversationCount: number;
}

/* -------------------------------- organizations ------------------------------ */

/** Verification of an organization against BIS/registry records. */
export type OrganizationVerificationStatus = 'unverified' | 'in_review' | 'verified' | 'rejected';

export interface OrganizationSummary {
  id: string;
  name: string;
  sector: string;
  verificationStatus: OrganizationVerificationStatus;
  logoUrl: string | null;
}

export interface OrganizationDetail extends OrganizationSummary {
  registrationNumber: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  pincode: string;
  /** Standards the org has flagged as applicable to its products. */
  applicableStandardIds: string[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationStats {
  savedStandards: number;
  activeCertifications: number;
  pendingTests: number;
  generatedReports: number;
  /** Standards updated in the last 30 days that affect this org. */
  standardsNeedingAttention: number;
}

/**
 * Everything the organization dashboard renders, in ONE response.
 *
 * Deliberately a single aggregate rather than five parallel requests: the
 * dashboard is the first authenticated screen a user sees, and five round trips
 * would mean five independent loading states flickering in at different times.
 * The reference dashboard is a calm, composed page — it has to arrive at once.
 *
 * Contract: `GET /api/v1/organizations/me/dashboard`.
 */
export interface OrganizationDashboard {
  organization: OrganizationSummary;
  stats: OrganizationStats;
  /** Newest first. The reference shows these as a bulleted "What's New?" list. */
  whatsNew: WhatsNewItem[];
  /** Standards matching the org's sector that it has not saved yet. */
  recommendedStandards: StandardSummary[];
  /** Newest first, already truncated server-side. */
  recentSearches: SearchHistoryEntry[];
}

export interface UpdateOrganizationRequest {
  name?: string;
  sector?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  pincode?: string;
  logoUrl?: string | null;
  applicableStandardIds?: string[];
}

/* ---------------------------------- admin ----------------------------------- */

export interface UserListQuery {
  role?: UserRole;
  status?: AccountStatus;
  search?: string;
}

export interface UpdateUserRoleRequest {
  role: UserRole;
}

export interface UpdateUserStatusRequest {
  status: AccountStatus;
}

/** Industry sectors used across registration, filters and industry knowledge. */
export const INDUSTRY_SECTORS = [
  'food_processing',
  'textiles',
  'electronics',
  'construction_materials',
  'chemicals',
  'automotive',
  'pharmaceuticals',
  'packaging',
  'electrical_appliances',
  'jewellery',
  'agriculture',
  'other',
] as const;

export type IndustrySector = (typeof INDUSTRY_SECTORS)[number];
