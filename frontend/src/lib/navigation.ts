import type { UserRole } from '@shared/types';

import type { IconName } from '@/components/icons/Icon';
import { ROUTES } from '@/lib/constants';

/**
 * Authenticated navigation, as data.
 *
 * Kept out of the Sidebar component so that the shape of the product is
 * declared in one readable place, and so the sidebar, the mobile drawer and any
 * future command palette all navigate the same tree instead of drifting apart.
 *
 * Every item carries an English `fallback` next to its translation key. i18next
 * is configured with `en` as the fallback locale, but a key missing from *every*
 * locale would otherwise render as the raw dotted string — a class of bug that
 * only shows up in the language you never test. `t(key, fallback)` cannot do
 * that.
 *
 * Detail routes (`/standards/:id`, `/reports/:id`) are deliberately absent: they
 * are reached from their list page, and putting them in a sidebar would mean
 * inventing a "current item" that may not exist.
 */

export interface NavItem {
  to: string;
  labelKey: string;
  fallback: string;
  icon: IconName;
  /**
   * When true this item is only active on an exact path match. Needed for index
   * routes such as `/org`, which is a prefix of every other org route.
   */
  exact?: boolean;
}

export interface NavGroup {
  /** Groups are visually separated; the label may be omitted for the first one. */
  labelKey?: string;
  fallback?: string;
  items: NavItem[];
}

const ORGANIZATION: NavGroup[] = [
  {
    items: [
      {
        to: ROUTES.organization.dashboard,
        labelKey: 'nav.items.dashboard',
        fallback: 'Dashboard',
        icon: 'home',
        exact: true,
      },
      {
        to: ROUTES.organization.ai,
        labelKey: 'nav.items.assistant',
        fallback: 'Assistant',
        icon: 'ai',
      },
    ],
  },
  {
    labelKey: 'nav.groups.standards',
    fallback: 'Standards',
    items: [
      {
        to: ROUTES.organization.standards,
        labelKey: 'nav.items.standards',
        fallback: 'Standards',
        icon: 'document',
      },
      {
        to: ROUTES.organization.savedStandards,
        labelKey: 'nav.items.saved',
        fallback: 'Saved',
        icon: 'bookmark',
      },
      {
        to: ROUTES.organization.industryKnowledge,
        labelKey: 'nav.items.industryKnowledge',
        fallback: 'Industry knowledge',
        icon: 'lightbulb',
      },
      {
        to: ROUTES.organization.searchHistory,
        labelKey: 'nav.items.searchHistory',
        fallback: 'Search history',
        icon: 'clock',
      },
    ],
  },
  {
    labelKey: 'nav.groups.compliance',
    fallback: 'Compliance',
    items: [
      {
        to: ROUTES.organization.certification,
        labelKey: 'nav.items.certification',
        fallback: 'Certification',
        icon: 'certificate',
      },
      {
        to: ROUTES.organization.testing,
        labelKey: 'nav.items.testing',
        fallback: 'Testing',
        icon: 'flask',
      },
      {
        to: ROUTES.organization.handbook,
        labelKey: 'nav.items.handbook',
        fallback: 'Handbook',
        icon: 'handbook',
      },
      {
        to: ROUTES.organization.reports,
        labelKey: 'nav.items.reports',
        fallback: 'Reports',
        icon: 'chart',
      },
    ],
  },
  {
    labelKey: 'nav.groups.account',
    fallback: 'Account',
    items: [
      {
        to: ROUTES.organization.profile,
        labelKey: 'nav.items.profile',
        fallback: 'Profile',
        icon: 'user',
      },
      {
        to: ROUTES.organization.settings,
        labelKey: 'nav.items.settings',
        fallback: 'Settings',
        icon: 'settings',
      },
    ],
  },
];

const INDIVIDUAL: NavGroup[] = [
  {
    items: [
      {
        to: ROUTES.individual.dashboard,
        labelKey: 'nav.items.dashboard',
        fallback: 'Dashboard',
        icon: 'home',
        exact: true,
      },
      {
        to: ROUTES.individual.ai,
        labelKey: 'nav.items.assistant',
        fallback: 'Assistant',
        icon: 'ai',
      },
    ],
  },
  {
    labelKey: 'nav.groups.explore',
    fallback: 'Explore',
    items: [
      {
        to: ROUTES.individual.standards,
        labelKey: 'nav.items.standards',
        fallback: 'Standards',
        icon: 'document',
      },
      {
        to: ROUTES.individual.hallmarking,
        labelKey: 'nav.items.hallmarking',
        fallback: 'Hallmarking',
        icon: 'hallmark',
      },
      {
        to: ROUTES.individual.consumerServices,
        labelKey: 'nav.items.consumerServices',
        fallback: 'Consumer services',
        icon: 'info',
      },
    ],
  },
  {
    labelKey: 'nav.groups.yours',
    fallback: 'Yours',
    items: [
      {
        to: ROUTES.individual.savedResources,
        labelKey: 'nav.items.saved',
        fallback: 'Saved',
        icon: 'bookmark',
      },
      {
        to: ROUTES.individual.searchHistory,
        labelKey: 'nav.items.searchHistory',
        fallback: 'Search history',
        icon: 'clock',
      },
    ],
  },
  {
    labelKey: 'nav.groups.account',
    fallback: 'Account',
    items: [
      {
        to: ROUTES.individual.profile,
        labelKey: 'nav.items.profile',
        fallback: 'Profile',
        icon: 'user',
      },
      {
        to: ROUTES.individual.settings,
        labelKey: 'nav.items.settings',
        fallback: 'Settings',
        icon: 'settings',
      },
    ],
  },
];

const ADMIN: NavGroup[] = [
  {
    items: [
      {
        to: ROUTES.admin.dashboard,
        labelKey: 'nav.items.dashboard',
        fallback: 'Dashboard',
        icon: 'grid',
        exact: true,
      },
    ],
  },
  {
    labelKey: 'nav.groups.knowledge',
    fallback: 'Knowledge',
    items: [
      {
        to: ROUTES.admin.knowledgeBase,
        labelKey: 'nav.items.knowledgeBase',
        fallback: 'Knowledge base',
        icon: 'database',
      },
      {
        to: ROUTES.admin.documents,
        labelKey: 'nav.items.documents',
        fallback: 'Documents',
        icon: 'upload',
      },
      {
        to: ROUTES.admin.standards,
        labelKey: 'nav.items.standards',
        fallback: 'Standards',
        icon: 'document',
      },
      {
        to: ROUTES.admin.industryKnowledge,
        labelKey: 'nav.items.industryKnowledge',
        fallback: 'Industry knowledge',
        icon: 'lightbulb',
      },
    ],
  },
  {
    labelKey: 'nav.groups.people',
    fallback: 'People',
    items: [
      {
        to: ROUTES.admin.users,
        labelKey: 'nav.items.users',
        fallback: 'Users',
        icon: 'users',
      },
      {
        to: ROUTES.admin.organizations,
        labelKey: 'nav.items.organizations',
        fallback: 'Organisations',
        icon: 'building',
      },
    ],
  },
  {
    labelKey: 'nav.groups.intelligence',
    fallback: 'Intelligence',
    items: [
      {
        to: ROUTES.admin.trendingTopics,
        labelKey: 'nav.items.trendingTopics',
        fallback: 'Trending topics',
        icon: 'trending',
      },
      {
        to: ROUTES.admin.aiAnalytics,
        labelKey: 'nav.items.aiAnalytics',
        fallback: 'AI analytics',
        icon: 'chart',
      },
      {
        to: ROUTES.admin.ragPipeline,
        labelKey: 'nav.items.ragPipeline',
        fallback: 'RAG pipeline',
        icon: 'layers',
      },
    ],
  },
  {
    labelKey: 'nav.groups.system',
    fallback: 'System',
    items: [
      {
        to: ROUTES.admin.settings,
        labelKey: 'nav.items.settings',
        fallback: 'Settings',
        icon: 'settings',
      },
    ],
  },
];

/**
 * Exhaustive by construction: adding a role to the shared `UserRole` union makes
 * this object a compile error until its navigation is defined.
 */
export const NAVIGATION: Record<UserRole, NavGroup[]> = {
  organization: ORGANIZATION,
  individual: INDIVIDUAL,
  admin: ADMIN,
};

/**
 * Whether a nav item should render as current, given the active pathname.
 *
 * `exact` items match only themselves; the rest also match their descendants, so
 * `/org/standards/IS-456` keeps "Standards" highlighted. The trailing-slash
 * check prevents `/org/report` from lighting up `/org/reports`.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
