-- Migration 009: Saved Standards
-- Depends on: 003_documents.sql

CREATE TABLE saved_standards (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    standard_id UUID REFERENCES standards(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, standard_id)
);

CREATE INDEX idx_saved_standards_user ON saved_standards(user_id);
CREATE INDEX idx_saved_standards_standard ON saved_standards(standard_id);

ALTER TABLE saved_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved standards"
ON saved_standards FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own saved standards"
ON saved_standards FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own saved standards"
ON saved_standards FOR DELETE
TO authenticated
USING (user_id = auth.uid());
