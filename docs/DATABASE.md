# MANAK Database Documentation

## 1. Database Architecture
The MANAK system relies on a PostgreSQL database provisioned via Supabase. It integrates directly with Supabase Auth for user authentication and utilizes the `pgvector` extension for semantic search required by the RAG pipeline.

**Intended Target Architecture:**
```
Frontend ──API──> Backend ────────┬──> Supabase/PostgreSQL
                                  │
                                  └──> RAG ──> pgvector
```

## 2. Tables & Relationships
- **users**: Extending `auth.users` with `role` (individual, organization, admin) and basic profile data.
- **organizations**: Stores organization details (e.g., industry, postal code).
- **organization_members**: Join table for Users <-> Organizations.
- **documents**: Metadata repository representing Standards, Handbooks, Reports, etc.
- **standards**: Specific schema for BIS standards, mapping to a `document_id`.
- **document_chunks**: Stores text segments extracted from documents for traceability (page, section, clause).
- **chunk_vectors**: The pgvector repository mapping a `chunk_id` to its 256-dimensional embedding.
- **ai_conversations / ai_messages / ai_citations**: Stores user chats with the AI and traces specific citations back to `document_chunks`.
- **handbooks / reports**: Domain-specific tables for additional metadata, linking back to organizations and documents.

## 3. Migration Order
1. `001_users.sql`
2. `002_organizations.sql`
3. `003_documents.sql`
4. `004_document_chunks.sql`
5. `005_vectors.sql`
6. `006_ai.sql`
7. `007_handbooks.sql`
8. `008_reports.sql`

## 4. Vector Storage
- **Extension**: `pgvector`
- **Dimension**: `256` (matches current DeterministicEmbeddingProvider)
- **Index**: HNSW with `vector_cosine_ops` (Cosine Similarity)
- **Strategy**: The `chunk_vectors` table intentionally isolates the embeddings from the `document_chunks`. When MANAK upgrades to a production embedding provider (e.g., OpenAI `text-embedding-3-small` with 1536 dims), a migration will adjust the dimension constraint and trigger a re-embedding background job.

## 5. RLS & Organization Ownership
- **Tenancy**: Organizations operate on strict tenancy. Members can only view their own organization's private documents and reports.
- **Public Standards**: Standards are public by default (where `organization_id` is null).
- **Auth Integrity**: `users` directly references `auth.users` so session validation strictly controls policies. No plaintext passwords exist in public schemas.

## 6. Seed Data Strategy
- Run `seed.sql` to inject development identities.
- Seed data contains fake organizations (`Demo Labs`) and standards (`IS 302`) for integration testing. These are strictly mocked data.

## 7. Connecting Hosted Supabase
To apply these migrations to a hosted Supabase project:
1. Link project: `supabase link --project-ref <your-project-id>`
2. Push migrations: `supabase db push`
3. Push seed data if required: `supabase db push --seed`

## 8. Backend & RAG Integration Points
- **Backend**: Can now replace `MemoryUserRepository` with a Supabase client fetching from `public.users`.
- **RAG**: Can migrate from `InMemoryVectorStore` to a `PostgresVectorStore` pointing to `chunk_vectors`.

## 9. Verification Status
- **Supabase CLI**: Available (v2.115.0)
- **Local Supabase**: RUNNING
- **Migrations**: PASS. All 8 migrations applied cleanly from a fresh database reset.
- **RLS & Vector**: PASS. RLS policies successfully created and tested. Pgvector extension verified to accept 256 dimension insertions and compute cosine similarity successfully using HNSW.
- **Seed Data**: PASS. Seed organizations, documents, standards, and vectors inserted and queriable.
