import type {
  AcknowledgementResponse,
  OrganizationDashboard,
  OrganizationDetail,
  OrganizationStats,
  SearchHistoryEntry,
  UpdateOrganizationRequest,
} from '@shared/types';

import { api } from '@/services/api';

/**
 * Organization-scoped endpoints.
 *
 * Every path here is `/organizations/me/...` rather than
 * `/organizations/:id/...`. That is a security decision, not a style one: the
 * server derives the organization from the authenticated session, so a client
 * cannot read another tenant's dashboard by editing an ID in the URL. Combined
 * with row-level security in Postgres, tenant isolation does not depend on the
 * frontend behaving well.
 *
 * Contract: `shared/api-contracts/organization.md`.
 */
export const organizationApi = {
  /** Single aggregate for the dashboard — see `OrganizationDashboard`. */
  dashboard: () => api.get<OrganizationDashboard>('/organizations/me/dashboard'),

  profile: () => api.get<OrganizationDetail>('/organizations/me'),

  updateProfile: (body: UpdateOrganizationRequest) =>
    api.patch<OrganizationDetail>('/organizations/me', body),

  stats: () => api.get<OrganizationStats>('/organizations/me/stats'),

  searchHistory: (limit = 20) =>
    api.get<SearchHistoryEntry[]>('/organizations/me/search-history', { query: { limit } }),

  clearSearchHistory: () =>
    api.delete<AcknowledgementResponse>('/organizations/me/search-history'),
};
