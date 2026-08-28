-- Migration 002: Organizations
-- Depends on: 001_users.sql

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT,
    industry TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    postal_code TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organization_members (
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member', -- owner, admin, member
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organization_id, user_id)
);

-- Indexes
CREATE INDEX idx_orgs_name ON organizations(name);
CREATE INDEX idx_orgs_industry ON organizations(industry);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Organization Policies
CREATE POLICY "Public can view basic organization info" 
ON organizations FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Members can update their organization" 
ON organizations FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    )
);

-- Member Policies
CREATE POLICY "Users can see members of their own organizations" 
ON organization_members FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM organization_members AS om 
        WHERE om.organization_id = organization_members.organization_id 
        AND om.user_id = auth.uid()
    )
);
