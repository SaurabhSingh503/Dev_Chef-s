# AI and RAG

This document defines the integration boundary between the MANAK Backend and the isolated Python FastAPI RAG Service.

## Current RAG Flow
1. User sends query to Backend (`POST /ai/chat`).
2. Backend proxies query to RAG (`POST /query`).
3. RAG processes the query, retrieves chunks from the **In-Memory Vector Store**, formats citations, and returns to Backend.
4. Backend parses and forwards to Frontend.

## Network Contract (Backend -> RAG)

### Request (`POST /query`)
```json
{
  "question": "What are the packaging standards for drinking water?",
  "language": "en",
  "top_k": 5,
  "filters": {
    "document_type": null,
    "industry": null,
    "category": null
  }
}
```

### Response
```json
{
  "answer": "The packaging standards...",
  "sources": [
    { "title": "IS 14543", "reference": "doc-123" }
  ],
  "citations": [
    {
      "document_id": "uuid",
      "document_title": "IS 14543",
      "page": 12,
      "section": "4.1",
      "clause": null,
      "chunk_id": "chunk-uuid",
      "relevance": 0.89
    }
  ],
  "confidence": 85,
  "relatedStandards": [],
  "suggestedQuestions": [],
  "grounding": "supported"
}
```

## Status & PLANNED Features
- **pgvector**: NOT IMPLEMENTED (Currently using InMemoryVectorStore).
- **AI Persistence**: NOT IMPLEMENTED (The backend routes do not store AI chat state to Supabase Postgres).
