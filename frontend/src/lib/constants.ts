/**
 * MANAK — application constants.
 *
 * Route paths live here (never as inline string literals) so the router,
 * navigation, redirects and tests all agree on one spelling.
 */

import type { LanguageCode } from '@shared/types';

/** Backend base URL. All frontend HTTP goes through `services/api.ts`. */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

export const APP_NAME = 'MANAK';
export const APP_WORDMARK = 'मानक';

/** Route table. Grouped to mirror `src/pages/`. */
export const ROUTES = {
  public: {
    home: '/',
    about: '/about',
    services: '/services',
    howItWorks: '/how-it-works',
    standardsExplorer: '/standards-explorer',
  },
  auth: {
    login: '/login',
    register: '/register',
    registerIndividual: '/register/individual',
    registerOrganization: '/register/organization',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
  },
  organization: {
    dashboard: '/org',
    ai: '/org/ai',
    standards: '/org/standards',
    standardDetails: '/org/standards/:id',
    certification: '/org/certification',
    testing: '/org/testing',
    handbook: '/org/handbook',
    industryKnowledge: '/org/industry-knowledge',
    savedStandards: '/org/saved',
    searchHistory: '/org/history',
    reports: '/org/reports',
    reportDetails: '/org/reports/:id',
    profile: '/org/profile',
    settings: '/org/settings',
  },
  individual: {
    dashboard: '/me',
    ai: '/me/ai',
    standards: '/me/standards',
    standardDetails: '/me/standards/:id',
    hallmarking: '/me/hallmarking',
    consumerServices: '/me/services',
    savedResources: '/me/saved',
    searchHistory: '/me/history',
    profile: '/me/profile',
    settings: '/me/settings',
  },
  admin: {
    dashboard: '/admin',
    knowledgeBase: '/admin/knowledge-base',
    documents: '/admin/documents',
    documentDetails: '/admin/documents/:id',
    standards: '/admin/standards',
    users: '/admin/users',
    organizations: '/admin/organizations',
    industryKnowledge: '/admin/industry-knowledge',
    trendingTopics: '/admin/trending',
    aiAnalytics: '/admin/ai-analytics',
    ragPipeline: '/admin/rag',
    settings: '/admin/settings',
  },
} as const;

/** Builds a concrete path from a parameterised route: `:id` → value. */
export function buildPath(pattern: string, params: Record<string, string | number>): string {
  return Object.entries(params).reduce<string>(
    (path, [key, value]) => path.replace(`:${key}`, encodeURIComponent(String(value))),
    pattern,
  );
}

/** Landing route per role, used after login and by role guards. */
export const ROLE_HOME = {
  individual: ROUTES.individual.dashboard,
  organization: ROUTES.organization.dashboard,
  admin: ROUTES.admin.dashboard,
} as const;

/** Language definitions. `native` is what appears in the selector. */
export interface LanguageOption {
  code: LanguageCode;
  label: string;
  native: string;
}

export const LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
] as const;

/** Handbook grid is 4x2 on desktop in the reference — keep page size a multiple. */
export const HANDBOOK_PAGE_SIZE = 8;
export const STANDARDS_PAGE_SIZE = 12;

export const STORAGE_KEYS = {
  theme: 'manak.theme',
  language: 'manak.language',
  session: 'manak.session',
} as const;
