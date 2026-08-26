/**
 * MANAK — handbook contracts.
 *
 * Backs the reference Handbook screen: BIS/Org. toggle, centred pill search,
 * 4x2 card grid, "make PDF", and 1..99 pagination.
 */

import type { LanguageCode, PaginationQuery, SortQuery } from './api';
import type { StandardSummary, StandardsBody } from './standards';

/** The reference screen's segmented toggle: BIS handbooks vs organisation handbooks. */
export type HandbookSource = 'bis' | 'org';

export interface HandbookSummary {
  id: string;
  title: string;
  /** Short code shown on the card, e.g. "SP 7". */
  code: string | null;
  source: HandbookSource;
  body: StandardsBody;
  sector: string;
  /** Cover thumbnail; UI falls back to a generated cover when null. */
  coverImageUrl: string | null;
  pageCount: number | null;
  publishedYear: number | null;
  language: LanguageCode;
  /** Whether the requesting user has saved it. */
  isSaved?: boolean;
}

export interface HandbookChapter {
  id: string;
  order: number;
  title: string;
  startPage: number | null;
  /** Nested sections, one level deep. */
  sections: { title: string; startPage: number | null }[];
}

export interface HandbookDetail extends HandbookSummary {
  description: string;
  chapters: HandbookChapter[];
  relatedStandards: StandardSummary[];
  /** Direct download of the original document, when available. */
  documentUrl: string | null;
  updatedAt: string;
}

/** A lightweight preview for the modal/preview pane before full download. */
export interface HandbookPreview {
  id: string;
  title: string;
  /** First N chapters/extracts for the preview pane. */
  excerpt: string;
  chapters: Pick<HandbookChapter, 'id' | 'order' | 'title'>[];
  totalPages: number | null;
}

export interface HandbookListQuery extends PaginationQuery, SortQuery {
  /** Maps to the BIS / Org. toggle. */
  source?: HandbookSource;
  search?: string;
  sector?: string;
  language?: LanguageCode;
  savedOnly?: boolean;
}

/* ------------------------------- pdf generation ------------------------------ */

export interface HandbookPdfRequest {
  /** One or more handbooks to compile into a single PDF. */
  handbookIds: string[];
  /** Restrict to selected chapters; omit for the whole handbook. */
  chapterIds?: string[];
  includeRelatedStandards?: boolean;
  language?: LanguageCode;
}

export type PdfJobStatus = 'queued' | 'generating' | 'ready' | 'failed';

export interface HandbookPdfJob {
  jobId: string;
  status: PdfJobStatus;
  /** Present when status === 'ready'. Expiring signed URL. */
  downloadUrl: string | null;
  /** 0..100 for the progress indicator. */
  progress: number;
  error: string | null;
  createdAt: string;
}
