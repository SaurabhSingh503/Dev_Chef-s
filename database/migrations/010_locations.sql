-- Migration 010: Add Locations to Organizations
-- Depends on: 009_saved_standards.sql

ALTER TABLE organizations
ADD COLUMN latitude NUMERIC(9,6) CHECK (latitude BETWEEN -90 AND 90),
ADD COLUMN longitude NUMERIC(9,6) CHECK (longitude BETWEEN -180 AND 180);

CREATE INDEX idx_orgs_location ON organizations(latitude, longitude);
