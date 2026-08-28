# Team Workflow & Contracts

## Cross-Boundary Rules

1. **Frontend ↔ API Contract ↔ Backend**: The API payload shapes defined in `shared/types/index.ts` dictate the exact JSON structure. Do NOT silently change response shapes in the Node backend without updating the TypeScript interface and verifying Frontend UI dependencies.
2. **Backend ↔ RAG Contract ↔ RAG Python**: The python Pydantic models (e.g. `QueryResponse`) explicitly dictate the response payload. The backend Node.js `ragService.ts` must exactly mirror this. Do NOT strip out rich payload data (like `document_id`, `chunk_id`) from RAG responses just to fit an outdated frontend expectation.
3. **Backend ↔ Database Schema ↔ Database**: The Supabase PostgreSQL database serves as the ultimate source of truth. Node.js backend controllers MUST resolve relationships natively via foreign-key joins (e.g., `documents!inner(...)`) rather than fabricating data.
4. **Frontend ↔ Database**: The frontend MUST NEVER depend directly on or query the database schema. All queries flow through the backend API.

## Modifying Shared Contracts
Any time a type inside `shared/types/index.ts` is mutated, the engineer MUST run builds on **both** frontend and backend before committing.
