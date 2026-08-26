/**
 * MANAK — reports, saved resources, search history and trends contracts.
 */

import type { LanguageCode, PaginationQuery, SortQuery } from './api';
import type { StandardSummary } from './standards';

export type ReportType =
  | 'compliance_gap'
  | 'standards_digest'
  | 'certification_readiness'
  | 'testing_plan'
  | 'industry_briefing';

export type ReportStatus = 'generating' | 'ready' | 'failed';

export interface ReportSummary {
  id: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  /** Owning organisation; null for individual-scoped reports. */
  organizationId: string | null;
  createdAt: string;
}

export interface ReportSection {
  heading: string;
  body: string;
  /** Standards referenced by this section. */
  standards: StandardSummary[];
}

export interface ReportDetail extends ReportSummary {
  summary: string;
  sections: ReportSection[];
  /** Expiring signed URL for the generated PDF. */
  downloadUrl: string | null;
  language: LanguageCode;
  error: string | null;
  updatedAt: string;
}

export interface CreateReportRequest {
  type: ReportType;
  title?: string;
  /** Scope the report to these standards. */
  standardIds?: string[];
  sector?: string;
  language?: LanguageCode;
}

export interface ReportListQuery extends PaginationQuery, SortQuery {
  type?: ReportType;
  status?: ReportStatus;
}

/* ------------------------------ saved + history ------------------------------ */

export type SavedResourceKind = 'standard' | 'handbook' | 'report' | 'ai_answer';

export interface SavedResource {
  id: string;
  kind: SavedResourceKind;
  resourceId: string;
  title: string;
  /** Caption line, e.g. the standard number or handbook code. */
  subtitle: string | null;
  savedAt: string;
}

export interface SaveResourceRequest {
  kind: SavedResourceKind;
  resourceId: string;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  /** Where the search happened. */
  surface: 'standards' | 'handbook' | 'ai' | 'facility';
  resultCount: number;
  searchedAt: string;
}

/* ---------------------------------- trends ---------------------------------- */

export interface TrendingTopic {
  id: string;
  topic: string;
  /** Searches in the trailing window. */
  volume: number;
  /** Percentage change vs the previous window; negative means cooling. */
  changePercent: number;
  sector: string | null;
  relatedStandards: StandardSummary[];
}

export interface WhatsNewItem {
  id: string;
  title: string;
  body: string;
  kind: 'standard_published' | 'standard_revised' | 'handbook_added' | 'announcement';
  /** Deep link into the app. */
  href: string | null;
  publishedAt: string;
}

export interface IndustryKnowledgeItem {
  id: string;
  sector: string;
  title: string;
  summary: string;
  keyStandards: StandardSummary[];
  updatedAt: string;
}
