-- =============================================================================
-- MANAK — 007_handbook.sql
-- Handbooks (BIS + organisation), their chapter/section outline, the handbook ⇄
-- standard join, and the "make PDF" job queue.
-- -----------------------------------------------------------------------------
-- Depends on: 001 (users, language_code, set_updated_at, is_admin, is_service_role)
--             002 (organizations, industry_sector, is_org_member, is_org_manager)
--             003 (documents)
--             004 (standards, standards_body)
--
-- Serves shared/types/handbook.ts:
--   HandbookSummary / HandbookDetail / HandbookChapter / HandbookPreview /
--   HandbookPdfJob
--
-- Split-visibility table: `source = 'bis'` handbooks are part of the public
-- catalogue (anonymous visitors browse them); `source = 'org'` handbooks are
-- private to their owning organisation. Both live in one table because the
-- reference screen's BIS/Org. segmented toggle is a filter over one grid.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- shared/types/handbook.ts :: HandbookSource  (the BIS / Org. toggle)
do $$ begin
  create type public.handbook_source as enum ('bis', 'org');
exception when duplicate_object then null; end $$;

-- shared/types/handbook.ts :: PdfJobStatus
do $$ begin
  create type public.pdf_job_status as enum ('queued', 'generating', 'ready', 'failed');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- public.handbooks
-- -----------------------------------------------------------------------------
create table if not exists public.handbooks (
  id               uuid primary key default gen_random_uuid(),
  -- Short code shown on the card, e.g. 'SP 7'. Nullable: org handbooks often
  -- have no formal code.
  code             text,
  title            text not null,
  source           public.handbook_source not null default 'bis',
  body             public.standards_body not null default 'bis',
  sector           public.industry_sector not null default 'other',
  cover_image_url  text,
  page_count       integer,
  published_year   integer,
  language         public.language_code not null default 'en',
  description      text not null default '',
  document_url     text,
  -- Owning organisation. REQUIRED when source = 'org', FORBIDDEN when 'bis'.
  organization_id  uuid references public.organizations (id) on delete cascade,
  -- Unpublished org handbooks are drafts, visible to their org but not listed.
  is_published     boolean not null default true,
  -- Link into the RAG corpus once the handbook PDF has been ingested.
  document_id      uuid references public.documents (id) on delete set null,
  created_by       uuid references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint handbooks_title_check      check (length(btrim(title)) > 0),
  constraint handbooks_page_count_check check (page_count is null or page_count >= 0),
  constraint handbooks_year_check       check (published_year is null or published_year between 1900 and 2100),
  -- The ownership rule the brief calls out: source='org' ⇒ owning organisation.
  constraint handbooks_org_ownership_check check (
    (source = 'org' and organization_id is not null)
    or
    (source = 'bis' and organization_id is null)
  )
);

comment on table  public.handbooks is 'BIS special publications and organisation handbooks. Mirrors shared/types/handbook.ts::HandbookDetail.';
comment on column public.handbooks.source is 'Drives the reference screen''s BIS/Org. toggle AND the visibility rule: bis = public, org = tenant-private.';
comment on column public.handbooks.is_published is 'Draft flag for org handbooks. Unpublished rows are visible to the owning org only.';

-- BIS codes are globally unique; org codes are only unique within their org.
create unique index if not exists handbooks_bis_code_key
  on public.handbooks (code) where source = 'bis' and code is not null;
create unique index if not exists handbooks_org_code_key
  on public.handbooks (organization_id, code) where source = 'org' and code is not null;

create index if not exists handbooks_source_idx    on public.handbooks (source);
create index if not exists handbooks_sector_idx    on public.handbooks (sector);
create index if not exists handbooks_language_idx  on public.handbooks (language);
create index if not exists handbooks_org_idx       on public.handbooks (organization_id) where organization_id is not null;
create index if not exists handbooks_year_idx      on public.handbooks (published_year desc nulls last);
-- Backs the centred pill search on the reference Handbook screen.
create index if not exists handbooks_search_idx on public.handbooks
  using gin (to_tsvector('english', coalesce(code, '') || ' ' || title || ' ' || description));

drop trigger if exists handbooks_set_updated_at on public.handbooks;
create trigger handbooks_set_updated_at
  before update on public.handbooks
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.handbook_chapters  (HandbookChapter)
-- -----------------------------------------------------------------------------
create table if not exists public.handbook_chapters (
  id          uuid primary key default gen_random_uuid(),
  handbook_id uuid not null references public.handbooks (id) on delete cascade,
  -- TS `order`; renamed because ORDER is a reserved keyword.
  ordinal     integer not null,
  title       text not null,
  start_page  integer,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint handbook_chapters_ordinal_key    unique (handbook_id, ordinal),
  constraint handbook_chapters_ordinal_check  check (ordinal >= 1),
  constraint handbook_chapters_title_check    check (length(btrim(title)) > 0),
  constraint handbook_chapters_start_page_check check (start_page is null or start_page >= 1)
);

create index if not exists handbook_chapters_handbook_idx on public.handbook_chapters (handbook_id, ordinal);

drop trigger if exists handbook_chapters_set_updated_at on public.handbook_chapters;
create trigger handbook_chapters_set_updated_at
  before update on public.handbook_chapters
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.handbook_sections  (HandbookChapter.sections — one level deep)
-- -----------------------------------------------------------------------------
create table if not exists public.handbook_sections (
  id         uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.handbook_chapters (id) on delete cascade,
  ordinal    integer not null,
  title      text not null,
  start_page integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint handbook_sections_ordinal_key     unique (chapter_id, ordinal),
  constraint handbook_sections_ordinal_check   check (ordinal >= 1),
  constraint handbook_sections_title_check     check (length(btrim(title)) > 0),
  constraint handbook_sections_start_page_check check (start_page is null or start_page >= 1)
);

comment on table public.handbook_sections is
  'Nested one level under a chapter, matching HandbookChapter.sections. Deeper nesting is intentionally not modelled.';

create index if not exists handbook_sections_chapter_idx on public.handbook_sections (chapter_id, ordinal);

drop trigger if exists handbook_sections_set_updated_at on public.handbook_sections;
create trigger handbook_sections_set_updated_at
  before update on public.handbook_sections
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.handbook_standards  (HandbookDetail.relatedStandards)
-- -----------------------------------------------------------------------------
create table if not exists public.handbook_standards (
  handbook_id uuid not null references public.handbooks (id) on delete cascade,
  standard_id uuid not null references public.standards (id) on delete cascade,
  ordinal     integer not null default 0,

  constraint handbook_standards_pkey primary key (handbook_id, standard_id)
);

create index if not exists handbook_standards_standard_idx on public.handbook_standards (standard_id);


-- -----------------------------------------------------------------------------
-- public.pdf_jobs  (HandbookPdfRequest / HandbookPdfJob)
-- -----------------------------------------------------------------------------
create table if not exists public.pdf_jobs (
  id                        uuid primary key default gen_random_uuid(),
  requested_by              uuid not null references public.users (id) on delete cascade,
  status                    public.pdf_job_status not null default 'queued',
  -- 0..100 for the progress indicator.
  progress                  integer not null default 0,
  -- Expiring signed URL; only meaningful while status = 'ready'.
  download_url              text,
  expires_at                timestamptz,
  error                     text,

  -- The request payload. Arrays rather than join tables: a job is an immutable
  -- record of what was asked for, not a queryable relationship.
  handbook_ids              uuid[] not null default '{}'::uuid[],
  chapter_ids               uuid[],
  include_related_standards boolean not null default false,
  language                  public.language_code not null default 'en',

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint pdf_jobs_progress_check check (progress between 0 and 100),
  constraint pdf_jobs_handbooks_check check (cardinality(handbook_ids) >= 1),
  -- Same honesty rule as documents: an error only on failure, a URL only when ready.
  constraint pdf_jobs_error_state_check check (
    (status = 'failed' and error is not null)
    or (status <> 'failed' and error is null)
  ),
  constraint pdf_jobs_ready_url_check check (status <> 'ready' or download_url is not null)
);

comment on table  public.pdf_jobs is 'Async "make PDF" queue for handbook compilation. Mirrors shared/types/handbook.ts::HandbookPdfJob.';
comment on column public.pdf_jobs.handbook_ids is 'HandbookPdfRequest.handbookIds. No FK: an immutable request record must survive handbook deletion.';

create index if not exists pdf_jobs_requested_by_idx on public.pdf_jobs (requested_by, created_at desc);
-- Worker queue scan.
create index if not exists pdf_jobs_pending_idx
  on public.pdf_jobs (created_at) where status in ('queued', 'generating');

drop trigger if exists pdf_jobs_set_updated_at on public.pdf_jobs;
create trigger pdf_jobs_set_updated_at
  before update on public.pdf_jobs
  for each row execute function public.set_updated_at();

-- Force progress = 100 on success so the UI can rely on it.
create or replace function public.pdf_jobs_normalise_progress()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'ready' then
    new.progress := 100;
  end if;
  return new;
end;
$$;

drop trigger if exists pdf_jobs_normalise_progress on public.pdf_jobs;
create trigger pdf_jobs_normalise_progress
  before insert or update on public.pdf_jobs
  for each row execute function public.pdf_jobs_normalise_progress();


-- -----------------------------------------------------------------------------
-- Readability helper
-- -----------------------------------------------------------------------------
-- Chapters, sections and the standards join all inherit their visibility from the
-- parent handbook. Defining that rule once here keeps the three child policies
-- from drifting apart — a drift that would leak one org's draft handbook outline.
create or replace function public.can_read_handbook(p_handbook_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.handbooks h
    where h.id = p_handbook_id
      and (
        public.is_service_role()
        or public.is_admin()
        or (h.source = 'bis' and h.is_published)
        or (h.organization_id is not null and public.is_org_member(h.organization_id))
      )
  );
$$;

comment on function public.can_read_handbook(uuid) is
  'Single definition of handbook visibility: published BIS handbooks are public, org handbooks are member-only. Used by the chapter/section/join policies.';


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.handbooks         enable row level security;
alter table public.handbook_chapters enable row level security;
alter table public.handbook_sections enable row level security;
alter table public.handbook_standards enable row level security;
alter table public.pdf_jobs          enable row level security;

-- public.handbooks ------------------------------------------------------------
-- Published BIS handbooks: readable by everyone, anonymous visitors included —
-- the Handbook screen is a pre-login surface.
drop policy if exists handbooks_select_public_bis on public.handbooks;
create policy handbooks_select_public_bis on public.handbooks
  for select to anon, authenticated
  using (source = 'bis' and is_published);

-- Org handbooks (published or draft): members of that organisation only. This is
-- the cross-tenant boundary for handbooks — org A cannot list org B's handbooks.
drop policy if exists handbooks_select_org_member on public.handbooks;
create policy handbooks_select_org_member on public.handbooks
  for select to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists handbooks_select_admin on public.handbooks;
create policy handbooks_select_admin on public.handbooks
  for select to authenticated
  using (public.is_admin());

drop policy if exists handbooks_insert_admin on public.handbooks;
create policy handbooks_insert_admin on public.handbooks
  for insert to authenticated
  with check (public.is_admin());

-- An org manager may publish handbooks for their own organisation only, and only
-- as source='org' — nobody can mint a BIS handbook.
drop policy if exists handbooks_insert_org_manager on public.handbooks;
create policy handbooks_insert_org_manager on public.handbooks
  for insert to authenticated
  with check (
    source = 'org'
    and organization_id is not null
    and public.is_org_manager(organization_id)
  );

drop policy if exists handbooks_update_admin on public.handbooks;
create policy handbooks_update_admin on public.handbooks
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists handbooks_update_org_manager on public.handbooks;
create policy handbooks_update_org_manager on public.handbooks
  for update to authenticated
  using (source = 'org' and organization_id is not null and public.is_org_manager(organization_id))
  with check (source = 'org' and organization_id is not null and public.is_org_manager(organization_id));

drop policy if exists handbooks_delete_admin on public.handbooks;
create policy handbooks_delete_admin on public.handbooks
  for delete to authenticated using (public.is_admin());

drop policy if exists handbooks_delete_org_manager on public.handbooks;
create policy handbooks_delete_org_manager on public.handbooks
  for delete to authenticated
  using (source = 'org' and organization_id is not null and public.is_org_manager(organization_id));

-- public.handbook_chapters ----------------------------------------------------
drop policy if exists handbook_chapters_select on public.handbook_chapters;
create policy handbook_chapters_select on public.handbook_chapters
  for select to anon, authenticated
  using (public.can_read_handbook(handbook_id));
drop policy if exists handbook_chapters_write_admin on public.handbook_chapters;
create policy handbook_chapters_write_admin on public.handbook_chapters
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- public.handbook_sections ----------------------------------------------------
-- Visibility is inherited two levels up, via the chapter's handbook.
drop policy if exists handbook_sections_select on public.handbook_sections;
create policy handbook_sections_select on public.handbook_sections
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.handbook_chapters c
      where c.id = handbook_sections.chapter_id
        and public.can_read_handbook(c.handbook_id)
    )
  );
drop policy if exists handbook_sections_write_admin on public.handbook_sections;
create policy handbook_sections_write_admin on public.handbook_sections
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- public.handbook_standards ---------------------------------------------------
drop policy if exists handbook_standards_select on public.handbook_standards;
create policy handbook_standards_select on public.handbook_standards
  for select to anon, authenticated
  using (public.can_read_handbook(handbook_id));
drop policy if exists handbook_standards_write_admin on public.handbook_standards;
create policy handbook_standards_write_admin on public.handbook_standards
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- public.pdf_jobs -------------------------------------------------------------
-- Strictly per-user: a signed download URL must never be visible to anyone else,
-- not even to a colleague in the same organisation.
drop policy if exists pdf_jobs_select_own on public.pdf_jobs;
create policy pdf_jobs_select_own on public.pdf_jobs
  for select to authenticated using (requested_by = auth.uid());
drop policy if exists pdf_jobs_select_admin on public.pdf_jobs;
create policy pdf_jobs_select_admin on public.pdf_jobs
  for select to authenticated using (public.is_admin());
drop policy if exists pdf_jobs_insert_own on public.pdf_jobs;
create policy pdf_jobs_insert_own on public.pdf_jobs
  for insert to authenticated with check (requested_by = auth.uid());
drop policy if exists pdf_jobs_delete_own on public.pdf_jobs;
create policy pdf_jobs_delete_own on public.pdf_jobs
  for delete to authenticated using (requested_by = auth.uid());
-- No authenticated UPDATE policy: status/progress/download_url are advanced by
-- the PDF worker through the service role. A client that could write
-- download_url could point a colleague at arbitrary storage.


-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant select on public.handbooks         to anon, authenticated;
grant select on public.handbook_chapters to anon, authenticated;
grant select on public.handbook_sections to anon, authenticated;
grant select on public.handbook_standards to anon, authenticated;

grant insert, update, delete on public.handbooks         to authenticated;
grant insert, update, delete on public.handbook_chapters to authenticated;
grant insert, update, delete on public.handbook_sections to authenticated;
grant insert, update, delete on public.handbook_standards to authenticated;

grant select, insert, delete on public.pdf_jobs to authenticated;

grant select, insert, update, delete on public.handbooks          to service_role;
grant select, insert, update, delete on public.handbook_chapters  to service_role;
grant select, insert, update, delete on public.handbook_sections  to service_role;
grant select, insert, update, delete on public.handbook_standards to service_role;
grant select, insert, update, delete on public.pdf_jobs           to service_role;

grant execute on function public.can_read_handbook(uuid) to anon, authenticated, service_role;
