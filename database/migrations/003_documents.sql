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
