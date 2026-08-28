-- Development Seed Data
-- NOTE: Passwords and auth linkage are mocked. For true Supabase Auth, you must create rows in auth.users first.

-- Create an organization
INSERT INTO organizations (id, name, industry, type, contact_email) VALUES
('11111111-1111-1111-1111-111111111111', 'Demo Labs', 'Testing', 'Laboratory', 'contact@demolabs.com');

-- Create a public standard document (DEMO DATA)
INSERT INTO documents (id, title, type, category, status) VALUES
('22222222-2222-2222-2222-222222222222', 'IS 302: Demo Standard for Testing', 'standard', 'Electrical', 'ready');

INSERT INTO standards (document_id, standard_number, status) VALUES
('22222222-2222-2222-2222-222222222222', 'IS 302', 'active');

-- Create a chunk and dummy vector for the RAG integration
INSERT INTO document_chunks (id, document_id, content, chunk_index, page, clause) VALUES
('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'This is a demo chunk for IS 302.', 1, 1, '1.1');

-- The pgvector requires an array of exactly 256 dimensions. 
-- We'll provide a zero vector for demo purposes.
INSERT INTO chunk_vectors (chunk_id, embedding) VALUES
('33333333-3333-3333-3333-333333333333', array_fill(0, ARRAY[256]));
