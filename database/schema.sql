-- =============================================================================
--  MANAK — database/schema.sql
--  COMPLETE CONSOLIDATED SCHEMA for PostgreSQL 15 / Supabase
-- =============================================================================
--
--  Run this on a fresh database to get everything at once: extensions, enums,
--  tables, constraints, indexes, functions, triggers, Row Level Security
--  policies and grants.
--
--      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/schema.sql
--
--  Then, optionally, load demo content:
--
--      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/seed.sql
--
--  ---------------------------------------------------------------------------
--  THIS FILE IS GENERATED. Do not edit it directly.
--  ---------------------------------------------------------------------------
--  It is the ordered concatenation of database/migrations/001..008, unchanged.
--  Edit the migration you care about, then regenerate. Because it is generated,
--  schema.sql and the migration set cannot drift: they contain byte-identical
--  statements in the same order, which database tooling verifies by comparing
--  the two statement multisets.
--
--  Migrations are for an EXISTING database (apply the ones you have not run
--  yet, in numeric order). schema.sql is for an EMPTY database. Never run both
--  against the same database — you would not corrupt anything (every statement
--  is idempotent), but it is pointless work.
--
--  ---------------------------------------------------------------------------
--  PREREQUISITES
--  ---------------------------------------------------------------------------
--  * PostgreSQL 15+.
--  * The `vector` extension (pgvector >= 0.5 for the HNSW index). On Supabase,
--    enable it under Database -> Extensions, or let 005 CREATE EXTENSION it.
--  * Supabase's auth layer: the `auth` schema, `auth.users`, `auth.uid()`, and
--    the `anon` / `authenticated` / `service_role` roles.
--    On a plain PostgreSQL instance none of that exists, so section 001 below
--    installs a MINIMAL development shim for them. The shim is skipped entirely
--    when the `auth` schema already exists, so it is a no-op on real Supabase.
--    It is a stand-in for local work only — no password hashing, no sessions.
--
--  ---------------------------------------------------------------------------
--  CONTENTS
--  ---------------------------------------------------------------------------
--  001_users          public.users, shared api + auth enums, set_updated_at(),
--                     is_admin() / current_user_role() / is_service_role(),
--                     auth.users -> profile provisioning trigger
--  002_organizations  organizations, organization_members, users.organization_id,
--                     is_org_member() / is_org_manager()
--  003_documents      documents (knowledge-base registry), can_read_document()
--  004_standards      standards + sections / amendments / requirements /
--                     references, certification pathways + stages,
--                     laboratories, testing_requirements
--  005_vectors        pgvector, document_chunks, HNSW cosine index,
--                     match_document_chunks()  <-- the RAG retrieval RPC
--  006_ai             ai_conversations, ai_messages, ai_answers, sources,
--                     citations, related standards, suggested questions,
--                     search_history
--  007_handbook       handbooks (BIS + org), chapters, sections, standards
--                     join, pdf_jobs, can_read_handbook()
--  008_reports        reports + sections + standards join, saved_resources,
--                     trending_topics, whats_new, industry_knowledge,
--                     can_read_report()
--
--  ---------------------------------------------------------------------------
--  ROW LEVEL SECURITY, IN ONE PARAGRAPH
--  ---------------------------------------------------------------------------
--  RLS is enabled on every table. Three regimes:
--    PUBLIC CATALOGUE  standards & children, certification pathways & stages,
--                      laboratories, testing_requirements, published BIS
--                      handbooks, trending_topics, whats_new, public
--                      industry_knowledge -> readable by `anon` and
--                      `authenticated`; writable by admins only.
--    ORG-SCOPED        organizations, organization_members, org documents, org
--                      handbooks, org industry_knowledge, reports,
--                      organization_applicable_standards -> visible only to
--                      members of that organisation, plus admins. Every one of
--                      these routes through public.is_org_member(), the single
--                      gate that makes cross-tenant reads impossible.
--    PER-USER          users, saved_resources, search_history, ai_* , pdf_jobs
--                      -> the owning user only. Admins additionally read the
--                      AI tables and search_history for analytics; they do NOT
--                      read saved_resources.
--  See docs/DATABASE.md for the reasoning behind each policy.
-- =============================================================================




-- #############################################################################
-- #############################################################################
--                       BEGIN 001_users.sql
-- #############################################################################
-- #############################################################################


-- =============================================================================
-- MANAK — 001_users.sql
-- Profiles, shared enums, shared helper functions, updated_at plumbing, RLS.
-- -----------------------------------------------------------------------------
-- Target: PostgreSQL 15 (Supabase).
--
-- Run order matters. This file is first because everything else depends on:
--   * public.set_updated_at()        — the ONE updated_at trigger function,
--                                      reused verbatim by 002..008.
--   * public.is_admin()              — RLS helper (security definer).
--   * public.current_user_role()     — RLS helper (security definer).
--   * public.is_service_role()       — RLS helper.
--   * public.users                   — the profile table every FK points at.
--
-- Naming note: the RLS helper is called `current_user_role()`, NOT
-- `current_role()`. `CURRENT_ROLE` is a *reserved* SQL keyword in PostgreSQL and
-- cannot be used as an unquoted function name, so `public.current_role()` would
-- either fail to parse or force every policy to quote it. Do not "fix" this back.
--
-- Idempotency: safe to re-run. Enums are created inside DO blocks that swallow
-- duplicate_object; tables use `create table if not exists`; triggers and
-- policies are dropped-then-created.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
-- gen_random_uuid() lives in pgcrypto on PG13/14 and in core on PG18+; Supabase
-- pre-installs pgcrypto into the `extensions` schema, so this is a no-op there.
create extension if not exists pgcrypto;


-- -----------------------------------------------------------------------------
-- Supabase compatibility shim (NO-OP on real Supabase)
-- -----------------------------------------------------------------------------
-- MANAK is built for Supabase: `auth.users` and `auth.uid()` are provided by the
-- platform, as are the `anon`, `authenticated` and `service_role` roles. On a
-- plain PostgreSQL 15 instance (local `docker run postgres:15`, CI, a throwaway
-- cluster for a syntax check) none of that exists and every migration below
-- would fail on the very first foreign key.
--
-- The block below creates a MINIMAL stand-in *only when the auth schema is
-- absent*. On Supabase the guard is false and nothing happens. Never rely on the
-- shim in production — it has no password hashing, no sessions, no GoTrue.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'MANAK: auth schema not found — creating local development shim';

    create schema auth;

    create table auth.users (
      instance_id           uuid         default '00000000-0000-0000-0000-000000000000'::uuid,
      id                    uuid         primary key,
      aud                   varchar(255) default 'authenticated',
      role                  varchar(255) default 'authenticated',
      email                 varchar(255) unique,
      encrypted_password    varchar(255),
      email_confirmed_at    timestamptz,
      raw_app_meta_data     jsonb        default '{}'::jsonb,
      raw_user_meta_data    jsonb        default '{}'::jsonb,
      is_super_admin        boolean      default false,
      created_at            timestamptz  default now(),
      updated_at            timestamptz  default now()
    );

    -- Mirrors Supabase's auth.uid(): reads the `sub` claim off the request JWT.
    execute $fn$
      create function auth.uid() returns uuid
      language sql stable
      as $body$
        select nullif(
          coalesce(
            current_setting('request.jwt.claim.sub', true),
            (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
          ),
          ''
        )::uuid;
      $body$;
    $fn$;
  end if;

  -- Supabase's PostgREST roles. Created only if missing.
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- Shared API enums
-- -----------------------------------------------------------------------------
-- These two mirror `shared/types/api.ts` and are used by many later tables, so
-- they live here rather than in a feature migration.

-- shared/types/api.ts :: LanguageCode  (8 locales, order matches SUPPORTED_LANGUAGES)
do $$ begin
  create type public.language_code as enum ('en', 'hi', 'bn', 'ta', 'te', 'mr', 'kn', 'pa');
exception when duplicate_object then null; end $$;

-- shared/types/api.ts :: SortDirection
-- Contract-completeness only: SortDirection is a query-string value, no column
-- stores it. Declared so the TS union and the DB enum set stay 1:1.
do $$ begin
  create type public.sort_direction as enum ('asc', 'desc');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- Auth enums  (shared/types/auth.ts)
-- -----------------------------------------------------------------------------

-- shared/types/auth.ts :: UserRole
do $$ begin
  create type public.user_role as enum ('individual', 'organization', 'admin');
exception when duplicate_object then null; end $$;

-- shared/types/auth.ts :: AccountStatus
do $$ begin
  create type public.account_status as enum ('pending_verification', 'active', 'suspended');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- public.set_updated_at()  — defined ONCE, reused by every later migration
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at = now(). Defined in 001, reused by 002-008.';


-- -----------------------------------------------------------------------------
-- public.users — the profile row for every auth.users record
-- -----------------------------------------------------------------------------
-- Serves shared/types/auth.ts::AuthUser and shared/types/users.ts::UserDetail.
-- `organization_id` is added by 002 (it needs public.organizations to exist).
create table if not exists public.users (
  id                  uuid primary key references auth.users (id) on delete cascade,
  -- Denormalised from auth.users so list/search endpoints never join into auth.
  email               text not null,
  full_name           text not null default '',
  role                public.user_role not null default 'individual',
  status              public.account_status not null default 'pending_verification',
  preferred_language  public.language_code not null default 'en',
  avatar_url          text,
  -- Indian PIN code: 6 digits, never starting with 0. Powers facility discovery.
  pincode             text,
  last_active_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint users_email_key unique (email),
  constraint users_email_format_check check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint users_pincode_format_check check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  constraint users_avatar_url_check check (avatar_url is null or length(avatar_url) <= 2048)
);

comment on table  public.users is 'Application profile, 1:1 with auth.users. Mirrors shared/types/auth.ts::AuthUser.';
comment on column public.users.email is 'Mirror of auth.users.email, kept in sync by the auth trigger.';
comment on column public.users.last_active_at is 'Touched by the backend on authenticated requests; feeds UserSummary.lastActiveAt.';

create index if not exists users_role_idx        on public.users (role);
create index if not exists users_status_idx      on public.users (status);
create index if not exists users_pincode_idx     on public.users (pincode) where pincode is not null;
create index if not exists users_created_at_idx  on public.users (created_at desc);
-- Backs UserListQuery.search (case-insensitive name lookup / prefix search).
create index if not exists users_full_name_lower_idx on public.users (lower(full_name));

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- RLS helper functions  (security definer — see the recursion note)
-- -----------------------------------------------------------------------------
-- A policy ON public.users that reads FROM public.users recurses infinitely.
-- These helpers are `security definer` and owned by the migration runner
-- (`postgres` on Supabase). A table's owner is exempt from RLS unless the table
-- is FORCE ROW LEVEL SECURITY, so the SELECT inside the helper does not
-- re-trigger the policy that called it. That is what breaks the recursion.
-- Do not inline these lookups into policy expressions.

create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  -- PostgREST connects as `service_role` when the service key is used; the
  -- dashboard SQL editor and migrations connect as postgres/supabase_admin.
  select current_user::text = any (array['service_role', 'supabase_admin', 'postgres']);
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.role from public.users u where u.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'::public.user_role
  );
$$;

comment on function public.is_service_role()   is 'True for the Supabase service key / migration connections. Lets pipelines bypass owner-scoped policies.';
comment on function public.current_user_role() is 'Role of the JWT subject. SECURITY DEFINER to avoid RLS recursion on public.users.';
comment on function public.is_admin()          is 'True when the JWT subject is a platform admin. SECURITY DEFINER to avoid RLS recursion on public.users.';


-- -----------------------------------------------------------------------------
-- Auto-provision a profile whenever GoTrue creates an auth user
-- -----------------------------------------------------------------------------
-- The backend passes profile fields through Supabase signUp `options.data`,
-- which GoTrue stores in auth.users.raw_user_meta_data. Recognised keys:
--   full_name | fullName, role, preferred_language | preferredLanguage, pincode
-- Unknown/invalid values fall back to the column defaults rather than failing
-- the signup, because a raised exception here aborts the auth.users insert.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meta            jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full_name     text;
  v_role          public.user_role   := 'individual';
  v_language      public.language_code := 'en';
  v_pincode       text;
begin
  v_full_name := coalesce(
    nullif(meta ->> 'full_name', ''),
    nullif(meta ->> 'fullName', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    ''
  );

  begin
    v_role := coalesce(nullif(meta ->> 'role', ''), 'individual')::public.user_role;
  exception when invalid_text_representation then
    v_role := 'individual';
  end;

  begin
    v_language := coalesce(
      nullif(meta ->> 'preferred_language', ''),
      nullif(meta ->> 'preferredLanguage', ''),
      'en'
    )::public.language_code;
  exception when invalid_text_representation then
    v_language := 'en';
  end;

  v_pincode := nullif(meta ->> 'pincode', '');
  if v_pincode is not null and v_pincode !~ '^[1-9][0-9]{5}$' then
    v_pincode := null;
  end if;

  insert into public.users (id, email, full_name, role, preferred_language, pincode, status)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@placeholder.invalid'),
    v_full_name,
    v_role,
    v_language,
    v_pincode,
    case when new.email_confirmed_at is not null then 'active' else 'pending_verification' end
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(nullif(excluded.full_name, ''), public.users.full_name),
        updated_at = now();

  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'AFTER INSERT ON auth.users: provisions public.users from raw_user_meta_data. Never raises — a failure here would abort signup.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep the denormalised email and confirmation-driven status in sync.
create or replace function public.handle_auth_user_updated()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.users u
     set email = coalesce(new.email, u.email),
         status = case
                    when u.status = 'suspended' then u.status
                    when new.email_confirmed_at is not null and u.status = 'pending_verification'
                      then 'active'::public.account_status
                    else u.status
                  end,
         updated_at = now()
   where u.id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, email_confirmed_at on auth.users
  for each row execute function public.handle_auth_user_updated();


-- -----------------------------------------------------------------------------
-- Privilege-escalation guard
-- -----------------------------------------------------------------------------
-- The self-update policy below cannot restrict *columns*, so a user could PATCH
-- their own row to role='admin'. This trigger silently reverts the privileged
-- columns for non-admin callers (silently, not by raising, so that a client
-- PUTting the whole profile object still succeeds for the fields it may change).
--
-- Consequence for the backend: setting users.role / users.status /
-- users.organization_id must happen through the service-role client or as an
-- admin. The organisation registration endpoint already runs server-side.
create or replace function public.enforce_user_self_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;

  new.role       := old.role;
  new.status     := old.status;
  new.email      := old.email;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists users_enforce_self_update on public.users;
create trigger users_enforce_self_update
  before update on public.users
  for each row execute function public.enforce_user_self_update();


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- Rule: a user sees exactly their own profile; admins see everyone. There is no
-- public read on profiles — the Standards Explorer is anonymous, user data is not.
alter table public.users enable row level security;

drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select to authenticated
  using (id = auth.uid());

drop policy if exists users_select_admin on public.users;
create policy users_select_admin on public.users
  for select to authenticated
  using (public.is_admin());

drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists users_update_admin on public.users;
create policy users_update_admin on public.users
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Deletion is normally driven by auth.users ON DELETE CASCADE; admins may also
-- prune a profile directly.
drop policy if exists users_delete_admin on public.users;
create policy users_delete_admin on public.users
  for delete to authenticated
  using (public.is_admin());


-- -----------------------------------------------------------------------------
-- Grants (PostgREST needs table privileges *and* a passing policy)
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.users to service_role;

grant execute on function public.set_updated_at()        to service_role;
grant execute on function public.is_service_role()       to anon, authenticated, service_role;
grant execute on function public.current_user_role()     to authenticated, service_role;
grant execute on function public.is_admin()              to anon, authenticated, service_role;


-- #############################################################################
-- #############################################################################
--                       BEGIN 002_organizations.sql
-- #############################################################################
-- #############################################################################


-- =============================================================================
-- MANAK — 002_organizations.sql
-- Organisations, membership, and the users.organization_id link.
-- -----------------------------------------------------------------------------
-- Depends on: 001 (public.users, public.set_updated_at, public.is_admin,
--                  public.is_service_role, public.language_code).
--
-- Serves shared/types/users.ts::OrganizationSummary / OrganizationDetail.
--
-- Deliberate omission: the organisation ⇄ standards join table
-- (`organization_applicable_standards`, backing OrganizationDetail.applicableStandardIds)
-- lives in 004_standards.sql, because public.standards does not exist yet and a
-- forward reference would break `psql -f` ordering.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- shared/types/users.ts :: OrganizationVerificationStatus
do $$ begin
  create type public.organization_verification_status as enum
    ('unverified', 'in_review', 'verified', 'rejected');
exception when duplicate_object then null; end $$;

-- shared/types/users.ts :: INDUSTRY_SECTORS / IndustrySector
-- Used by organizations, standards, documents, handbooks, reports and
-- industry_knowledge. Order matches the TS const array exactly.
do $$ begin
  create type public.industry_sector as enum (
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
    'other'
  );
exception when duplicate_object then null; end $$;

-- No TypeScript counterpart yet. MANAK-internal: seat role inside one org, as
-- distinct from the platform-wide public.user_role. Kept deliberately small.
do $$ begin
  create type public.organization_member_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- public.organizations
-- -----------------------------------------------------------------------------
create table if not exists public.organizations (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  sector               public.industry_sector not null default 'other',
  verification_status  public.organization_verification_status not null default 'unverified',
  -- GSTIN or equivalent registry id. Unique platform-wide: one legal entity,
  -- one MANAK organisation.
  registration_number  text not null,
  contact_phone        text,
  contact_email        text,
  address              text,
  pincode              text,
  logo_url             text,
  -- Who registered it. Kept for audit; membership is the authoritative link.
  created_by           uuid references public.users (id) on delete set null,
  verified_at          timestamptz,
  verified_by          uuid references public.users (id) on delete set null,
  -- Free-text note from the reviewer when verification_status = 'rejected'.
  verification_note    text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint organizations_name_check                check (length(btrim(name)) > 0),
  constraint organizations_registration_number_key   unique (registration_number),
  constraint organizations_pincode_format_check      check (pincode is null or pincode ~ '^[1-9][0-9]{5}$'),
  constraint organizations_contact_email_check       check (contact_email is null or contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

comment on table  public.organizations is 'Registered manufacturer/exporter organisations. Mirrors shared/types/users.ts::OrganizationDetail.';
comment on column public.organizations.registration_number is 'GSTIN or equivalent. Unique — enforces one org per legal entity.';
comment on column public.organizations.verification_status is 'Verification against BIS/registry records; only admins may advance it.';

create index if not exists organizations_sector_idx        on public.organizations (sector);
create index if not exists organizations_verification_idx  on public.organizations (verification_status);
create index if not exists organizations_pincode_idx       on public.organizations (pincode) where pincode is not null;
create index if not exists organizations_name_lower_idx    on public.organizations (lower(name));

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.organization_members  (users ⇄ organizations)
-- -----------------------------------------------------------------------------
create table if not exists public.organization_members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references public.users (id) on delete cascade,
  member_role      public.organization_member_role not null default 'member',
  invited_by       uuid references public.users (id) on delete set null,
  joined_at        timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint organization_members_unique unique (organization_id, user_id)
);

comment on table public.organization_members is
  'Seat table. Feeds OrganizationDetail.memberCount and is the source of truth for every org-scoped RLS policy.';

create index if not exists organization_members_user_idx on public.organization_members (user_id);
create index if not exists organization_members_org_idx  on public.organization_members (organization_id);

drop trigger if exists organization_members_set_updated_at on public.organization_members;
create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- users.organization_id
-- -----------------------------------------------------------------------------
-- Denormalised "primary organisation" so AuthUser can be served from one row
-- without a join. organization_members remains authoritative for multi-seat orgs.
alter table public.users
  add column if not exists organization_id uuid;

do $$ begin
  alter table public.users
    add constraint users_organization_id_fkey
    foreign key (organization_id) references public.organizations (id) on delete set null;
exception when duplicate_object then null; end $$;

comment on column public.users.organization_id is
  'Primary organisation (AuthUser.organizationId). Set only when role = ''organization''. Writable by service role/admin only.';

create index if not exists users_organization_id_idx
  on public.users (organization_id) where organization_id is not null;


-- -----------------------------------------------------------------------------
-- Org-scoped RLS helpers  (security definer — break policy recursion)
-- -----------------------------------------------------------------------------
-- THE cross-tenant guarantee of this schema: every org-scoped policy in 003..008
-- routes through public.is_org_member(). One organisation can therefore never
-- read another's private data, because there is exactly one place that decides
-- membership and it is keyed on auth.uid().

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_organization_id is not null
     and (
       exists (
         select 1 from public.organization_members m
         where m.organization_id = p_organization_id
           and m.user_id = auth.uid()
       )
       or exists (
         select 1 from public.users u
         where u.id = auth.uid()
           and u.organization_id = p_organization_id
       )
     );
$$;

-- Membership with write authority inside the org (owner/admin seat).
create or replace function public.is_org_manager(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_organization_id is not null
     and exists (
       select 1 from public.organization_members m
       where m.organization_id = p_organization_id
         and m.user_id = auth.uid()
         and m.member_role in ('owner', 'admin')
     );
$$;

-- Bootstrapping hole-plug: a freshly created organisation has no seats yet, so
-- nobody satisfies is_org_manager() and the first seat could never be inserted
-- under RLS. This narrowly permits the very first seat only.
create or replace function public.organization_is_unclaimed(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.organization_members m
    where m.organization_id = p_organization_id
  );
$$;

comment on function public.is_org_member(uuid)             is 'True when the JWT subject belongs to the given organisation. The single gate for all cross-tenant isolation.';
comment on function public.is_org_manager(uuid)            is 'True when the JWT subject holds an owner/admin seat in the given organisation.';
comment on function public.organization_is_unclaimed(uuid) is 'True when an organisation has zero members — lets the first seat be created under RLS.';


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- Organisations are NOT public. OrganizationSummary is only ever surfaced inside
-- a member's own UserDetail or to an admin.
alter table public.organizations enable row level security;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

drop policy if exists organizations_select_admin on public.organizations;
create policy organizations_select_admin on public.organizations
  for select to authenticated
  using (public.is_admin());

-- Registration: any authenticated user may create an organisation. They then
-- claim it via the first organization_members row.
drop policy if exists organizations_insert_authenticated on public.organizations;
create policy organizations_insert_authenticated on public.organizations
  for insert to authenticated
  with check (auth.uid() is not null);

drop policy if exists organizations_update_manager on public.organizations;
create policy organizations_update_manager on public.organizations
  for update to authenticated
  using (public.is_org_manager(id))
  with check (public.is_org_manager(id));

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists organizations_delete_admin on public.organizations;
create policy organizations_delete_admin on public.organizations
  for delete to authenticated
  using (public.is_admin());

-- verification_status is an admin-only field; members may edit everything else.
-- Same silent-revert approach as public.users (see 001).
create or replace function public.enforce_organization_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_service_role() or public.is_admin() then
    return new;
  end if;
  new.verification_status := old.verification_status;
  new.verified_at         := old.verified_at;
  new.verified_by         := old.verified_by;
  new.verification_note   := old.verification_note;
  new.registration_number := old.registration_number;
  new.created_by          := old.created_by;
  new.created_at          := old.created_at;
  return new;
end;
$$;

drop trigger if exists organizations_enforce_update on public.organizations;
create trigger organizations_enforce_update
  before update on public.organizations
  for each row execute function public.enforce_organization_update();


alter table public.organization_members enable row level security;

drop policy if exists organization_members_select_member on public.organization_members;
create policy organization_members_select_member on public.organization_members
  for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists organization_members_select_admin on public.organization_members;
create policy organization_members_select_admin on public.organization_members
  for select to authenticated
  using (public.is_admin());

drop policy if exists organization_members_insert on public.organization_members;
create policy organization_members_insert on public.organization_members
  for insert to authenticated
  with check (
    public.is_admin()
    or public.is_org_manager(organization_id)
    or (user_id = auth.uid() and public.organization_is_unclaimed(organization_id))
  );

drop policy if exists organization_members_update on public.organization_members;
create policy organization_members_update on public.organization_members
  for update to authenticated
  using (public.is_admin() or public.is_org_manager(organization_id))
  with check (public.is_admin() or public.is_org_manager(organization_id));

-- A member may always resign; managers and admins may remove others.
drop policy if exists organization_members_delete on public.organization_members;
create policy organization_members_delete on public.organization_members
  for delete to authenticated
  using (
    public.is_admin()
    or public.is_org_manager(organization_id)
    or user_id = auth.uid()
  );


-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.organizations        to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update, delete on public.organizations        to service_role;
grant select, insert, update, delete on public.organization_members to service_role;

grant execute on function public.is_org_member(uuid)             to anon, authenticated, service_role;
grant execute on function public.is_org_manager(uuid)            to authenticated, service_role;
grant execute on function public.organization_is_unclaimed(uuid) to authenticated, service_role;


-- #############################################################################
-- #############################################################################
--                       BEGIN 003_documents.sql
-- #############################################################################
-- #############################################################################


-- =============================================================================
-- MANAK — 003_documents.sql
-- The knowledge-base document registry that RAG ingestion writes into.
-- -----------------------------------------------------------------------------
-- Depends on: 001 (public.users, set_updated_at, language_code, is_admin,
--                  is_service_role)
--             002 (public.organizations, public.industry_sector, is_org_member)
--
-- Serves shared/types/ai.ts::RAGIngestRequest / RAGIngestResponse and supplies
-- the document-level metadata that AISource surfaces on every SourceCard.
--
-- One row here == one source document. The chunks and embeddings derived from it
-- live in 005_vectors.sql (public.document_chunks).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- shared/types/ai.ts :: KnowledgeDocumentType
do $$ begin
  create type public.knowledge_document_type as enum (
    'standard',
    'handbook',
    'technical_document',
    'certification_guide',
    'testing_requirement',
    'organization_knowledge',
    'regulatory_reference'
  );
exception when duplicate_object then null; end $$;

-- shared/types/ai.ts :: IngestionStatus
-- Pipeline order: queued -> parsing -> chunking -> embedding -> indexed,
-- with 'failed' reachable from any stage.
do $$ begin
  create type public.ingestion_status as enum (
    'queued',
    'parsing',
    'chunking',
    'embedding',
    'indexed',
    'failed'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- public.documents
-- -----------------------------------------------------------------------------
create table if not exists public.documents (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  document_type     public.knowledge_document_type not null,
  -- Storage path or URL the RAG service can read (RAGIngestRequest.sourceUri).
  -- e.g. 'storage://manak-documents/standards/is-1234-2021.pdf'
  source_uri        text not null,
  -- Set when document_type = 'standard'; denormalised so a chunk can render
  -- "IS 1234:2021" without joining public.standards.
  standard_number   text,
  sector            public.industry_sector,
  language          public.language_code not null default 'en',
  page_count        integer,

  -- Ingestion state machine, owned by the RAG service.
  ingestion_status  public.ingestion_status not null default 'queued',
  chunk_count       integer not null default 0,
  -- Populated when ingestion_status = 'failed' (RAGIngestResponse.error).
  error             text,
  indexed_at        timestamptz,

  uploaded_by       uuid references public.users (id) on delete set null,
  -- NULL  => platform-wide knowledge, readable by every authenticated user.
  -- Set    => private organisation knowledge, readable only by that org.
  --           Always set for document_type = 'organization_knowledge'.
  organization_id   uuid references public.organizations (id) on delete cascade,

  -- Free-form extraction metadata (parser version, checksum, committee, …).
  -- Copied onto each chunk's metadata at chunk time by the ingestion pipeline.
  metadata          jsonb not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint documents_title_check       check (length(btrim(title)) > 0),
  constraint documents_source_uri_check  check (length(btrim(source_uri)) > 0),
  constraint documents_page_count_check  check (page_count is null or page_count >= 0),
  constraint documents_chunk_count_check check (chunk_count >= 0),
  -- Honest state machine: an error string only makes sense on failure, and
  -- 'indexed' must not carry one.
  constraint documents_error_state_check check (
    (ingestion_status = 'failed' and error is not null)
    or (ingestion_status <> 'failed' and error is null)
  ),
  constraint documents_org_knowledge_check check (
    document_type <> 'organization_knowledge' or organization_id is not null
  )
);

comment on table  public.documents is 'Knowledge-base document registry. One row per ingested source document; chunks live in public.document_chunks.';
comment on column public.documents.organization_id is 'NULL = platform-wide corpus. Non-NULL = private org knowledge; enforced by RLS and by match_document_chunks().';
comment on column public.documents.chunk_count is 'Maintained by the RAG pipeline (RAGIngestResponse.chunkCount). Not a trigger-maintained counter.';
comment on column public.documents.metadata is 'Extraction metadata. Propagated into document_chunks.metadata so retrieval filters need no join.';

create index if not exists documents_type_idx        on public.documents (document_type);
create index if not exists documents_status_idx      on public.documents (ingestion_status);
create index if not exists documents_sector_idx      on public.documents (sector) where sector is not null;
create index if not exists documents_language_idx    on public.documents (language);
create index if not exists documents_created_at_idx  on public.documents (created_at desc);
create index if not exists documents_uploaded_by_idx on public.documents (uploaded_by) where uploaded_by is not null;
create index if not exists documents_org_idx         on public.documents (organization_id) where organization_id is not null;
create index if not exists documents_standard_number_idx
  on public.documents (standard_number) where standard_number is not null;
-- Pending-work queue scan for the ingestion worker.
create index if not exists documents_pending_idx
  on public.documents (created_at)
  where ingestion_status in ('queued', 'parsing', 'chunking', 'embedding');
create index if not exists documents_metadata_gin_idx on public.documents using gin (metadata);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- Stamp indexed_at exactly when the document reaches 'indexed'.
create or replace function public.documents_stamp_indexed_at()
returns trigger
language plpgsql
as $$
begin
  if new.ingestion_status = 'indexed'
     and (old.ingestion_status is distinct from 'indexed')
     and new.indexed_at is null then
    new.indexed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists documents_stamp_indexed_at on public.documents;
create trigger documents_stamp_indexed_at
  before update on public.documents
  for each row execute function public.documents_stamp_indexed_at();


-- -----------------------------------------------------------------------------
-- Readability helper (shared with public.document_chunks in 005)
-- -----------------------------------------------------------------------------
-- Kept as a security-definer function so the chunk policy does not have to
-- re-implement the org-scoping rule, and so match_document_chunks() can apply
-- exactly the same test inside a SECURITY DEFINER body.
create or replace function public.can_read_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.documents d
    where d.id = p_document_id
      and (
        public.is_service_role()
        or public.is_admin()
        or d.organization_id is null
        or public.is_org_member(d.organization_id)
      )
  );
$$;

comment on function public.can_read_document(uuid) is
  'Single definition of "may this caller see this document". Used by document_chunks RLS and by match_document_chunks().';


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- Reads: any signed-in user may read the platform corpus (it is the substrate of
--        every grounded answer); private org documents are member-only.
--        Anonymous visitors get the curated public tables (standards, handbooks,
--        laboratories) — not the raw document registry.
-- Writes: admin or service role only. Ingestion runs with the service key.
alter table public.documents enable row level security;

drop policy if exists documents_select_platform on public.documents;
create policy documents_select_platform on public.documents
  for select to authenticated
  using (organization_id is null);

drop policy if exists documents_select_org on public.documents;
create policy documents_select_org on public.documents
  for select to authenticated
  using (organization_id is not null and public.is_org_member(organization_id));

drop policy if exists documents_select_admin on public.documents;
create policy documents_select_admin on public.documents
  for select to authenticated
  using (public.is_admin());

-- Org managers may upload their own private knowledge; everything else is admin.
drop policy if exists documents_insert_admin on public.documents;
create policy documents_insert_admin on public.documents
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists documents_insert_org_manager on public.documents;
create policy documents_insert_org_manager on public.documents
  for insert to authenticated
  with check (
    document_type = 'organization_knowledge'
    and organization_id is not null
    and public.is_org_manager(organization_id)
  );

drop policy if exists documents_update_admin on public.documents;
create policy documents_update_admin on public.documents
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists documents_delete_admin on public.documents;
create policy documents_delete_admin on public.documents
  for delete to authenticated
  using (public.is_admin());

drop policy if exists documents_delete_org_manager on public.documents;
create policy documents_delete_org_manager on public.documents
  for delete to authenticated
  using (organization_id is not null and public.is_org_manager(organization_id));


-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.documents to service_role;

grant execute on function public.can_read_document(uuid) to authenticated, service_role;


-- #############################################################################
-- #############################################################################
--                       BEGIN 004_standards.sql
-- #############################################################################
-- #############################################################################


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


-- #############################################################################
-- #############################################################################
--                       BEGIN 005_vectors.sql
-- #############################################################################
-- #############################################################################


-- =============================================================================
-- MANAK — 005_vectors.sql
-- pgvector storage and the retrieval entry point for the RAG service.
-- -----------------------------------------------------------------------------
-- Depends on: 001 (language_code, is_admin, is_service_role, set_updated_at)
--             002 (is_org_member)
--             003 (public.documents, knowledge_document_type, can_read_document)
--
--
-- ############################################################################
-- ##  CONTRACT FOR THE RAG SERVICE — read this before writing retrieval code ##
-- ############################################################################
--
-- Embedding model : OpenAI `text-embedding-3-small`
-- Dimensions      : 1536  -> column type `vector(1536)`
-- Distance metric : COSINE. Index opclass `vector_cosine_ops`, operator `<=>`.
--                   `<=>` returns cosine DISTANCE (0 = identical, 2 = opposite).
--                   similarity = 1 - (a <=> b)   -- this is what we return.
--
-- Retrieval RPC (call via Supabase `rpc('match_document_chunks', {...})`):
--
--   public.match_document_chunks(
--     query_embedding vector(1536),          -- REQUIRED. 1536 floats.
--     match_count     int        default 6,  -- = DEFAULT_TOP_K   (shared/types/ai.ts)
--     min_score       float      default 0.35, -- = MIN_RELEVANCE_SCORE (shared/types/ai.ts)
--     filter_types    text[]     default null, -- KnowledgeDocumentType values; null/[] = no filter
--     filter_sector   text       default null  -- IndustrySector value;         null/'' = no filter
--   )
--
-- Argument NAMES are part of the contract — Supabase RPC passes them by name.
-- Do not rename them, do not reorder them, do not add a required parameter.
--
-- Returned columns (one row per matching chunk, ordered by DESCENDING similarity):
--
--   id               uuid      -- document_chunks.id      -> AISource.id
--   document_id      uuid      -- documents.id            -> AISource.documentId
--   document_title   text      -- documents.title         -> AISource.documentTitle
--   document_type    text      -- KnowledgeDocumentType   -> AISource.documentType
--   standard_number  text      -- e.g. 'IS 1234:2021'     -> AISource.standardNumber (nullable)
--   section          text      -- section/clause heading  -> AISource.section        (nullable)
--   clause           text      -- clause number, e.g. '4.2.1'   (extra; no AISource field)
--   page_number      int       -- 1-based page            -> AISource.pageNumber     (nullable)
--   content          text      -- cleaned chunk text      -> AISource.excerpt
--   chunk_index      int       -- position within document (extra; useful for stitching)
--   token_count      int       -- tokens in `content`     (extra; budget accounting)
--   language         text      -- LanguageCode of the document
--   sector           text      -- IndustrySector of the document (nullable)
--   metadata         jsonb     -- chunk metadata
--   url              text      -- deep link / download    -> AISource.url            (nullable)
--   published_date   date      -- standard publication    -> AISource.publishedDate  (nullable)
--   similarity       float     -- 1 - cosine_distance     -> AISource.relevanceScore
--
-- `document_type`, `language` and `sector` come back as TEXT, not as enums, so
-- the Python/Node client does not need enum codecs. Cast on the way in
-- (filter_types is text[]), read as strings on the way out.
--
-- TENANCY: the function is SECURITY DEFINER and applies the same organisation
-- scoping as the RLS policies below. A caller only ever sees chunks from
-- platform documents (documents.organization_id IS NULL) plus documents owned by
-- an organisation they belong to. One organisation cannot retrieve another's
-- private knowledge through this RPC. The service key bypasses the scoping (it
-- is the ingestion/eval identity); a user JWT does not.
--
-- !! REQUIRED FINAL INGESTION STEP !!
-- The RPC only returns chunks whose parent document has
-- `documents.ingestion_status = 'indexed'`. Inserting chunks and embeddings is
-- NOT enough — if the pipeline leaves the document on 'embedding', retrieval
-- silently returns zero rows and every answer degrades to
-- `answerable: false / no_relevant_documents`. Finish ingestion with:
--     update public.documents
--        set ingestion_status = 'indexed', chunk_count = <n>, error = null
--      where id = <document_id>;
-- (`indexed_at` is stamped automatically by a trigger in 003.)
--
-- OVER-FILTERING: an approximate (HNSW) index walks its candidate list *before*
-- the WHERE clause is applied, so a narrow filter_types/filter_sector can return
-- fewer than match_count rows even when more exist. When filtering hard, either
-- over-fetch (match_count * 4) or raise `hnsw.ef_search` for the session:
--     set local hnsw.ef_search = 100;
-- ############################################################################
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extension
-- -----------------------------------------------------------------------------
-- Supabase: enable `vector` from Database -> Extensions, or leave this to run.
-- HNSW requires pgvector >= 0.5.0 (Supabase ships >= 0.7).
create extension if not exists vector;


-- -----------------------------------------------------------------------------
-- public.document_chunks
-- -----------------------------------------------------------------------------
create table if not exists public.document_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents (id) on delete cascade,
  -- 0-based position within the parent document. Ingestion is idempotent on
  -- (document_id, chunk_index): re-running upserts rather than duplicating.
  chunk_index  integer not null,
  -- Cleaned, display-safe text. Becomes AISource.excerpt verbatim.
  content      text not null,
  -- Tokens in `content` per the embedding model's tokeniser (cl100k_base).
  token_count  integer,
  -- Human-readable section/clause heading this chunk was cut from.
  section      text,
  -- Structured clause number when the source is clause-structured, e.g. '4.2.1'.
  clause       text,
  page_number  integer,
  -- Copied from documents.metadata and extended per chunk. Filterable via GIN.
  metadata     jsonb not null default '{}'::jsonb,
  -- NULL until the embedding stage completes. `indexed` documents must have all
  -- chunk embeddings populated.
  embedding    vector(1536),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint document_chunks_document_chunk_key unique (document_id, chunk_index),
  constraint document_chunks_chunk_index_check  check (chunk_index >= 0),
  constraint document_chunks_content_check      check (length(btrim(content)) > 0),
  constraint document_chunks_token_count_check  check (token_count is null or token_count >= 0),
  constraint document_chunks_page_number_check  check (page_number is null or page_number >= 1)
);

comment on table  public.document_chunks is 'Embedded slices of public.documents. The retrieval substrate for every grounded MANAK answer.';
comment on column public.document_chunks.embedding is 'text-embedding-3-small, 1536 dims, cosine distance. NULL until the embedding stage runs.';
comment on column public.document_chunks.content is 'Cleaned chunk text. Surfaced directly to users as AISource.excerpt — must be display-safe.';
comment on column public.document_chunks.metadata is 'Per-chunk filterable metadata. Suggested keys: parser, chunker, heading_path, is_table, source_page_label.';

create index if not exists document_chunks_document_idx
  on public.document_chunks (document_id, chunk_index);
create index if not exists document_chunks_page_idx
  on public.document_chunks (document_id, page_number) where page_number is not null;
-- Ingestion worker: which chunks still need embedding?
create index if not exists document_chunks_pending_embedding_idx
  on public.document_chunks (document_id) where embedding is null;

-- Metadata filtering (jsonb containment / path ops).
create index if not exists document_chunks_metadata_gin_idx
  on public.document_chunks using gin (metadata);

-- Lexical half of hybrid retrieval. Cheap to maintain and lets the RAG service
-- blend BM25-ish keyword hits with vector hits for exact clause lookups such as
-- "clause 4.2.1" that embeddings handle poorly.
create index if not exists document_chunks_content_fts_idx
  on public.document_chunks using gin (to_tsvector('english', content));

-- -----------------------------------------------------------------------------
-- Vector index (cosine)
-- -----------------------------------------------------------------------------
-- HNSW: better recall/latency than IVFFlat and, crucially, needs no training
-- data — it can be built on an empty table before ingestion runs. IVFFlat built
-- on an empty table produces a useless single-list index.
--   m              = 16  (graph degree; pgvector default)
--   ef_construction= 64  (build-time candidate list; pgvector default)
-- 1536 dims is comfortably under pgvector's 2000-dimension index ceiling.
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- IVFFlat alternative — only if HNSW is unavailable (pgvector < 0.5). Must be
-- (re)built AFTER data is loaded, with lists ~= rows/1000.
-- create index if not exists document_chunks_embedding_ivfflat_idx
--   on public.document_chunks
--   using ivfflat (embedding vector_cosine_ops)
--   with (lists = 100);

-- Performance note (intentionally NOT applied): pgvector suggests
-- `alter table public.document_chunks alter column embedding set storage plain`
-- to keep vectors out of TOAST. With a 1536-dim vector (6152 bytes) alongside
-- `content` in the same tuple this risks "row is too big" on wide chunks, so the
-- default EXTENDED storage is kept. Revisit only if index build time hurts.

drop trigger if exists document_chunks_set_updated_at on public.document_chunks;
create trigger document_chunks_set_updated_at
  before update on public.document_chunks
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.match_document_chunks — THE retrieval RPC
-- -----------------------------------------------------------------------------
-- Written in `language sql` rather than plpgsql on purpose: in plpgsql the
-- RETURNS TABLE column names become variables and collide with the identically
-- named table columns (`id`, `document_id`, `content`, ...), which raises
-- "column reference is ambiguous" at runtime. In an SQL-language body they are
-- plain output labels. Every column reference below is table-qualified so no
-- name can be ambiguous with a parameter either.
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count     integer default 6,
  min_score       double precision default 0.35,
  filter_types    text[] default null,
  filter_sector   text default null
)
returns table (
  id              uuid,
  document_id     uuid,
  document_title  text,
  document_type   text,
  standard_number text,
  section         text,
  clause          text,
  page_number     integer,
  content         text,
  chunk_index     integer,
  token_count     integer,
  language        text,
  sector          text,
  metadata        jsonb,
  url             text,
  published_date  date,
  similarity      double precision
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with ranked as (
    select
      dc.id                                                 as chunk_id,
      dc.document_id                                        as doc_id,
      dc.content                                            as chunk_content,
      dc.chunk_index                                        as chunk_position,
      dc.token_count                                        as chunk_tokens,
      dc.section                                            as chunk_section,
      dc.clause                                             as chunk_clause,
      dc.page_number                                        as chunk_page,
      dc.metadata                                           as chunk_metadata,
      (1.0::double precision - (dc.embedding <=> query_embedding)) as chunk_similarity
    from public.document_chunks dc
    join public.documents d on d.id = dc.document_id
    where dc.embedding is not null
      -- Only fully ingested documents are retrievable. A half-embedded document
      -- would produce partial, misleading grounding.
      --   *** RAG SERVICE: set documents.ingestion_status = 'indexed' as the
      --   *** final ingestion step. Until you do, this RPC returns ZERO rows
      --   *** even though the chunks and embeddings exist.
      and d.ingestion_status = 'indexed'
      -- Tenancy. is_service_role()/is_admin() take no arguments and are STABLE,
      -- so the planner evaluates them once; the org-id subquery is uncorrelated
      -- and becomes a single hashed subplan. Neither is per-row work, and
      -- document_chunks stays a plain two-table join so the HNSW index on
      -- `embedding` remains usable for the ORDER BY ... LIMIT below.
      and (
        public.is_service_role()
        or public.is_admin()
        or d.organization_id is null
        or d.organization_id in (
          select m.organization_id
          from public.organization_members m
          where m.user_id = auth.uid()
          union
          select u.organization_id
          from public.users u
          where u.id = auth.uid() and u.organization_id is not null
        )
      )
      -- filter_types: null or empty array means "no filter".
      and (
        filter_types is null
        or cardinality(filter_types) = 0
        or d.document_type::text = any (filter_types)
      )
      -- filter_sector: null or '' means "no filter".
      and (
        filter_sector is null
        or btrim(filter_sector) = ''
        or d.sector::text = filter_sector
      )
      and (1.0::double precision - (dc.embedding <=> query_embedding))
            >= coalesce(min_score, 0.0::double precision)
    order by dc.embedding <=> query_embedding
    limit greatest(coalesce(match_count, 6), 1)
  )
  select
    r.chunk_id,
    r.doc_id,
    d.title,
    d.document_type::text,
    -- Prefer the linked standard's canonical designation, fall back to the
    -- denormalised copy on the document.
    coalesce(s.standard_number, d.standard_number),
    r.chunk_section,
    r.chunk_clause,
    r.chunk_page,
    r.chunk_content,
    r.chunk_position,
    r.chunk_tokens,
    d.language::text,
    d.sector::text,
    r.chunk_metadata,
    coalesce(s.document_url, d.source_uri),
    s.published_date,
    r.chunk_similarity
  from ranked r
  join public.documents d on d.id = r.doc_id
  -- Joined after LIMIT so this only ever touches `match_count` rows.
  left join public.standards s on s.document_id = d.id
  order by r.chunk_similarity desc;
$$;

comment on function public.match_document_chunks(vector, integer, double precision, text[], text) is
  'RAG retrieval RPC. Cosine similarity over document_chunks.embedding (text-embedding-3-small, 1536d). Returns AISource-shaped rows ordered by descending similarity. Applies organisation tenancy scoping — see 005_vectors.sql header for the full contract.';


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- Reads mirror public.documents exactly (platform corpus for any signed-in user,
-- private org corpus for that org's members, everything for admins).
-- Writes are admin-or-service-role only: chunks and embeddings are produced by
-- the ingestion pipeline, never by a browser.
alter table public.document_chunks enable row level security;

drop policy if exists document_chunks_select_readable on public.document_chunks;
create policy document_chunks_select_readable on public.document_chunks
  for select to authenticated
  using (public.can_read_document(document_id));

-- No insert/update/delete policy is defined for `authenticated` on purpose.
-- With RLS on and no permissive policy for a command, that command is denied for
-- every non-bypassing role. The service_role key has BYPASSRLS, so the
-- ingestion pipeline writes freely; admins go through the service role too.
drop policy if exists document_chunks_insert_admin on public.document_chunks;
create policy document_chunks_insert_admin on public.document_chunks
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists document_chunks_update_admin on public.document_chunks;
create policy document_chunks_update_admin on public.document_chunks
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists document_chunks_delete_admin on public.document_chunks;
create policy document_chunks_delete_admin on public.document_chunks
  for delete to authenticated
  using (public.is_admin());


-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.document_chunks to authenticated;
grant select, insert, update, delete on public.document_chunks to service_role;

-- Not granted to `anon`: retrieval requires a signed-in user. If a public demo
-- of Ask-AI is ever wanted, add `anon` here — the function already scopes
-- tenancy correctly for an anonymous caller (it sees the platform corpus only).
grant execute on function public.match_document_chunks(vector, integer, double precision, text[], text)
  to authenticated, service_role;


-- #############################################################################
-- #############################################################################
--                       BEGIN 006_ai.sql
-- #############################################################################
-- #############################################################################


-- =============================================================================
-- MANAK — 006_ai.sql
-- Conversations, messages, grounded answers, sources, citations, search history.
-- -----------------------------------------------------------------------------
-- Depends on: 001 (users, language_code, set_updated_at, is_admin)
--             002 (industry_sector)
--             003 (documents, knowledge_document_type)
--             004 (standards, related_standard_relation)
--             005 (document_chunks)
--
-- Serves shared/types/ai.ts::AIAnswer in full — answer, sources, citations,
-- confidence, relatedStandards, suggestedQuestions, insufficientKnowledge — plus
-- shared/types/reports.ts::SearchHistoryEntry.
--
-- The non-negotiable product rule is encoded as a CHECK constraint here:
-- `answerable = false` REQUIRES an insufficient_reason, and `answerable = true`
-- FORBIDS one. The database will not store a fabricated-but-unsupported answer
-- that pretends to be grounded.
--
-- Everything in this file is PER-USER data. Nothing is publicly readable.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- shared/types/ai.ts :: AIMessageRole
do $$ begin
  create type public.ai_message_role as enum ('user', 'assistant');
exception when duplicate_object then null; end $$;

-- shared/types/ai.ts :: ConfidenceLevel
-- Thresholds live in code (CONFIDENCE_THRESHOLDS: high 0.75, medium 0.5) so the
-- badge and the scorer cannot drift; the DB stores the derived level verbatim.
do $$ begin
  create type public.confidence_level as enum ('high', 'medium', 'low');
exception when duplicate_object then null; end $$;

-- shared/types/ai.ts :: InsufficientKnowledge.reason
do $$ begin
  create type public.insufficient_knowledge_reason as enum
    ('no_relevant_documents', 'low_relevance', 'out_of_scope');
exception when duplicate_object then null; end $$;

-- shared/types/reports.ts :: SearchHistoryEntry.surface
do $$ begin
  create type public.search_surface as enum ('standards', 'handbook', 'ai', 'facility');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- public.ai_conversations  (AIConversation / AIConversationSummary)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  -- Derived from the first user message by the backend; never null in the UI.
  title         text not null default 'New conversation',
  language      public.language_code not null default 'en',
  -- Denormalised counters so the conversation list needs no aggregate query.
  -- Maintained by the trigger below, not by the application.
  message_count integer not null default 0,
  last_message_preview text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint ai_conversations_message_count_check check (message_count >= 0)
);

comment on table  public.ai_conversations is 'One Ask-MANAK thread. Mirrors shared/types/ai.ts::AIConversation.';
comment on column public.ai_conversations.message_count is 'Trigger-maintained (see ai_messages_touch_conversation). Feeds AIConversationSummary.messageCount.';

create index if not exists ai_conversations_user_idx
  on public.ai_conversations (user_id, updated_at desc);

drop trigger if exists ai_conversations_set_updated_at on public.ai_conversations;
create trigger ai_conversations_set_updated_at
  before update on public.ai_conversations
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- public.ai_messages  (AIMessage)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  -- Denormalised from the conversation so the RLS policy is a plain equality
  -- test instead of a subquery on every row read.
  user_id         uuid not null references public.users (id) on delete cascade,
  role            public.ai_message_role not null,
  content         text not null,
  language        public.language_code not null default 'en',
  -- Optional explicit ordering. Left nullable so the backend is not forced to
  -- compute sequence numbers; (conversation_id, created_at, ordinal) is the
  -- stable sort the API should use.
  ordinal         integer,
  created_at      timestamptz not null default now(),

  constraint ai_messages_content_check check (length(btrim(content)) > 0),
  constraint ai_messages_ordinal_check check (ordinal is null or ordinal >= 0)
);

comment on column public.ai_messages.user_id is 'Denormalised owner. Keeps the per-user RLS policy subquery-free; must equal ai_conversations.user_id.';

create index if not exists ai_messages_conversation_idx
  on public.ai_messages (conversation_id, created_at, ordinal);
create index if not exists ai_messages_user_idx on public.ai_messages (user_id, created_at desc);

-- Keep the denormalised owner honest, and keep the conversation counters current.
create or replace function public.ai_messages_touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  select c.user_id into v_owner
    from public.ai_conversations c
   where c.id = new.conversation_id;

  if v_owner is null then
    raise exception 'ai_messages.conversation_id % does not exist', new.conversation_id
      using errcode = 'foreign_key_violation';
  end if;

  -- The message owner is always the conversation owner. Silently corrected so a
  -- client cannot attach a message to someone else's thread.
  new.user_id := v_owner;

  update public.ai_conversations c
     set message_count = c.message_count + 1,
         last_message_preview = left(new.content, 280),
         updated_at = now()
   where c.id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists ai_messages_touch_conversation on public.ai_messages;
create trigger ai_messages_touch_conversation
  before insert on public.ai_messages
  for each row execute function public.ai_messages_touch_conversation();


-- -----------------------------------------------------------------------------
-- public.ai_answers  (AIAnswer — the grounded payload)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_answers (
  id                     uuid primary key default gen_random_uuid(),
  -- 1:1 with the assistant message that carries it.
  message_id             uuid not null references public.ai_messages (id) on delete cascade,
  conversation_id        uuid not null references public.ai_conversations (id) on delete cascade,
  user_id                uuid not null references public.users (id) on delete cascade,

  -- Echo of the question, post-normalisation (AIAnswer.question).
  question               text not null,
  answerable             boolean not null default true,
  answer                 text not null,

  -- AIConfidence. score is 0..1; level is the bucketed form the badge renders.
  confidence_score       double precision not null default 0,
  confidence_level       public.confidence_level not null default 'low',
  confidence_rationale   text not null default '',

  -- InsufficientKnowledge, flattened. All three are NULL when answerable.
  insufficient_reason      public.insufficient_knowledge_reason,
  insufficient_message     text,
  insufficient_suggestions text[] not null default '{}'::text[],

  language               public.language_code not null default 'en',
  -- End-to-end pipeline time (AIAnswer.durationMs), shown in admin AI analytics.
  duration_ms            integer,
  -- Operational provenance for evaluating regressions. Not part of AIAnswer.
  model                  text,
  retrieved_chunk_count  integer,
  created_at             timestamptz not null default now(),

  constraint ai_answers_message_key           unique (message_id),
  constraint ai_answers_confidence_score_check check (confidence_score >= 0 and confidence_score <= 1),
  constraint ai_answers_duration_check         check (duration_ms is null or duration_ms >= 0),
  constraint ai_answers_chunk_count_check      check (retrieved_chunk_count is null or retrieved_chunk_count >= 0),
  -- THE grounding invariant. See shared/types/ai.ts: "it never fabricates a
  -- standards citation". An unanswerable answer must say why; an answerable one
  -- must not carry a refusal reason.
  constraint ai_answers_insufficient_check check (
    (answerable is true  and insufficient_reason is null and insufficient_message is null)
    or
    (answerable is false and insufficient_reason is not null)
  )
);

comment on table  public.ai_answers is 'Grounded answer payload, 1:1 with an assistant ai_messages row. Mirrors shared/types/ai.ts::AIAnswer.';
comment on constraint ai_answers_insufficient_check on public.ai_answers is
  'Enforces the MANAK grounding rule: answerable=false requires an insufficient_reason, answerable=true forbids one.';

create index if not exists ai_answers_conversation_idx on public.ai_answers (conversation_id, created_at desc);
create index if not exists ai_answers_user_idx         on public.ai_answers (user_id, created_at desc);
-- Admin AI analytics: confidence distribution and refusal rate over time.
create index if not exists ai_answers_analytics_idx    on public.ai_answers (created_at desc, confidence_level, answerable);


-- -----------------------------------------------------------------------------
-- public.ai_answer_sources  (AIAnswer.sources / AISource)
-- -----------------------------------------------------------------------------
-- Snapshot semantics: excerpt/document_title are COPIED, not joined, so an
-- answer keeps rendering its SourceCards intact even after the underlying
-- document is re-ingested or withdrawn. The FKs are ON DELETE SET NULL for the
-- same reason.
create table if not exists public.ai_answer_sources (
  id               uuid primary key default gen_random_uuid(),
  answer_id        uuid not null references public.ai_answers (id) on delete cascade,
  chunk_id         uuid references public.document_chunks (id) on delete set null,
  document_id      uuid references public.documents (id) on delete set null,

  -- Snapshot of what the user was actually shown.
  document_title   text not null default '',
  document_type    public.knowledge_document_type,
  standard_number  text,
  section          text,
  page_number      integer,
  excerpt          text not null default '',
  url              text,
  published_date   date,

  -- Cosine similarity mapped to 0..1 (AISource.relevanceScore).
  relevance_score  double precision not null default 0,
  -- 0-based rank in the source list; drives the [1], [2] markers.
  ordinal          integer not null,
  created_at       timestamptz not null default now(),

  constraint ai_answer_sources_ordinal_key    unique (answer_id, ordinal),
  constraint ai_answer_sources_ordinal_check  check (ordinal >= 0),
  constraint ai_answer_sources_score_check    check (relevance_score >= 0 and relevance_score <= 1),
  constraint ai_answer_sources_page_check     check (page_number is null or page_number >= 1)
);

comment on table public.ai_answer_sources is
  'Retrieved chunks backing one answer. Text is snapshotted so historical answers stay renderable after re-ingestion.';

create index if not exists ai_answer_sources_answer_idx   on public.ai_answer_sources (answer_id, ordinal);
create index if not exists ai_answer_sources_chunk_idx    on public.ai_answer_sources (chunk_id) where chunk_id is not null;
create index if not exists ai_answer_sources_document_idx on public.ai_answer_sources (document_id) where document_id is not null;


-- -----------------------------------------------------------------------------
-- public.ai_citations  (AIAnswer.citations / AICitation)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_citations (
  id           uuid primary key default gen_random_uuid(),
  answer_id    uuid not null references public.ai_answers (id) on delete cascade,
  -- 1-based marker rendered inline in the answer, e.g. [1].
  marker       integer not null,
  -- AICitation.sourceId — points at ai_answer_sources.id, NOT at a chunk.
  source_id    uuid not null references public.ai_answer_sources (id) on delete cascade,
  -- Character offsets into ai_answers.answer.
  start_offset integer not null,
  end_offset   integer not null,
  -- The exact sentence/claim being attributed.
  claim        text not null default '',
  created_at   timestamptz not null default now(),

  constraint ai_citations_marker_key    unique (answer_id, marker),
  constraint ai_citations_marker_check  check (marker >= 1),
  constraint ai_citations_offset_check  check (start_offset >= 0 and end_offset >= start_offset)
);

comment on column public.ai_citations.source_id is
  'FK to ai_answer_sources.id (the snapshot), matching AICitation.sourceId which refers to AISource.id.';

create index if not exists ai_citations_answer_idx on public.ai_citations (answer_id, marker);
create index if not exists ai_citations_source_idx on public.ai_citations (source_id);


-- -----------------------------------------------------------------------------
-- public.ai_answer_related_standards  (AIAnswer.relatedStandards)
-- -----------------------------------------------------------------------------
create table if not exists public.ai_answer_related_standards (
  answer_id   uuid not null references public.ai_answers (id) on delete cascade,
  standard_id uuid not null references public.standards (id) on delete cascade,
  relation    public.related_standard_relation not null default 'similar_scope',
  ordinal     integer not null default 0,

  constraint ai_answer_related_standards_pkey primary key (answer_id, standard_id)
);

create index if not exists ai_answer_related_standards_standard_idx
  on public.ai_answer_related_standards (standard_id);


-- -----------------------------------------------------------------------------
-- public.ai_suggested_questions  (AIAnswer.suggestedQuestions)
-- -----------------------------------------------------------------------------
-- A table rather than a text[] column because SuggestedQuestion carries an `id`
-- the frontend uses as a React key and as a click-through payload.
create table if not exists public.ai_suggested_questions (
  id         uuid primary key default gen_random_uuid(),
  answer_id  uuid not null references public.ai_answers (id) on delete cascade,
  question   text not null,
  ordinal    integer not null default 0,

  constraint ai_suggested_questions_ordinal_key   unique (answer_id, ordinal),
  constraint ai_suggested_questions_question_check check (length(btrim(question)) > 0)
);

create index if not exists ai_suggested_questions_answer_idx
  on public.ai_suggested_questions (answer_id, ordinal);


-- -----------------------------------------------------------------------------
-- public.search_history  (SearchHistoryEntry)
-- -----------------------------------------------------------------------------
create table if not exists public.search_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  query        text not null,
  surface      public.search_surface not null,
  result_count integer not null default 0,
  -- Context captured at search time; feeds trending-topic aggregation.
  sector       public.industry_sector,
  language     public.language_code not null default 'en',
  searched_at  timestamptz not null default now(),

  constraint search_history_query_check        check (length(btrim(query)) > 0),
  constraint search_history_result_count_check check (result_count >= 0)
);

comment on table public.search_history is
  'Per-user query log. Source data for public.trending_topics (008) and for UserActivityStats.searchCount.';

create index if not exists search_history_user_idx    on public.search_history (user_id, searched_at desc);
create index if not exists search_history_surface_idx on public.search_history (surface, searched_at desc);
-- Trending-topic aggregation scans by time window and normalised query text.
create index if not exists search_history_query_lower_idx on public.search_history (lower(query), searched_at desc);


-- -----------------------------------------------------------------------------
-- Ownership helper
-- -----------------------------------------------------------------------------
-- ai_answer_sources / ai_citations / ai_answer_related_standards /
-- ai_suggested_questions have no user_id of their own; they inherit ownership
-- from ai_answers. One security-definer helper keeps those four policies
-- identical and cheap.
create or replace function public.owns_ai_answer(p_answer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.ai_answers a
    where a.id = p_answer_id
      and (a.user_id = auth.uid() or public.is_admin())
  );
$$;

comment on function public.owns_ai_answer(uuid) is
  'True when the JWT subject owns the answer (or is an admin). Backs RLS on the four answer-child tables.';


-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
-- STRICTLY PER-USER. A user reads and writes only their own conversations,
-- messages, answers and search history.
--
-- Admin read access is granted on every table in this file. That is a deliberate
-- product decision, not an oversight: the admin AI-analytics surface reports
-- answer confidence distribution, refusal rate, latency and query trends, and
-- the moderation surface needs to inspect a reported answer. Admins have READ
-- only — no admin UPDATE/DELETE policy exists on user conversation content, so
-- an admin cannot silently rewrite a user's history. If analytics ever needs to
-- be de-identified, drop the *_select_admin policies and build aggregate views
-- with security_invoker = off instead.
alter table public.ai_conversations           enable row level security;
alter table public.ai_messages                enable row level security;
alter table public.ai_answers                 enable row level security;
alter table public.ai_answer_sources          enable row level security;
alter table public.ai_citations               enable row level security;
alter table public.ai_answer_related_standards enable row level security;
alter table public.ai_suggested_questions     enable row level security;
alter table public.search_history             enable row level security;

-- public.ai_conversations -----------------------------------------------------
drop policy if exists ai_conversations_select_own on public.ai_conversations;
create policy ai_conversations_select_own on public.ai_conversations
  for select to authenticated using (user_id = auth.uid());
drop policy if exists ai_conversations_select_admin on public.ai_conversations;
create policy ai_conversations_select_admin on public.ai_conversations
  for select to authenticated using (public.is_admin());
drop policy if exists ai_conversations_insert_own on public.ai_conversations;
create policy ai_conversations_insert_own on public.ai_conversations
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists ai_conversations_update_own on public.ai_conversations;
create policy ai_conversations_update_own on public.ai_conversations
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ai_conversations_delete_own on public.ai_conversations;
create policy ai_conversations_delete_own on public.ai_conversations
  for delete to authenticated using (user_id = auth.uid());

-- public.ai_messages ----------------------------------------------------------
drop policy if exists ai_messages_select_own on public.ai_messages;
create policy ai_messages_select_own on public.ai_messages
  for select to authenticated using (user_id = auth.uid());
drop policy if exists ai_messages_select_admin on public.ai_messages;
create policy ai_messages_select_admin on public.ai_messages
  for select to authenticated using (public.is_admin());
drop policy if exists ai_messages_insert_own on public.ai_messages;
create policy ai_messages_insert_own on public.ai_messages
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists ai_messages_delete_own on public.ai_messages;
create policy ai_messages_delete_own on public.ai_messages
  for delete to authenticated using (user_id = auth.uid());
-- No UPDATE policy: a transcript is append-only. Editing a past message would
-- desynchronise it from the ai_answers row and its citation offsets.

-- public.ai_answers -----------------------------------------------------------
drop policy if exists ai_answers_select_own on public.ai_answers;
create policy ai_answers_select_own on public.ai_answers
  for select to authenticated using (user_id = auth.uid());
drop policy if exists ai_answers_select_admin on public.ai_answers;
create policy ai_answers_select_admin on public.ai_answers
  for select to authenticated using (public.is_admin());
drop policy if exists ai_answers_insert_own on public.ai_answers;
create policy ai_answers_insert_own on public.ai_answers
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists ai_answers_delete_own on public.ai_answers;
create policy ai_answers_delete_own on public.ai_answers
  for delete to authenticated using (user_id = auth.uid());

-- public.ai_answer_sources ----------------------------------------------------
drop policy if exists ai_answer_sources_select on public.ai_answer_sources;
create policy ai_answer_sources_select on public.ai_answer_sources
  for select to authenticated using (public.owns_ai_answer(answer_id));
drop policy if exists ai_answer_sources_insert on public.ai_answer_sources;
create policy ai_answer_sources_insert on public.ai_answer_sources
  for insert to authenticated with check (public.owns_ai_answer(answer_id));
drop policy if exists ai_answer_sources_delete on public.ai_answer_sources;
create policy ai_answer_sources_delete on public.ai_answer_sources
  for delete to authenticated using (public.owns_ai_answer(answer_id));

-- public.ai_citations ---------------------------------------------------------
drop policy if exists ai_citations_select on public.ai_citations;
create policy ai_citations_select on public.ai_citations
  for select to authenticated using (public.owns_ai_answer(answer_id));
drop policy if exists ai_citations_insert on public.ai_citations;
create policy ai_citations_insert on public.ai_citations
  for insert to authenticated with check (public.owns_ai_answer(answer_id));
drop policy if exists ai_citations_delete on public.ai_citations;
create policy ai_citations_delete on public.ai_citations
  for delete to authenticated using (public.owns_ai_answer(answer_id));

-- public.ai_answer_related_standards ------------------------------------------
drop policy if exists ai_answer_related_standards_select on public.ai_answer_related_standards;
create policy ai_answer_related_standards_select on public.ai_answer_related_standards
  for select to authenticated using (public.owns_ai_answer(answer_id));
drop policy if exists ai_answer_related_standards_insert on public.ai_answer_related_standards;
create policy ai_answer_related_standards_insert on public.ai_answer_related_standards
  for insert to authenticated with check (public.owns_ai_answer(answer_id));
drop policy if exists ai_answer_related_standards_delete on public.ai_answer_related_standards;
create policy ai_answer_related_standards_delete on public.ai_answer_related_standards
  for delete to authenticated using (public.owns_ai_answer(answer_id));

-- public.ai_suggested_questions -----------------------------------------------
drop policy if exists ai_suggested_questions_select on public.ai_suggested_questions;
create policy ai_suggested_questions_select on public.ai_suggested_questions
  for select to authenticated using (public.owns_ai_answer(answer_id));
drop policy if exists ai_suggested_questions_insert on public.ai_suggested_questions;
create policy ai_suggested_questions_insert on public.ai_suggested_questions
  for insert to authenticated with check (public.owns_ai_answer(answer_id));
drop policy if exists ai_suggested_questions_delete on public.ai_suggested_questions;
create policy ai_suggested_questions_delete on public.ai_suggested_questions
  for delete to authenticated using (public.owns_ai_answer(answer_id));

-- public.search_history -------------------------------------------------------
drop policy if exists search_history_select_own on public.search_history;
create policy search_history_select_own on public.search_history
  for select to authenticated using (user_id = auth.uid());
drop policy if exists search_history_select_admin on public.search_history;
create policy search_history_select_admin on public.search_history
  for select to authenticated using (public.is_admin());
drop policy if exists search_history_insert_own on public.search_history;
create policy search_history_insert_own on public.search_history
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists search_history_delete_own on public.search_history;
create policy search_history_delete_own on public.search_history
  for delete to authenticated using (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
-- No `anon` grants anywhere in this file: AI history is never anonymous.
grant select, insert, update, delete on public.ai_conversations            to authenticated;
grant select, insert, delete         on public.ai_messages                 to authenticated;
grant select, insert, delete         on public.ai_answers                  to authenticated;
grant select, insert, delete         on public.ai_answer_sources           to authenticated;
grant select, insert, delete         on public.ai_citations                to authenticated;
grant select, insert, delete         on public.ai_answer_related_standards to authenticated;
grant select, insert, delete         on public.ai_suggested_questions      to authenticated;
grant select, insert, delete         on public.search_history              to authenticated;

grant select, insert, update, delete on public.ai_conversations            to service_role;
grant select, insert, update, delete on public.ai_messages                 to service_role;
grant select, insert, update, delete on public.ai_answers                  to service_role;
grant select, insert, update, delete on public.ai_answer_sources           to service_role;
grant select, insert, update, delete on public.ai_citations                to service_role;
grant select, insert, update, delete on public.ai_answer_related_standards to service_role;
grant select, insert, update, delete on public.ai_suggested_questions      to service_role;
grant select, insert, update, delete on public.search_history              to service_role;

grant execute on function public.owns_ai_answer(uuid) to authenticated, service_role;


-- #############################################################################
-- #############################################################################
--                       BEGIN 007_handbook.sql
-- #############################################################################
-- #############################################################################


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


-- #############################################################################
-- #############################################################################
--                       BEGIN 008_reports.sql
-- #############################################################################
-- #############################################################################


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


-- =============================================================================
-- END OF SCHEMA. Load demo content with database/seed.sql.
-- =============================================================================
