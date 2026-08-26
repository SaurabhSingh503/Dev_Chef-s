-- =============================================================================
-- MANAK — 004_standards.sql
-- Indian Standards + their sections, amendments, requirements and cross-refs,
-- plus certification pathways/stages, laboratories and testing requirements.
-- -----------------------------------------------------------------------------
-- Depends on: 001 (users, set_updated_at, is_admin)
--             002 (organizations, industry_sector, is_org_member/is_org_manager)
--             003 (documents)
--
-- Serves shared/types/standards.ts in full:
--   StandardSummary / StandardDetail / StandardScopeSection / StandardAmendment /
--   StandardRequirement / CertificationPathway / CertificationStage /
--   Laboratory / TestingRequirement
--
-- Everything in this file is PUBLICLY READABLE (including by anonymous
-- visitors) — the Standards Explorer, certification pathways and facility search
-- are pre-login surfaces. Writes are admin-only.
--
-- Reserved-word note: TypeScript's `limit` fields become `limit_text` columns.
-- LIMIT is a reserved keyword in PostgreSQL and an unquoted column named `limit`
-- will not parse. TS's `order` becomes `ordinal` for the same reason.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- shared/types/standards.ts :: StandardStatus
do $$ begin
  create type public.standard_status as enum
    ('active', 'under_revision', 'superseded', 'withdrawn');
exception when duplicate_object then null; end $$;

-- shared/types/standards.ts :: StandardsBody
do $$ begin
  create type public.standards_body as enum ('bis', 'iso', 'iec', 'codex', 'other');
exception when duplicate_object then null; end $$;

-- shared/types/ai.ts :: RelatedStandard.relation
-- Reused by public.standard_references and by ai_answer_related_standards (006).
do $$ begin
  create type public.related_standard_relation as enum
    ('referenced', 'superseded_by', 'amends', 'similar_scope');
exception when duplicate_object then null; end $$;

-- shared/types/standards.ts :: CertificationScheme
do $$ begin
  create type public.certification_scheme as enum
    ('isi_mark', 'hallmarking', 'crs_registration', 'eco_mark', 'foreign_manufacturer');
exception when duplicate_object then null; end $$;

-- shared/types/standards.ts :: CertificationStageStatus
do $$ begin
  create type public.certification_stage_status as enum
    ('pending', 'in_progress', 'complete', 'blocked');
exception when duplicate_object then null; end $$;

-- shared/types/standards.ts :: LaboratoryRecognition
do $$ begin
  create type public.laboratory_recognition as enum
    ('bis_recognised', 'nabl_accredited', 'both', 'none');
exception when duplicate_object then null; end $$;

-- shared/types/standards.ts :: FACILITY_TYPES / FacilityType
do $$ begin
  create type public.facility_type as enum (
    'testing_laboratory',
    'calibration_laboratory',
    'certification_body',
    'hallmarking_centre',
    'bis_branch_office',
    'inspection_body'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- public.standards
-- -----------------------------------------------------------------------------
create table if not exists public.standards (
  id               uuid primary key default gen_random_uuid(),
  -- Canonical designation, e.g. 'IS 1234:2021'. The user-facing identity.
  standard_number  text not null,
  title            text not null,
  status           public.standard_status not null default 'active',
  body             public.standards_body not null default 'bis',
  sector           public.industry_sector not null default 'other',
  -- Technical committee / division code, e.g. 'FAD 16'.
  committee        text,
  published_date   date,
  abstract         text not null default '',
  scope            text not null default '',
  -- Self-FK: set when status = 'superseded'. ON DELETE SET NULL so removing a
  -- newer standard never cascades away the history it replaced.
  superseded_by    uuid references public.standards (id) on delete set null,
  document_url     text,
  page_count       integer,
  -- Link into the RAG corpus when the full text has been ingested.
  document_id      uuid references public.documents (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint standards_standard_number_key    unique (standard_number),
  constraint standards_standard_number_check  check (length(btrim(standard_number)) > 0),
  constraint standards_title_check            check (length(btrim(title)) > 0),
  constraint standards_page_count_check       check (page_count is null or page_count >= 0),
  constraint standards_no_self_supersede_check check (superseded_by is null or superseded_by <> id)
);

comment on table  public.standards is 'Indian/international standards catalogue. Mirrors shared/types/standards.ts::StandardDetail.';
comment on column public.standards.superseded_by is 'StandardDetail.supersededBy. Meaningful when status = ''superseded''.';
comment on column public.standards.document_id is 'The ingested PDF backing this standard, when present. Lets an AISource resolve back to a StandardSummary.';

create index if not exists standards_status_idx         on public.standards (status);
create index if not exists standards_body_idx           on public.standards (body);
create index if not exists standards_sector_idx         on public.standards (sector);
create index if not exists standards_committee_idx      on public.standards (committee) where committee is not null;
create index if not exists standards_published_date_idx on public.standards (published_date desc nulls last);
create index if not exists standards_superseded_by_idx  on public.standards (superseded_by) where superseded_by is not null;
create index if not exists standards_document_id_idx    on public.standards (document_id) where document_id is not null;
-- Backs StandardListQuery.search over number + title + abstract.
create index if not exists standards_search_idx on public.standards
  using gin (to_tsvector('english', standard_number || ' ' || title || ' ' || abstract));
create index if not exists standards_number_lower_idx on public.standards (lower(standard_number));

drop trigger if exists standards_set_updated_at on public.standards;
create trigger standards_set_updated_at
  before update on public.standards
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.standard_sections  (StandardDetail.sections / StandardScopeSection)
-- -----------------------------------------------------------------------------
create table if not exists public.standard_sections (
  id           uuid primary key default gen_random_uuid(),
  standard_id  uuid not null references public.standards (id) on delete cascade,
  -- Display order (TS `sections` is an ordered array).
  ordinal      integer not null,
  heading      text not null,
  content      text not null default '',
  -- Clause number when the document is clause-structured, e.g. '4.2.1'.
  clause       text,
  page_number  integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint standard_sections_ordinal_key   unique (standard_id, ordinal),
  constraint standard_sections_ordinal_check check (ordinal >= 0),
  constraint standard_sections_page_check    check (page_number is null or page_number >= 1)
);

create index if not exists standard_sections_standard_idx on public.standard_sections (standard_id, ordinal);
create index if not exists standard_sections_clause_idx   on public.standard_sections (standard_id, clause) where clause is not null;

drop trigger if exists standard_sections_set_updated_at on public.standard_sections;
create trigger standard_sections_set_updated_at
  before update on public.standard_sections
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.standard_amendments  (StandardAmendment)
-- -----------------------------------------------------------------------------
create table if not exists public.standard_amendments (
  id           uuid primary key default gen_random_uuid(),
  standard_id  uuid not null references public.standards (id) on delete cascade,
  -- e.g. 'Amendment No. 2'
  number       text not null,
  issued_date  date,
  summary      text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint standard_amendments_number_key   unique (standard_id, number),
  constraint standard_amendments_number_check check (length(btrim(number)) > 0)
);

create index if not exists standard_amendments_standard_idx
  on public.standard_amendments (standard_id, issued_date desc nulls last);

drop trigger if exists standard_amendments_set_updated_at on public.standard_amendments;
create trigger standard_amendments_set_updated_at
  before update on public.standard_amendments
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.standard_requirements  (StandardRequirement)
-- -----------------------------------------------------------------------------
create table if not exists public.standard_requirements (
  id           uuid primary key default gen_random_uuid(),
  standard_id  uuid not null references public.standards (id) on delete cascade,
  ordinal      integer not null default 0,
  label        text not null,
  description  text not null default '',
  -- TS `limit`. Free text because limits are expressed as '≤ 0.05 % by mass',
  -- 'min. 350 N', 'Class II or better' — never a single numeric.
  limit_text   text,
  test_method  text,
  mandatory    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint standard_requirements_label_check   check (length(btrim(label)) > 0),
  constraint standard_requirements_ordinal_check check (ordinal >= 0)
);

comment on column public.standard_requirements.limit_text is 'Maps to StandardRequirement.limit. Renamed because LIMIT is a reserved keyword.';

create index if not exists standard_requirements_standard_idx on public.standard_requirements (standard_id, ordinal);
create index if not exists standard_requirements_mandatory_idx on public.standard_requirements (standard_id) where mandatory;

drop trigger if exists standard_requirements_set_updated_at on public.standard_requirements;
create trigger standard_requirements_set_updated_at
  before update on public.standard_requirements
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.standard_references  (StandardDetail.references — self M:N)
-- -----------------------------------------------------------------------------
-- Real standards cite documents MANAK has not ingested, so the target is either
-- a real row (referenced_standard_id) or a bare designation string
-- (referenced_standard_number). At least one must be present.
create table if not exists public.standard_references (
  id                        uuid primary key default gen_random_uuid(),
  standard_id               uuid not null references public.standards (id) on delete cascade,
  referenced_standard_id    uuid references public.standards (id) on delete cascade,
  -- Free-text designation for references we cannot resolve to a row yet.
  referenced_standard_number text,
  relation                  public.related_standard_relation not null default 'referenced',
  note                      text,
  created_at                timestamptz not null default now(),

  constraint standard_references_target_check check (
    referenced_standard_id is not null or referenced_standard_number is not null
  ),
  constraint standard_references_no_self_check check (
    referenced_standard_id is null or referenced_standard_id <> standard_id
  ),
  constraint standard_references_resolved_key   unique (standard_id, referenced_standard_id, relation),
  constraint standard_references_unresolved_key unique (standard_id, referenced_standard_number, relation)
);

comment on table public.standard_references is
  'Directed standard-to-standard relations. referenced_standard_number carries citations not yet resolved to a MANAK row.';

create index if not exists standard_references_standard_idx on public.standard_references (standard_id);
create index if not exists standard_references_target_idx
  on public.standard_references (referenced_standard_id) where referenced_standard_id is not null;


-- -----------------------------------------------------------------------------
-- public.organization_applicable_standards
-- -----------------------------------------------------------------------------
-- OrganizationDetail.applicableStandardIds. Lives here rather than in 002
-- because it needs public.standards.
create table if not exists public.organization_applicable_standards (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  standard_id      uuid not null references public.standards (id) on delete cascade,
  added_by         uuid references public.users (id) on delete set null,
  added_at         timestamptz not null default now(),

  constraint organization_applicable_standards_pkey primary key (organization_id, standard_id)
);

comment on table public.organization_applicable_standards is
  'Standards an org flagged as applicable to its products. Drives OrganizationStats.standardsNeedingAttention.';

create index if not exists organization_applicable_standards_standard_idx
  on public.organization_applicable_standards (standard_id);


-- -----------------------------------------------------------------------------
-- Certification pathways  (CertificationPathway / CertificationStage)
-- -----------------------------------------------------------------------------
create table if not exists public.certification_pathways (
  id         uuid primary key default gen_random_uuid(),
  -- One canonical pathway per scheme: CertificationPathway is keyed by scheme.
  scheme     public.certification_scheme not null,
  title      text not null,
  summary    text not null default '',
  -- Indicative fee text only. Never a binding quote — see the TS comment.
  fee_note   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint certification_pathways_scheme_key unique (scheme)
);

drop trigger if exists certification_pathways_set_updated_at on public.certification_pathways;
create trigger certification_pathways_set_updated_at
  before update on public.certification_pathways
  for each row execute function public.set_updated_at();

create table if not exists public.certification_stages (
  id                 uuid primary key default gen_random_uuid(),
  pathway_id         uuid not null references public.certification_pathways (id) on delete cascade,
  -- TS `order`; renamed because ORDER is reserved.
  ordinal            integer not null,
  title              text not null,
  description        text not null default '',
  -- Template status. The per-organisation progress overlay is a product concern
  -- and is NOT modelled here — these rows are the public, generic pathway.
  status             public.certification_stage_status not null default 'pending',
  -- e.g. '10–15 working days'
  typical_duration   text,
  required_documents text[] not null default '{}'::text[],
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint certification_stages_ordinal_key   unique (pathway_id, ordinal),
  constraint certification_stages_ordinal_check check (ordinal >= 1),
  constraint certification_stages_title_check   check (length(btrim(title)) > 0)
);

comment on column public.certification_stages.status is
  'Template default (normally ''pending''). Per-org stage progress is not stored here.';

create index if not exists certification_stages_pathway_idx on public.certification_stages (pathway_id, ordinal);

drop trigger if exists certification_stages_set_updated_at on public.certification_stages;
create trigger certification_stages_set_updated_at
  before update on public.certification_stages
  for each row execute function public.set_updated_at();

-- CertificationPathway.applicableStandards
create table if not exists public.certification_pathway_standards (
  pathway_id  uuid not null references public.certification_pathways (id) on delete cascade,
  standard_id uuid not null references public.standards (id) on delete cascade,
  ordinal     integer not null default 0,

  constraint certification_pathway_standards_pkey primary key (pathway_id, standard_id)
);

create index if not exists certification_pathway_standards_standard_idx
  on public.certification_pathway_standards (standard_id);


-- -----------------------------------------------------------------------------
-- public.laboratories  (Laboratory / LaboratorySearchQuery)
-- -----------------------------------------------------------------------------
create table if not exists public.laboratories (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  address        text not null default '',
  pincode        text not null,
  city           text not null default '',
  state          text not null default '',
  recognition    public.laboratory_recognition not null default 'none',
  -- Laboratory.facilityTypes. Array (not a join table) because it is a small
  -- closed set filtered with `&&` / `= any`, never joined on.
  facility_types public.facility_type[] not null default '{}'::public.facility_type[],
  contact_phone  text,
  contact_email  text,
  -- Used to compute Laboratory.distanceKm from the searched pincode.
  -- distanceKm itself is derived per query and never stored.
  latitude       numeric(9, 6),
  longitude      numeric(9, 6),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint laboratories_name_check     check (length(btrim(name)) > 0),
  constraint laboratories_pincode_check  check (pincode ~ '^[1-9][0-9]{5}$'),
  constraint laboratories_lat_check      check (latitude  is null or latitude  between -90  and 90),
  constraint laboratories_lon_check      check (longitude is null or longitude between -180 and 180),
  constraint laboratories_email_check    check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table  public.laboratories is 'Testing/calibration facilities and BIS offices. Backs the facility-search screen.';
comment on column public.laboratories.facility_types is 'Maps to Laboratory.facilityTypes. Filter with: facility_types && array[''testing_laboratory'']::public.facility_type[]';

create index if not exists laboratories_pincode_idx     on public.laboratories (pincode);
create index if not exists laboratories_city_lower_idx  on public.laboratories (lower(city));
create index if not exists laboratories_state_lower_idx on public.laboratories (lower(state));
create index if not exists laboratories_recognition_idx on public.laboratories (recognition);
-- GIN so `facility_types && array[...]` is indexable.
create index if not exists laboratories_facility_types_gin_idx
  on public.laboratories using gin (facility_types);

drop trigger if exists laboratories_set_updated_at on public.laboratories;
create trigger laboratories_set_updated_at
  before update on public.laboratories
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.testing_requirements  (TestingRequirement)
-- -----------------------------------------------------------------------------
create table if not exists public.testing_requirements (
  id              uuid primary key default gen_random_uuid(),
  -- Nullable FK + always-present designation: test schedules are often published
  -- for standards MANAK has not ingested yet.
  standard_id     uuid references public.standards (id) on delete set null,
  standard_number text not null,
  parameter       text not null,
  method          text not null default '',
  -- TS `limit` — acceptance criteria, free text. See the reserved-word note.
  limit_text      text,
  sample_size     text,
  mandatory       boolean not null default true,
  ordinal         integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint testing_requirements_parameter_check check (length(btrim(parameter)) > 0),
  constraint testing_requirements_number_check    check (length(btrim(standard_number)) > 0)
);

create index if not exists testing_requirements_standard_idx on public.testing_requirements (standard_id) where standard_id is not null;
create index if not exists testing_requirements_number_idx   on public.testing_requirements (standard_number);

drop trigger if exists testing_requirements_set_updated_at on public.testing_requirements;
create trigger testing_requirements_set_updated_at
  before update on public.testing_requirements
  for each row execute function public.set_updated_at();

-- Keep standard_number aligned with the FK when one is supplied.
create or replace function public.testing_requirements_sync_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.standard_id is not null then
    select s.standard_number into new.standard_number
      from public.standards s where s.id = new.standard_id;
  end if;
  return new;
end;
$$;

drop trigger if exists testing_requirements_sync_number on public.testing_requirements;
create trigger testing_requirements_sync_number
  before insert or update of standard_id on public.testing_requirements
  for each row execute function public.testing_requirements_sync_number();


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- PUBLIC READ (anon + authenticated), ADMIN WRITE for the whole catalogue.
-- Rationale: the Standards Explorer, certification pathway walkthroughs and
-- facility search are all reachable before login — that is the point of the
-- product. None of these tables contains user or organisation data.
alter table public.standards                        enable row level security;
alter table public.standard_sections                enable row level security;
alter table public.standard_amendments              enable row level security;
alter table public.standard_requirements            enable row level security;
alter table public.standard_references              enable row level security;
alter table public.certification_pathways           enable row level security;
alter table public.certification_stages             enable row level security;
alter table public.certification_pathway_standards  enable row level security;
alter table public.laboratories                     enable row level security;
alter table public.testing_requirements             enable row level security;
alter table public.organization_applicable_standards enable row level security;

-- Written out longhand rather than generated in a DO loop: RLS is the security
-- boundary, so every policy must be greppable by name and diffable in review.

-- public.standards ------------------------------------------------------------
drop policy if exists standards_select_public on public.standards;
create policy standards_select_public on public.standards
  for select to anon, authenticated using (true);
drop policy if exists standards_insert_admin on public.standards;
create policy standards_insert_admin on public.standards
  for insert to authenticated with check (public.is_admin());
drop policy if exists standards_update_admin on public.standards;
create policy standards_update_admin on public.standards
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists standards_delete_admin on public.standards;
create policy standards_delete_admin on public.standards
  for delete to authenticated using (public.is_admin());

-- public.standard_sections ----------------------------------------------------
drop policy if exists standard_sections_select_public on public.standard_sections;
create policy standard_sections_select_public on public.standard_sections
  for select to anon, authenticated using (true);
drop policy if exists standard_sections_insert_admin on public.standard_sections;
create policy standard_sections_insert_admin on public.standard_sections
  for insert to authenticated with check (public.is_admin());
drop policy if exists standard_sections_update_admin on public.standard_sections;
create policy standard_sections_update_admin on public.standard_sections
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists standard_sections_delete_admin on public.standard_sections;
create policy standard_sections_delete_admin on public.standard_sections
  for delete to authenticated using (public.is_admin());

-- public.standard_amendments --------------------------------------------------
drop policy if exists standard_amendments_select_public on public.standard_amendments;
create policy standard_amendments_select_public on public.standard_amendments
  for select to anon, authenticated using (true);
drop policy if exists standard_amendments_insert_admin on public.standard_amendments;
create policy standard_amendments_insert_admin on public.standard_amendments
  for insert to authenticated with check (public.is_admin());
drop policy if exists standard_amendments_update_admin on public.standard_amendments;
create policy standard_amendments_update_admin on public.standard_amendments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists standard_amendments_delete_admin on public.standard_amendments;
create policy standard_amendments_delete_admin on public.standard_amendments
  for delete to authenticated using (public.is_admin());

-- public.standard_requirements ------------------------------------------------
drop policy if exists standard_requirements_select_public on public.standard_requirements;
create policy standard_requirements_select_public on public.standard_requirements
  for select to anon, authenticated using (true);
drop policy if exists standard_requirements_insert_admin on public.standard_requirements;
create policy standard_requirements_insert_admin on public.standard_requirements
  for insert to authenticated with check (public.is_admin());
drop policy if exists standard_requirements_update_admin on public.standard_requirements;
create policy standard_requirements_update_admin on public.standard_requirements
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists standard_requirements_delete_admin on public.standard_requirements;
create policy standard_requirements_delete_admin on public.standard_requirements
  for delete to authenticated using (public.is_admin());

-- public.standard_references --------------------------------------------------
drop policy if exists standard_references_select_public on public.standard_references;
create policy standard_references_select_public on public.standard_references
  for select to anon, authenticated using (true);
drop policy if exists standard_references_insert_admin on public.standard_references;
create policy standard_references_insert_admin on public.standard_references
  for insert to authenticated with check (public.is_admin());
drop policy if exists standard_references_update_admin on public.standard_references;
create policy standard_references_update_admin on public.standard_references
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists standard_references_delete_admin on public.standard_references;
create policy standard_references_delete_admin on public.standard_references
  for delete to authenticated using (public.is_admin());

-- public.certification_pathways -----------------------------------------------
drop policy if exists certification_pathways_select_public on public.certification_pathways;
create policy certification_pathways_select_public on public.certification_pathways
  for select to anon, authenticated using (true);
drop policy if exists certification_pathways_insert_admin on public.certification_pathways;
create policy certification_pathways_insert_admin on public.certification_pathways
  for insert to authenticated with check (public.is_admin());
drop policy if exists certification_pathways_update_admin on public.certification_pathways;
create policy certification_pathways_update_admin on public.certification_pathways
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists certification_pathways_delete_admin on public.certification_pathways;
create policy certification_pathways_delete_admin on public.certification_pathways
  for delete to authenticated using (public.is_admin());

-- public.certification_stages -------------------------------------------------
drop policy if exists certification_stages_select_public on public.certification_stages;
create policy certification_stages_select_public on public.certification_stages
  for select to anon, authenticated using (true);
drop policy if exists certification_stages_insert_admin on public.certification_stages;
create policy certification_stages_insert_admin on public.certification_stages
  for insert to authenticated with check (public.is_admin());
drop policy if exists certification_stages_update_admin on public.certification_stages;
create policy certification_stages_update_admin on public.certification_stages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists certification_stages_delete_admin on public.certification_stages;
create policy certification_stages_delete_admin on public.certification_stages
  for delete to authenticated using (public.is_admin());

-- public.certification_pathway_standards --------------------------------------
drop policy if exists certification_pathway_standards_select_public on public.certification_pathway_standards;
create policy certification_pathway_standards_select_public on public.certification_pathway_standards
  for select to anon, authenticated using (true);
drop policy if exists certification_pathway_standards_insert_admin on public.certification_pathway_standards;
create policy certification_pathway_standards_insert_admin on public.certification_pathway_standards
  for insert to authenticated with check (public.is_admin());
drop policy if exists certification_pathway_standards_update_admin on public.certification_pathway_standards;
create policy certification_pathway_standards_update_admin on public.certification_pathway_standards
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists certification_pathway_standards_delete_admin on public.certification_pathway_standards;
create policy certification_pathway_standards_delete_admin on public.certification_pathway_standards
  for delete to authenticated using (public.is_admin());

-- public.laboratories ---------------------------------------------------------
-- Retired labs (is_active = false) are filtered by the API, not by policy, so
-- admins can still manage them through the same endpoints.
drop policy if exists laboratories_select_public on public.laboratories;
create policy laboratories_select_public on public.laboratories
  for select to anon, authenticated using (true);
drop policy if exists laboratories_insert_admin on public.laboratories;
create policy laboratories_insert_admin on public.laboratories
  for insert to authenticated with check (public.is_admin());
drop policy if exists laboratories_update_admin on public.laboratories;
create policy laboratories_update_admin on public.laboratories
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists laboratories_delete_admin on public.laboratories;
create policy laboratories_delete_admin on public.laboratories
  for delete to authenticated using (public.is_admin());

-- public.testing_requirements -------------------------------------------------
drop policy if exists testing_requirements_select_public on public.testing_requirements;
create policy testing_requirements_select_public on public.testing_requirements
  for select to anon, authenticated using (true);
drop policy if exists testing_requirements_insert_admin on public.testing_requirements;
create policy testing_requirements_insert_admin on public.testing_requirements
  for insert to authenticated with check (public.is_admin());
drop policy if exists testing_requirements_update_admin on public.testing_requirements;
create policy testing_requirements_update_admin on public.testing_requirements
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists testing_requirements_delete_admin on public.testing_requirements;
create policy testing_requirements_delete_admin on public.testing_requirements
  for delete to authenticated using (public.is_admin());

-- public.organization_applicable_standards ------------------------------------
-- Org-private: this table reveals what a competitor manufactures. Members +
-- admins only. It is the one table in 004 that is NOT publicly readable.
drop policy if exists organization_applicable_standards_select on public.organization_applicable_standards;
create policy organization_applicable_standards_select on public.organization_applicable_standards
  for select to authenticated
  using (public.is_admin() or public.is_org_member(organization_id));

drop policy if exists organization_applicable_standards_insert on public.organization_applicable_standards;
create policy organization_applicable_standards_insert on public.organization_applicable_standards
  for insert to authenticated
  with check (public.is_admin() or public.is_org_manager(organization_id));

drop policy if exists organization_applicable_standards_delete on public.organization_applicable_standards;
create policy organization_applicable_standards_delete on public.organization_applicable_standards
  for delete to authenticated
  using (public.is_admin() or public.is_org_manager(organization_id));

grant select, insert, delete on public.organization_applicable_standards to authenticated;
grant select, insert, update, delete on public.organization_applicable_standards to service_role;


-- -----------------------------------------------------------------------------
-- Grants for the public catalogue
-- -----------------------------------------------------------------------------
-- anon gets SELECT only. authenticated gets write privileges too, but every
-- write is still gated by an is_admin() policy — PostgREST requires BOTH a table
-- privilege and a passing policy, so a non-admin authenticated user is refused
-- by the policy layer.
grant select on public.standards                       to anon, authenticated;
grant select on public.standard_sections               to anon, authenticated;
grant select on public.standard_amendments             to anon, authenticated;
grant select on public.standard_requirements           to anon, authenticated;
grant select on public.standard_references             to anon, authenticated;
grant select on public.certification_pathways          to anon, authenticated;
grant select on public.certification_stages            to anon, authenticated;
grant select on public.certification_pathway_standards to anon, authenticated;
grant select on public.laboratories                    to anon, authenticated;
grant select on public.testing_requirements            to anon, authenticated;

grant insert, update, delete on public.standards                       to authenticated;
grant insert, update, delete on public.standard_sections               to authenticated;
grant insert, update, delete on public.standard_amendments             to authenticated;
grant insert, update, delete on public.standard_requirements           to authenticated;
grant insert, update, delete on public.standard_references             to authenticated;
grant insert, update, delete on public.certification_pathways          to authenticated;
grant insert, update, delete on public.certification_stages            to authenticated;
grant insert, update, delete on public.certification_pathway_standards to authenticated;
grant insert, update, delete on public.laboratories                    to authenticated;
grant insert, update, delete on public.testing_requirements            to authenticated;

grant select, insert, update, delete on public.standards                       to service_role;
grant select, insert, update, delete on public.standard_sections               to service_role;
grant select, insert, update, delete on public.standard_amendments             to service_role;
grant select, insert, update, delete on public.standard_requirements           to service_role;
grant select, insert, update, delete on public.standard_references             to service_role;
grant select, insert, update, delete on public.certification_pathways          to service_role;
grant select, insert, update, delete on public.certification_stages            to service_role;
grant select, insert, update, delete on public.certification_pathway_standards to service_role;
grant select, insert, update, delete on public.laboratories                    to service_role;
grant select, insert, update, delete on public.testing_requirements            to service_role;
