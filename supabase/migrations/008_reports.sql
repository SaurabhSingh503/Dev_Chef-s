-- Migration 008: Reports
-- Depends on: 001_users.sql, 002_organizations.sql

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'generating',
    file_reference TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reports_owner ON reports(owner_id);
CREATE INDEX idx_reports_org ON reports(organization_id);

-- Row Level Security
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reports"
ON reports FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Users can view reports of their organization"
ON reports FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = reports.organization_id 
        AND user_id = auth.uid()
    )
);
