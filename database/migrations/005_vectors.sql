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
