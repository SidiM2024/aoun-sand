-- ============================================================
-- site_settings_schema.sql - Full setup for aoun-sand
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.site_settings (
    id TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Insert default donation_section row
INSERT INTO public.site_settings (id, value)
VALUES (
  'donation_section',
  '{
    "title_ar": "معاً نصنع الأثر",
    "title_fr": "Ensemble, nous créons l''impact",
    "title_en": "Together We Make an Impact",
    "desc_ar": "بفضل مساهماتكم نستمر في خدمة المجتمع وتحقيق التغيير الإيجابي.",
    "desc_fr": "Grâce à vos contributions, nous continuons à servir la communauté.",
    "desc_en": "Thanks to your contributions, we continue to serve the community.",
    "total_donations": 0,
    "is_visible": true,
    "campaigns": []
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable Row Level Security
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 4. Drop old policies
DROP POLICY IF EXISTS "Anyone can read settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can upsert settings" ON public.site_settings;

-- 5. Allow everyone to READ settings (public data)
CREATE POLICY "Anyone can read settings"
  ON public.site_settings FOR SELECT USING (true);

-- 6. Allow authenticated users to INSERT (needed for upsert)
CREATE POLICY "Admins can insert settings"
  ON public.site_settings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 7. Allow authenticated users to UPDATE
CREATE POLICY "Admins can update settings"
  ON public.site_settings FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 8. Enable Realtime on site_settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;

-- ============================================================
-- Also ensure all other required tables have realtime enabled
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
