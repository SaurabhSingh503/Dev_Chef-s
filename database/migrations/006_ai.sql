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
