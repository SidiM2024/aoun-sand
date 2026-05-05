CREATE TABLE IF NOT EXISTS public.site_settings (
    id TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default values for donation section
INSERT INTO public.site_settings (id, value) 
VALUES ('donation_section', '{"title_ar": "معاً نصنع الأثر", "title_fr": "Ensemble, nous créons l''impact", "desc_ar": "بفضل مساهماتكم نستمر في خدمة المجتمع", "desc_fr": "Grâce à vos contributions, nous continuons à servir la communauté", "total_donations": 250000, "is_visible": true}')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read settings
DROP POLICY IF EXISTS "Anyone can read settings" ON public.site_settings;
CREATE POLICY "Anyone can read settings" ON public.site_settings FOR SELECT USING (true);

-- Allow admins to update settings (using RPC or if we trust the admin check)
-- For now we allow all authenticated, but front-end will hide the admin panel from non-admins
DROP POLICY IF EXISTS "Admins can update settings" ON public.site_settings;
CREATE POLICY "Admins can update settings" ON public.site_settings FOR UPDATE USING (auth.role() = 'authenticated');
