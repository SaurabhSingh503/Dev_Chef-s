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
