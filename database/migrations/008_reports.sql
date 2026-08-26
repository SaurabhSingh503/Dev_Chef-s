-- =============================================================================
-- MANAK — 008_reports.sql
-- Reports, saved resources, and the curated discovery surfaces (trending topics,
-- what's new, industry knowledge).
-- -----------------------------------------------------------------------------
-- Depends on: 001 (users, language_code, set_updated_at, is_admin)
--             002 (organizations, industry_sector, is_org_member, is_org_manager)
--             004 (standards)
--
-- Serves shared/types/reports.ts in full:
--   ReportSummary / ReportDetail / ReportSection / SavedResource /
--   TrendingTopic / WhatsNewItem / IndustryKnowledgeItem
--
-- Two visibility regimes in one file:
--   * reports + saved_resources  -> private (org-scoped / per-user)
--   * trending_topics + whats_new + industry_knowledge -> public catalogue
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- shared/types/reports.ts :: ReportType
do $$ begin
  create type public.report_type as enum (
    'compliance_gap',
    'standards_digest',
    'certification_readiness',
    'testing_plan',
    'industry_briefing'
  );
exception when duplicate_object then null; end $$;

-- shared/types/reports.ts :: ReportStatus
-- Note: deliberately NOT the same set as pdf_job_status (which adds 'queued').
do $$ begin
  create type public.report_status as enum ('generating', 'ready', 'failed');
exception when duplicate_object then null; end $$;

-- shared/types/reports.ts :: SavedResourceKind
do $$ begin
  create type public.saved_resource_kind as enum ('standard', 'handbook', 'report', 'ai_answer');
exception when duplicate_object then null; end $$;

-- shared/types/reports.ts :: WhatsNewItem.kind
do $$ begin
  create type public.whats_new_kind as enum (
    'standard_published',
    'standard_revised',
    'handbook_added',
    'announcement'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- public.reports  (ReportSummary / ReportDetail)
-- -----------------------------------------------------------------------------
create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  type            public.report_type not null,
  status          public.report_status not null default 'generating',
  title           text not null,
  summary         text not null default '',
  -- NULL for individual-scoped reports; set for organisation reports. This
  -- single column decides whether the report is private to one person or shared
  -- with an organisation.
  organization_id uuid references public.organizations (id) on delete cascade,
  created_by      uuid not null references public.users (id) on delete cascade,
  language        public.language_code not null default 'en',
  sector          public.industry_sector,
  -- Expiring signed URL for the generated PDF.
  download_url    text,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint reports_title_check check (length(btrim(title)) > 0),
  constraint reports_error_state_check check (
    (status = 'failed' and error is not null)
    or (status <> 'failed' and error is null)
  )
);

comment on table  public.reports is 'Generated compliance/digest/readiness reports. Mirrors shared/types/reports.ts::ReportDetail.';
comment on column public.reports.organization_id is 'NULL = private to created_by. Non-NULL = shared with that organisation''s members only.';

create index if not exists reports_created_by_idx on public.reports (created_by, created_at desc);
create index if not exists reports_org_idx        on public.reports (organization_id, created_at desc) where organization_id is not null;
create index if not exists reports_type_idx       on public.reports (type);
create index if not exists reports_status_idx     on public.reports (status);

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.report_sections  (ReportSection)
-- -----------------------------------------------------------------------------
create table if not exists public.report_sections (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.reports (id) on delete cascade,
  ordinal    integer not null,
  heading    text not null,
  body       text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint report_sections_ordinal_key   unique (report_id, ordinal),
  constraint report_sections_ordinal_check check (ordinal >= 0),
  constraint report_sections_heading_check check (length(btrim(heading)) > 0)
);

create index if not exists report_sections_report_idx on public.report_sections (report_id, ordinal);

drop trigger if exists report_sections_set_updated_at on public.report_sections;
create trigger report_sections_set_updated_at
  before update on public.report_sections
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.report_standards  (ReportSection.standards + report-level scope)
-- -----------------------------------------------------------------------------
-- Two jobs in one table:
--   section_id IS NULL  -> a standard the whole report is scoped to
--                          (CreateReportRequest.standardIds)
--   section_id IS NOT NULL -> a standard referenced by that specific section
--                          (ReportSection.standards)
create table if not exists public.report_standards (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports (id) on delete cascade,
  section_id  uuid references public.report_sections (id) on delete cascade,
  standard_id uuid not null references public.standards (id) on delete cascade,
  ordinal     integer not null default 0,

  -- NULLS DISTINCT (the PG 15 default) means the report-level rows are not
  -- deduplicated by this constraint; the partial unique index below covers them.
  constraint report_standards_section_key unique (report_id, section_id, standard_id)
);

create unique index if not exists report_standards_report_scope_key
  on public.report_standards (report_id, standard_id) where section_id is null;

create index if not exists report_standards_report_idx   on public.report_standards (report_id);
create index if not exists report_standards_section_idx  on public.report_standards (section_id) where section_id is not null;
create index if not exists report_standards_standard_idx on public.report_standards (standard_id);


-- -----------------------------------------------------------------------------
-- public.saved_resources  (SavedResource)
-- -----------------------------------------------------------------------------
-- Deliberately polymorphic: `resource_id` has NO foreign key because it points
-- at four different tables depending on `kind` (standards, handbooks, reports,
-- ai_answers). The trade-off is accepted because the alternative — four
-- near-identical join tables — would force the "Saved" page to UNION four
-- queries for a list that is always rendered as one mixed feed. Consequence: the
-- backend must clean up saved rows when a resource is deleted, or tolerate
-- dangling entries (the list endpoint should skip unresolvable ids).
create table if not exists public.saved_resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  kind        public.saved_resource_kind not null,
  resource_id uuid not null,
  -- Snapshot for list rendering without four joins. Refreshed on re-save.
  title       text not null default '',
  -- Caption line, e.g. the standard number or handbook code.
  subtitle    text,
  saved_at    timestamptz not null default now(),

  -- Required by the brief: one save per user, per kind, per resource.
  constraint saved_resources_user_kind_resource_key unique (user_id, kind, resource_id)
);

comment on table  public.saved_resources is 'Per-user bookmarks across standards/handbooks/reports/AI answers. Feeds isSaved flags and savedOnly filters.';
comment on column public.saved_resources.resource_id is 'Polymorphic id resolved by `kind`. Intentionally has no FK — see the table comment in 008_reports.sql.';

create index if not exists saved_resources_user_idx     on public.saved_resources (user_id, saved_at desc);
create index if not exists saved_resources_kind_idx     on public.saved_resources (user_id, kind, saved_at desc);
-- Backs the `isSaved` lookup for a page of standards/handbooks.
create index if not exists saved_resources_resource_idx on public.saved_resources (kind, resource_id);


-- -----------------------------------------------------------------------------
-- public.trending_topics  (TrendingTopic)
-- -----------------------------------------------------------------------------
-- Materialised aggregate, recomputed periodically from public.search_history
-- (006). Stored rather than computed live so an anonymous visitor can see trends
-- without any read access to per-user search logs.
create table if not exists public.trending_topics (
  id             uuid primary key default gen_random_uuid(),
  topic          text not null,
  -- Searches in the trailing window.
  volume         integer not null default 0,
  -- Percentage change vs the previous window; negative means cooling.
  change_percent numeric(7, 2) not null default 0,
  sector         public.industry_sector,
  window_start   date,
  window_end     date,
  computed_at    timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint trending_topics_topic_check  check (length(btrim(topic)) > 0),
  constraint trending_topics_volume_check check (volume >= 0),
  constraint trending_topics_window_check check (
    window_start is null or window_end is null or window_end >= window_start
  ),
  constraint trending_topics_topic_window_key unique (topic, window_start, window_end)
);

comment on table public.trending_topics is
  'Aggregated from search_history on a schedule. Public read — this is why trends never expose an individual''s queries.';

create index if not exists trending_topics_volume_idx on public.trending_topics (volume desc);
create index if not exists trending_topics_sector_idx on public.trending_topics (sector) where sector is not null;
create index if not exists trending_topics_window_idx on public.trending_topics (window_end desc nulls last);

drop trigger if exists trending_topics_set_updated_at on public.trending_topics;
create trigger trending_topics_set_updated_at
  before update on public.trending_topics
  for each row execute function public.set_updated_at();

-- TrendingTopic.relatedStandards
create table if not exists public.trending_topic_standards (
  topic_id    uuid not null references public.trending_topics (id) on delete cascade,
  standard_id uuid not null references public.standards (id) on delete cascade,
  ordinal     integer not null default 0,

  constraint trending_topic_standards_pkey primary key (topic_id, standard_id)
);

create index if not exists trending_topic_standards_standard_idx
  on public.trending_topic_standards (standard_id);


-- -----------------------------------------------------------------------------
-- public.whats_new  (WhatsNewItem)
-- -----------------------------------------------------------------------------
create table if not exists public.whats_new (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null default '',
  kind         public.whats_new_kind not null,
  -- Deep link into the app, e.g. '/standards/IS%2015757%3A2021'. Relative by
  -- convention so the same row works across environments.
  href         text,
  published_at timestamptz not null default now(),
  -- Lets an entry be staged before it goes live.
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint whats_new_title_check check (length(btrim(title)) > 0)
);

create index if not exists whats_new_published_idx on public.whats_new (published_at desc) where is_published;
create index if not exists whats_new_kind_idx      on public.whats_new (kind);

drop trigger if exists whats_new_set_updated_at on public.whats_new;
create trigger whats_new_set_updated_at
  before update on public.whats_new
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.industry_knowledge  (IndustryKnowledgeItem)
-- -----------------------------------------------------------------------------
-- Dual purpose, like handbooks: organization_id NULL = curated public sector
-- briefing; organization_id set = that organisation's private knowledge note.
create table if not exists public.industry_knowledge (
  id              uuid primary key default gen_random_uuid(),
  sector          public.industry_sector not null,
  title           text not null,
  summary         text not null default '',
  organization_id uuid references public.organizations (id) on delete cascade,
  created_by      uuid references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint industry_knowledge_title_check check (length(btrim(title)) > 0)
);

comment on column public.industry_knowledge.organization_id is
  'NULL = curated public briefing. Non-NULL = private to that organisation (never visible to another org).';

create index if not exists industry_knowledge_sector_idx on public.industry_knowledge (sector, updated_at desc);
create index if not exists industry_knowledge_org_idx
  on public.industry_knowledge (organization_id) where organization_id is not null;

drop trigger if exists industry_knowledge_set_updated_at on public.industry_knowledge;
create trigger industry_knowledge_set_updated_at
  before update on public.industry_knowledge
  for each row execute function public.set_updated_at();

-- IndustryKnowledgeItem.keyStandards
create table if not exists public.industry_knowledge_standards (
  knowledge_id uuid not null references public.industry_knowledge (id) on delete cascade,
  standard_id  uuid not null references public.standards (id) on delete cascade,
  ordinal      integer not null default 0,

  constraint industry_knowledge_standards_pkey primary key (knowledge_id, standard_id)
);

create index if not exists industry_knowledge_standards_standard_idx
  on public.industry_knowledge_standards (standard_id);


-- -----------------------------------------------------------------------------
-- Readability helper
-- -----------------------------------------------------------------------------
-- report_sections and report_standards inherit visibility from their report.
-- Defined once so the child policies cannot drift from the parent rule.
create or replace function public.can_read_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.reports r
    where r.id = p_report_id
      and (
        public.is_admin()
        or r.created_by = auth.uid()
        or (r.organization_id is not null and public.is_org_member(r.organization_id))
      )
  );
$$;

comment on function public.can_read_report(uuid) is
  'True when the caller created the report, belongs to its organisation, or is an admin. Backs report_sections / report_standards RLS.';


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.reports                      enable row level security;
alter table public.report_sections              enable row level security;
alter table public.report_standards             enable row level security;
alter table public.saved_resources              enable row level security;
alter table public.trending_topics              enable row level security;
alter table public.trending_topic_standards     enable row level security;
alter table public.whats_new                    enable row level security;
alter table public.industry_knowledge           enable row level security;
alter table public.industry_knowledge_standards enable row level security;

-- public.reports --------------------------------------------------------------
-- A compliance-gap report names exactly which standards a manufacturer is
-- failing. It is the single most sensitive artefact in MANAK, so there is no
-- public read path at all.
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select to authenticated using (created_by = auth.uid());

drop policy if exists reports_select_org_member on public.reports;
create policy reports_select_org_member on public.reports
  for select to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists reports_select_admin on public.reports;
create policy reports_select_admin on public.reports
  for select to authenticated using (public.is_admin());

-- You may create a report for yourself, or for an organisation you belong to —
-- never for an organisation you do not belong to.
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (organization_id is null or public.is_org_member(organization_id))
  );

drop policy if exists reports_update_own on public.reports;
create policy reports_update_own on public.reports
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and (organization_id is null or public.is_org_member(organization_id)));

drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin on public.reports
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists reports_delete_own on public.reports;
create policy reports_delete_own on public.reports
  for delete to authenticated
  using (created_by = auth.uid() or public.is_admin() or (organization_id is not null and public.is_org_manager(organization_id)));

-- public.report_sections ------------------------------------------------------
drop policy if exists report_sections_select on public.report_sections;
create policy report_sections_select on public.report_sections
  for select to authenticated using (public.can_read_report(report_id));
drop policy if exists report_sections_insert on public.report_sections;
create policy report_sections_insert on public.report_sections
  for insert to authenticated with check (public.can_read_report(report_id));
drop policy if exists report_sections_update on public.report_sections;
create policy report_sections_update on public.report_sections
  for update to authenticated
  using (public.can_read_report(report_id)) with check (public.can_read_report(report_id));
drop policy if exists report_sections_delete on public.report_sections;
create policy report_sections_delete on public.report_sections
  for delete to authenticated using (public.can_read_report(report_id));

-- public.report_standards -----------------------------------------------------
drop policy if exists report_standards_select on public.report_standards;
create policy report_standards_select on public.report_standards
  for select to authenticated using (public.can_read_report(report_id));
drop policy if exists report_standards_insert on public.report_standards;
create policy report_standards_insert on public.report_standards
  for insert to authenticated with check (public.can_read_report(report_id));
drop policy if exists report_standards_delete on public.report_standards;
create policy report_standards_delete on public.report_standards
  for delete to authenticated using (public.can_read_report(report_id));

-- public.saved_resources ------------------------------------------------------
-- Strictly per-user. Admins are NOT granted read here: unlike AI analytics there
-- is no product surface that needs another person's bookmark list, and "what a
-- manufacturer bookmarked" is competitively sensitive. Deliberately narrower
-- than search_history / ai_conversations.
drop policy if exists saved_resources_select_own on public.saved_resources;
create policy saved_resources_select_own on public.saved_resources
  for select to authenticated using (user_id = auth.uid());
drop policy if exists saved_resources_insert_own on public.saved_resources;
create policy saved_resources_insert_own on public.saved_resources
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists saved_resources_update_own on public.saved_resources;
create policy saved_resources_update_own on public.saved_resources
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists saved_resources_delete_own on public.saved_resources;
create policy saved_resources_delete_own on public.saved_resources
  for delete to authenticated using (user_id = auth.uid());

-- public.trending_topics ------------------------------------------------------
drop policy if exists trending_topics_select_public on public.trending_topics;
create policy trending_topics_select_public on public.trending_topics
  for select to anon, authenticated using (true);
drop policy if exists trending_topics_write_admin on public.trending_topics;
create policy trending_topics_write_admin on public.trending_topics
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists trending_topic_standards_select_public on public.trending_topic_standards;
create policy trending_topic_standards_select_public on public.trending_topic_standards
  for select to anon, authenticated using (true);
drop policy if exists trending_topic_standards_write_admin on public.trending_topic_standards;
create policy trending_topic_standards_write_admin on public.trending_topic_standards
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- public.whats_new ------------------------------------------------------------
-- Staged (is_published = false) rows are hidden from everyone except admins.
drop policy if exists whats_new_select_public on public.whats_new;
create policy whats_new_select_public on public.whats_new
  for select to anon, authenticated using (is_published);
drop policy if exists whats_new_select_admin on public.whats_new;
create policy whats_new_select_admin on public.whats_new
  for select to authenticated using (public.is_admin());
drop policy if exists whats_new_write_admin on public.whats_new;
create policy whats_new_write_admin on public.whats_new
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- public.industry_knowledge ---------------------------------------------------
drop policy if exists industry_knowledge_select_public on public.industry_knowledge;
create policy industry_knowledge_select_public on public.industry_knowledge
  for select to anon, authenticated using (organization_id is null);

drop policy if exists industry_knowledge_select_org_member on public.industry_knowledge;
create policy industry_knowledge_select_org_member on public.industry_knowledge
  for select to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists industry_knowledge_select_admin on public.industry_knowledge;
create policy industry_knowledge_select_admin on public.industry_knowledge
  for select to authenticated using (public.is_admin());

drop policy if exists industry_knowledge_insert on public.industry_knowledge;
create policy industry_knowledge_insert on public.industry_knowledge
  for insert to authenticated
  with check (
    public.is_admin()
    or (organization_id is not null and public.is_org_manager(organization_id))
  );

drop policy if exists industry_knowledge_update on public.industry_knowledge;
create policy industry_knowledge_update on public.industry_knowledge
  for update to authenticated
  using (public.is_admin() or (organization_id is not null and public.is_org_manager(organization_id)))
  with check (public.is_admin() or (organization_id is not null and public.is_org_manager(organization_id)));

drop policy if exists industry_knowledge_delete on public.industry_knowledge;
create policy industry_knowledge_delete on public.industry_knowledge
  for delete to authenticated
  using (public.is_admin() or (organization_id is not null and public.is_org_manager(organization_id)));

-- public.industry_knowledge_standards -----------------------------------------
-- Inherits its parent's visibility. A private org note's key standards must not
-- leak the note's existence to another org.
drop policy if exists industry_knowledge_standards_select on public.industry_knowledge_standards;
create policy industry_knowledge_standards_select on public.industry_knowledge_standards
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.industry_knowledge k
      where k.id = industry_knowledge_standards.knowledge_id
        and (
          k.organization_id is null
          or public.is_admin()
          or public.is_org_member(k.organization_id)
        )
    )
  );

drop policy if exists industry_knowledge_standards_write on public.industry_knowledge_standards;
create policy industry_knowledge_standards_write on public.industry_knowledge_standards
  for all to authenticated
  using (
    exists (
      select 1 from public.industry_knowledge k
      where k.id = industry_knowledge_standards.knowledge_id
        and (public.is_admin() or (k.organization_id is not null and public.is_org_manager(k.organization_id)))
    )
  )
  with check (
    exists (
      select 1 from public.industry_knowledge k
      where k.id = industry_knowledge_standards.knowledge_id
        and (public.is_admin() or (k.organization_id is not null and public.is_org_manager(k.organization_id)))
    )
  );


-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.reports          to authenticated;
grant select, insert, update, delete on public.report_sections   to authenticated;
grant select, insert, delete         on public.report_standards  to authenticated;
grant select, insert, update, delete on public.saved_resources   to authenticated;

grant select on public.trending_topics              to anon, authenticated;
grant select on public.trending_topic_standards     to anon, authenticated;
grant select on public.whats_new                    to anon, authenticated;
grant select on public.industry_knowledge           to anon, authenticated;
grant select on public.industry_knowledge_standards to anon, authenticated;

grant insert, update, delete on public.trending_topics              to authenticated;
grant insert, update, delete on public.trending_topic_standards     to authenticated;
grant insert, update, delete on public.whats_new                    to authenticated;
grant insert, update, delete on public.industry_knowledge           to authenticated;
grant insert, update, delete on public.industry_knowledge_standards to authenticated;

grant select, insert, update, delete on public.reports                      to service_role;
grant select, insert, update, delete on public.report_sections              to service_role;
grant select, insert, update, delete on public.report_standards             to service_role;
grant select, insert, update, delete on public.saved_resources              to service_role;
grant select, insert, update, delete on public.trending_topics              to service_role;
grant select, insert, update, delete on public.trending_topic_standards     to service_role;
grant select, insert, update, delete on public.whats_new                    to service_role;
grant select, insert, update, delete on public.industry_knowledge           to service_role;
grant select, insert, update, delete on public.industry_knowledge_standards to service_role;

grant execute on function public.can_read_report(uuid) to authenticated, service_role;
