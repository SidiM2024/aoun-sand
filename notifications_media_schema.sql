-- ══════════════════════════════════════════════════════
-- Notifications Table — ensure media_url column exists
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════

-- 1. Ensure notifications table exists with all needed columns
CREATE TABLE IF NOT EXISTS public.notifications (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text NOT NULL,
  message      text NOT NULL,
  link         text,
  media_url    text,
  scheduled_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

-- 2. Add missing columns if table already exists
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS media_url    text,
  ADD COLUMN IF NOT EXISTS link         text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- 3. Enable Row Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Allow everyone (logged-in users) to READ notifications
DROP POLICY IF EXISTS "notifications_read_all" ON public.notifications;
CREATE POLICY "notifications_read_all"
  ON public.notifications FOR SELECT
  USING (true);

-- 5. Allow only admins/service role to INSERT/UPDATE/DELETE
-- (Admin panel uses service-role-like anon key with RLS bypass via RPC or direct)
DROP POLICY IF EXISTS "notifications_write_anon" ON public.notifications;
CREATE POLICY "notifications_write_anon"
  ON public.notifications FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. Enable Realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ══════════════════════════════════════════════════════
-- Supabase Storage — ensure "media" bucket is public
-- ══════════════════════════════════════════════════════

-- Create media bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  52428800, -- 50 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/avif',
        'video/mp4','video/webm','video/ogg','video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- Storage policy: allow authenticated users to upload
DROP POLICY IF EXISTS "media_upload_auth" ON storage.objects;
CREATE POLICY "media_upload_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media');

-- Allow anon (admin panel) to upload too
DROP POLICY IF EXISTS "media_upload_anon" ON storage.objects;
CREATE POLICY "media_upload_anon"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'media');

-- Allow public read
DROP POLICY IF EXISTS "media_read_public" ON storage.objects;
CREATE POLICY "media_read_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Allow delete
DROP POLICY IF EXISTS "media_delete_auth" ON storage.objects;
CREATE POLICY "media_delete_auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'media');

-- ══════════════════════════════════════════════════════
-- Enable Realtime for all needed tables
-- ══════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
