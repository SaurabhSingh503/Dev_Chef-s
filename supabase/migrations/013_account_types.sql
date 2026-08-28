-- Migration 013: Account Types
-- Adds account_type and product_type to users for explicit organization vs individual separation.

ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE users ADD COLUMN product_type TEXT;

-- Migrate existing roles to account_type
UPDATE users SET account_type = 'organization' WHERE role = 'organization';

-- Add check constraint for allowed values
ALTER TABLE users ADD CONSTRAINT check_account_type CHECK (account_type IN ('individual', 'organization'));
