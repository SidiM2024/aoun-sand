-- ==========================================================
-- الإعداد الشامل لقسم المحجة البيضاء (الجداول + الصلاحيات)
-- Comprehensive Mahaja Setup (Tables + Permissions)
-- ==========================================================

-- 1. التأكد من وجود الأعمدة الإضافية في جدول المستخدمين
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_mahaja BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 2. إنشاء جدول الدورات (إذا لم يكن موجوداً)
CREATE TABLE IF NOT EXISTS public.mahaja_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    content_link TEXT,
    image_url TEXT,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. إنشاء جدول الكتب (إذا لم يكن موجوداً)
CREATE TABLE IF NOT EXISTS public.mahaja_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    download_link TEXT,
    cover_image_url TEXT,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. تمكين الحماية RLS للجداول
ALTER TABLE public.mahaja_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mahaja_books ENABLE ROW LEVEL SECURITY;

-- 5. تحديث سياسات الدورات لتكون متاحة للوحة التحكم (مثل المالية)
DROP POLICY IF EXISTS "mahaja_courses_insert" ON public.mahaja_courses;
DROP POLICY IF EXISTS "mahaja_courses_update" ON public.mahaja_courses;
DROP POLICY IF EXISTS "mahaja_courses_delete" ON public.mahaja_courses;
DROP POLICY IF EXISTS "Public can view published courses" ON public.mahaja_courses;
DROP POLICY IF EXISTS "mahaja_courses_read" ON public.mahaja_courses;

CREATE POLICY "mahaja_courses_all" ON public.mahaja_courses
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. تحديث سياسات الكتب لتكون متاحة للوحة التحكم
DROP POLICY IF EXISTS "mahaja_books_insert" ON public.mahaja_books;
DROP POLICY IF EXISTS "mahaja_books_update" ON public.mahaja_books;
DROP POLICY IF EXISTS "mahaja_books_delete" ON public.mahaja_books;
DROP POLICY IF EXISTS "Public can view published books" ON public.mahaja_books;
DROP POLICY IF EXISTS "mahaja_books_read" ON public.mahaja_books;

CREATE POLICY "mahaja_books_all" ON public.mahaja_books
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 7. التأكد من وجود مساحة التخزين (Bucket) وإصلاح صلاحياتها
INSERT INTO storage.buckets (id, name, public) 
VALUES ('mahaja_content', 'mahaja_content', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "mahaja_insert" ON storage.objects;
DROP POLICY IF EXISTS "mahaja_update" ON storage.objects;
DROP POLICY IF EXISTS "mahaja_delete" ON storage.objects;
DROP POLICY IF EXISTS "Mahaja Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Mahaja Admin Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Mahaja Admin Updates" ON storage.objects;
DROP POLICY IF EXISTS "Mahaja Admin Deletes" ON storage.objects;

CREATE POLICY "mahaja_storage_select" ON storage.objects FOR SELECT 
  TO anon, authenticated USING (bucket_id = 'mahaja_content');
CREATE POLICY "mahaja_storage_insert" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'mahaja_content');
CREATE POLICY "mahaja_storage_update" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'mahaja_content');
CREATE POLICY "mahaja_storage_delete" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'mahaja_content');

SELECT 'تم الانتهاء من إعداد قاعدة بيانات المحجة البيضاء بنجاح ✓' AS result;
