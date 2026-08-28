# Architecture

MANAK is a multi-tier system with distinct functional boundaries.

## Current Architecture Flow

```
[Frontend (React/Vite)]
       │
       │ (REST JSON via /api)
       ▼
[Backend (Node.js/Express)] ───► [RAG (Python/FastAPI)]
       │                                │
       │ (Supabase JS Client)           │ (Currently In-Memory)
       │                                │ (Planned: pgvector)
       ▼                                ▼
[Supabase / PostgreSQL] ◄──────── [AI / Embeddings]
```

## Security & RLS
- The **Backend** orchestrates logic utilizing the `SUPABASE_SERVICE_ROLE_KEY`. This bypasses Postgres Row Level Security (RLS) outright. Therefore, the Node.js controllers maintain absolute responsibility for verifying `req.user` authorization before mutating or querying sensitive tables.
- **Frontend** users receive a custom MANAK signed JWT, NOT a Supabase Access Token.

## Known Limitations
- The backend does NOT currently implement stateful AI conversation persistence. The DB tables exist (`ai_conversations`, `ai_messages`), but the controller logic does not wire them.
- RAG uses a temporary in-memory vector store. The `pgvector` migration is pending.
