-- Migration 004: Document Chunks
-- Depends on: 003_documents.sql

CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    page INTEGER,
    section TEXT,
    clause TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_page ON document_chunks(page);
CREATE INDEX idx_chunks_clause ON document_chunks(clause);

-- Row Level Security
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Chunk Policies inherit Document Policies implicitly through joining, 
-- but for simplicity in RAG we enforce policy by checking the parent document
CREATE POLICY "Users can view chunks if they can view the document"
ON document_chunks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM documents 
        WHERE documents.id = document_chunks.document_id
        AND (
            documents.organization_id IS NULL 
            OR EXISTS (
                SELECT 1 FROM organization_members 
                WHERE organization_id = documents.organization_id 
                AND user_id = auth.uid()
            )
        )
    )
);
