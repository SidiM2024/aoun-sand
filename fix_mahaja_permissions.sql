-- Fix RLS for Mahaja Content so that users with is_mahaja=true can manage books and courses

CREATE OR REPLACE FUNCTION public.is_mahaja_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND (is_mahaja = true OR EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()))
  );
$$;

-- Update courses policies
DROP POLICY IF EXISTS "mahaja_courses_insert" ON public.mahaja_courses;
DROP POLICY IF EXISTS "mahaja_courses_update" ON public.mahaja_courses;
DROP POLICY IF EXISTS "mahaja_courses_delete" ON public.mahaja_courses;

CREATE POLICY "mahaja_courses_insert" ON public.mahaja_courses
  FOR INSERT WITH CHECK (public.is_mahaja_admin() OR public.is_admin());
CREATE POLICY "mahaja_courses_update" ON public.mahaja_courses
  FOR UPDATE USING (public.is_mahaja_admin() OR public.is_admin());
CREATE POLICY "mahaja_courses_delete" ON public.mahaja_courses
  FOR DELETE USING (public.is_mahaja_admin() OR public.is_admin());

-- Update books policies
DROP POLICY IF EXISTS "mahaja_books_insert" ON public.mahaja_books;
DROP POLICY IF EXISTS "mahaja_books_update" ON public.mahaja_books;
DROP POLICY IF EXISTS "mahaja_books_delete" ON public.mahaja_books;

CREATE POLICY "mahaja_books_insert" ON public.mahaja_books
  FOR INSERT WITH CHECK (public.is_mahaja_admin() OR public.is_admin());
CREATE POLICY "mahaja_books_update" ON public.mahaja_books
  FOR UPDATE USING (public.is_mahaja_admin() OR public.is_admin());
CREATE POLICY "mahaja_books_delete" ON public.mahaja_books
  FOR DELETE USING (public.is_mahaja_admin() OR public.is_admin());

-- Update storage policies
DROP POLICY IF EXISTS "mahaja_insert" ON storage.objects;
DROP POLICY IF EXISTS "mahaja_update" ON storage.objects;
DROP POLICY IF EXISTS "mahaja_delete" ON storage.objects;

CREATE POLICY "mahaja_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'mahaja_content' AND (public.is_mahaja_admin() OR public.is_admin()));
CREATE POLICY "mahaja_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'mahaja_content' AND (public.is_mahaja_admin() OR public.is_admin()));
CREATE POLICY "mahaja_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'mahaja_content' AND (public.is_mahaja_admin() OR public.is_admin()));
