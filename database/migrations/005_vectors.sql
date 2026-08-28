-- Migration 005: Vectors
-- Depends on: 004_document_chunks.sql, pgvector extension

CREATE EXTENSION IF NOT EXISTS vector;

-- Use 256 dimensions to match the current DeterministicEmbeddingProvider in MANAK RAG
CREATE TABLE chunk_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
    embedding vector(256) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for vector cosine similarity search
CREATE INDEX idx_chunk_vectors_embedding ON chunk_vectors USING hnsw (embedding vector_cosine_ops);

-- Row Level Security
ALTER TABLE chunk_vectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can search vectors if they can view the chunk"
ON chunk_vectors FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM document_chunks 
        WHERE document_chunks.id = chunk_vectors.chunk_id
    )
);
