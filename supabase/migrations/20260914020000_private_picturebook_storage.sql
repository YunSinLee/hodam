-- Reviewed against the linked storage policies on 2026-09-14. NOT applied remotely.
-- Existing public object URLs stop working; the app reads signed URLs instead.
BEGIN;
UPDATE storage.buckets SET public = false WHERE id = 'image';
DROP POLICY IF EXISTS "auth 1nq2cb_0" ON storage.objects;
DROP POLICY IF EXISTS "auth 1nq2cb_1" ON storage.objects;
DROP POLICY IF EXISTS "auth 1nq2cb_2" ON storage.objects;
DROP POLICY IF EXISTS "auth 1nq2cb_3" ON storage.objects;
DROP POLICY IF EXISTS hodam_picturebook_owner ON storage.objects;
CREATE POLICY hodam_picturebook_owner ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'image' AND EXISTS (
    SELECT 1 FROM public.thread t
    WHERE t.user_id = (SELECT auth.uid())
      AND (name = 'image_thread_id_' || t.id::text
        OR name ~ ('^image_thread_id_' || t.id::text || '_page_[1-8]$'))
  )
)
WITH CHECK (
  bucket_id = 'image' AND EXISTS (
    SELECT 1 FROM public.thread t
    WHERE t.user_id = (SELECT auth.uid())
      AND (name = 'image_thread_id_' || t.id::text
        OR name ~ ('^image_thread_id_' || t.id::text || '_page_[1-8]$'))
  )
);

-- This bucket did not exist on the inspected project. New avatars are private.
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profiles', 'profiles', false, 5242880, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT(id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS hodam_profile_owner ON storage.objects;
CREATE POLICY hodam_profile_owner ON storage.objects
FOR ALL TO authenticated
USING (
  bucket_id = 'profiles' AND name ~ ('^profile_' || (SELECT auth.uid())::text || '_[a-z0-9-]+\.(jpg|png|webp|gif)$')
)
WITH CHECK (
  bucket_id = 'profiles' AND name ~ ('^profile_' || (SELECT auth.uid())::text || '_[a-z0-9-]+\.(jpg|png|webp|gif)$')
);
COMMIT;
