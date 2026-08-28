-- Migration 003: Documents and Standards
-- Depends on: 002_organizations.sql

CREATE TYPE document_type AS ENUM (
    'standard', 'handbook', 'technical', 'certification', 
    'testing', 'organization', 'regulatory', 'other'
);

CREATE TYPE ingestion_status AS ENUM (
    'pending', 'processing', 'ready', 'failed'
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type document_type NOT NULL,
    description TEXT,
    source TEXT,
    file_reference TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    language TEXT,
    version TEXT,
    publication_date DATE,
    effective_date DATE,
    category TEXT,
    industry TEXT,
    status ingestion_status NOT NULL DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Separate standards table for specific structured standard data
CREATE TABLE standards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    standard_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL, -- e.g., 'active', 'withdrawn'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_docs_type ON documents(type);
CREATE INDEX idx_docs_category ON documents(category);
CREATE INDEX idx_docs_industry ON documents(industry);
CREATE INDEX idx_docs_org ON documents(organization_id);
CREATE INDEX idx_docs_status ON documents(status);
CREATE INDEX idx_standards_number ON standards(standard_number);

-- Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE standards ENABLE ROW LEVEL SECURITY;

-- Document Policies
-- Public documents (no organization_id) are viewable by all authenticated users
CREATE POLICY "Authenticated users can view public documents"
ON documents FOR SELECT
TO authenticated
USING (organization_id IS NULL);

-- Organization documents are viewable only by members
CREATE POLICY "Members can view their organization's documents"
ON documents FOR SELECT
USING (
    organization_id IS NOT NULL AND 
    EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = documents.organization_id 
        AND user_id = auth.uid()
    )
);

-- Standards are generally public knowledge in MANAK
CREATE POLICY "Standards are public"
ON standards FOR SELECT
TO authenticated
USING (true);
