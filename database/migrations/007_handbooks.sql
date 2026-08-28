-- Migration 007: Handbooks
-- Depends on: 003_documents.sql

CREATE TABLE handbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status TEXT NOT NULL DEFAULT 'published',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_handbooks_doc ON handbooks(document_id);
CREATE INDEX idx_handbooks_cat ON handbooks(category);

-- Row Level Security
ALTER TABLE handbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Handbooks are viewable if the parent document is viewable"
ON handbooks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM documents 
        WHERE documents.id = handbooks.document_id
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
