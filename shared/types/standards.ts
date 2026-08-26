/**
 * MANAK — standards, certification and testing contracts.
 */

import type { PaginationQuery, SortQuery } from './api';

/** Lifecycle of an Indian Standard. */
export type StandardStatus = 'active' | 'under_revision' | 'superseded' | 'withdrawn';

/** Issuing/standards body. `bis` vs other org bodies drives the Handbook toggle. */
export type StandardsBody = 'bis' | 'iso' | 'iec' | 'codex' | 'other';

export interface StandardSummary {
  id: string;
  /** e.g. "IS 1234:2021" */
  standardNumber: string;
  title: string;
  status: StandardStatus;
  body: StandardsBody;
  sector: string;
  /** Technical committee / division code, e.g. "FAD 16". */
  committee: string | null;
  publishedDate: string | null;
  /** Whether the requesting user has saved this standard. */
  isSaved?: boolean;
}

export interface StandardScopeSection {
  heading: string;
  content: string;
  /** Clause number when the document is clause-structured. */
  clause: string | null;
}

export interface StandardDetail extends StandardSummary {
  abstract: string;
  scope: string;
  sections: StandardScopeSection[];
  /** Standards this one references. */
  references: string[];
  /** Set when status === 'superseded'. */
  supersededBy: string | null;
  amendments: StandardAmendment[];
  /** Requirements a product must meet, used by certification + testing views. */
  requirements: StandardRequirement[];
  documentUrl: string | null;
  pageCount: number | null;
  updatedAt: string;
}

export interface StandardAmendment {
  number: string;
  issuedDate: string;
  summary: string;
}

export interface StandardRequirement {
  id: string;
  label: string;
  description: string;
  /** Measurable limit, when the requirement is quantitative. */
  limit: string | null;
  testMethod: string | null;
  mandatory: boolean;
}

export interface StandardListQuery extends PaginationQuery, SortQuery {
  search?: string;
  status?: StandardStatus;
  body?: StandardsBody;
  sector?: string;
  committee?: string;
  /** Only standards the user saved. */
  savedOnly?: boolean;
}

/* -------------------------------- certification ------------------------------ */

export type CertificationScheme =
  | 'isi_mark'
  | 'hallmarking'
  | 'crs_registration'
  | 'eco_mark'
  | 'foreign_manufacturer';

export type CertificationStageStatus = 'pending' | 'in_progress' | 'complete' | 'blocked';

export interface CertificationStage {
  id: string;
  order: number;
  title: string;
  description: string;
  status: CertificationStageStatus;
  /** Typical duration, e.g. "10–15 working days". */
  typicalDuration: string | null;
  requiredDocuments: string[];
}

export interface CertificationPathway {
  scheme: CertificationScheme;
  title: string;
  summary: string;
  applicableStandards: StandardSummary[];
  stages: CertificationStage[];
  /** Indicative fee text — never a binding quote. */
  feeNote: string | null;
}

/* ---------------------------------- testing ---------------------------------- */

export type LaboratoryRecognition = 'bis_recognised' | 'nabl_accredited' | 'both' | 'none';

export interface Laboratory {
  id: string;
  name: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  recognition: LaboratoryRecognition;
  /** Facility categories, aligns with the facility-search "Type of Facility". */
  facilityTypes: string[];
  contactPhone: string | null;
  contactEmail: string | null;
  /** Straight-line km from the searched pincode, when computable. */
  distanceKm: number | null;
}

/** Backs the reference facility-search screen (Pincode / Type of Facility / Address). */
export interface LaboratorySearchQuery extends PaginationQuery {
  pincode?: string;
  facilityType?: string;
  address?: string;
  recognition?: LaboratoryRecognition;
}

export interface TestingRequirement {
  id: string;
  standardNumber: string;
  parameter: string;
  method: string;
  /** Acceptance criteria. */
  limit: string | null;
  sampleSize: string | null;
  mandatory: boolean;
}

/** Facility categories offered in the facility-search dropdown. */
export const FACILITY_TYPES = [
  'testing_laboratory',
  'calibration_laboratory',
  'certification_body',
  'hallmarking_centre',
  'bis_branch_office',
  'inspection_body',
] as const;

export type FacilityType = (typeof FACILITY_TYPES)[number];
