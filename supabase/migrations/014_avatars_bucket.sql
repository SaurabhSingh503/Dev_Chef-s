-- Create the avatars bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for avatars bucket
-- Allow public access to read avatars
CREATE POLICY "Avatar images are publicly accessible."
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Note: The backend uses SUPABASE_SERVICE_ROLE_KEY to upload images securely
-- so we do NOT need an INSERT/UPDATE policy for authenticated users from the frontend here,
-- because the backend handles the uploading and bypasses RLS.
