-- Test script to verify RLS logic
-- First insert some mock users in public.users to act as test subjects
INSERT INTO users (id, name, email, role) VALUES 
('11111111-1111-1111-1111-111111111111', 'User A', 'usera@test.com', 'individual'),
('22222222-2222-2222-2222-222222222222', 'User B', 'userb@test.com', 'individual')
ON CONFLICT DO NOTHING;

INSERT INTO organizations (id, name, industry) VALUES 
('33333333-3333-3333-3333-333333333333', 'Org A', 'Testing')
ON CONFLICT DO NOTHING;

INSERT INTO organization_members (organization_id, user_id, role) VALUES
('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'member')
ON CONFLICT DO NOTHING;

INSERT INTO saved_standards (user_id, standard_id)
SELECT '11111111-1111-1111-1111-111111111111', id FROM standards LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO saved_standards (user_id, standard_id)
SELECT '22222222-2222-2222-2222-222222222222', id FROM standards LIMIT 1
ON CONFLICT DO NOTHING;

-- Act as User A
SET SESSION AUTHORIZATION authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

-- Should see only their own saved standards (1 row)
SELECT count(*) AS user_a_saved_standards FROM saved_standards;

-- Should see Org A members since User A is in Org A
SELECT count(*) AS user_a_org_members FROM organization_members WHERE organization_id = '33333333-3333-3333-3333-333333333333';

-- Act as User B
SET request.jwt.claims TO '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

-- Should see only User B's saved standards (1 row)
SELECT count(*) AS user_b_saved_standards FROM saved_standards;

-- Should NOT see Org A members (0 rows)
SELECT count(*) AS user_b_org_members FROM organization_members WHERE organization_id = '33333333-3333-3333-3333-333333333333';

RESET SESSION AUTHORIZATION;
