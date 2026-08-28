-- 1. Check Tables
\dt
\d users
\d organizations
\d chunk_vectors

-- 2. Check Seed Data
SELECT id, name FROM organizations;
SELECT title, type FROM documents;
SELECT standard_number FROM standards;

-- 3. Check Vector Storage
SELECT chunk_id, embedding <=> array_fill(0, ARRAY[256])::vector AS distance 
FROM chunk_vectors LIMIT 1;

-- 4. Test RLS
-- First, create a mock user in auth.users if needed, but since we are bypassing auth.users foreign key checks for testing, we might need a real auth.users record or just test the policy logic.
-- Actually, the seed data doesn't contain users because it's hard to mock auth.users without the pgcrypto extension or actual supabase auth API calls.
-- Let's check the policies directly:
SELECT tablename, policyname, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public';
