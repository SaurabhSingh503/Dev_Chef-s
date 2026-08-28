-- Migration 012: Fix Organization Members RLS Recursion
-- Depends on: 002_organizations.sql

-- Drop the broken recursive policy
DROP POLICY IF EXISTS "Users can see members of their own organizations" ON organization_members;

-- Create a security definer function to get the user's organization IDs without triggering RLS recursively
CREATE OR REPLACE FUNCTION get_user_organizations() 
RETURNS SETOF UUID AS $$
BEGIN
    RETURN QUERY SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the new, safe policy
CREATE POLICY "Users can see members of their own organizations" 
ON organization_members FOR SELECT 
USING (
    organization_id IN (SELECT get_user_organizations())
);
