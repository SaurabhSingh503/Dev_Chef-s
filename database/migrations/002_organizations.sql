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
