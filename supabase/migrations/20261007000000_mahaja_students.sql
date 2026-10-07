-- ==========================================================
-- طلاب المحجة البيضاء — Mahaja students registry + student cards
-- ==========================================================
-- Run once in the Supabase SQL editor (or `supabase db push`).
-- Safe to re-run: every statement is idempotent. Nothing existing is dropped.
--
-- Access model
--   * The table is NOT readable/writable directly by anon/authenticated:
--     student data (minors, guardian phones) never leaks through the public anon key.
--   * All reads/writes go through SECURITY DEFINER RPCs that accept either
--       - a Supabase Auth administrator (public.is_admin()), or
--       - a legacy dashboard administrator (public.system_admins) holding a
--         short-lived session token issued by mahaja_students_issue_token().
--   * Photos live in the public bucket `mahaja-students` under random UUID names.
-- ==========================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- is_admin() already exists in the project; create it only if missing.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE $f$
      CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = public, pg_temp
      AS 'SELECT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid())';
    $f$;
    GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
  END IF;
END $$;

-- ----------------------------------------------------------
-- 1. Students table
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mahaja_students (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_number  BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  full_name       TEXT NOT NULL,
  guardian_name   TEXT NOT NULL,
  guardian_phone  TEXT NOT NULL,
  age             INTEGER NOT NULL,
  address         TEXT NOT NULL,
  quran_ahzab     INTEGER NOT NULL DEFAULT 0,
  photo_url       TEXT,
  photo_path      TEXT,
  notes           TEXT,
  created_by      TEXT,
  updated_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mahaja_students_full_name_len   CHECK (char_length(btrim(full_name)) BETWEEN 3 AND 120),
  CONSTRAINT mahaja_students_guardian_len    CHECK (char_length(btrim(guardian_name)) BETWEEN 3 AND 120),
  CONSTRAINT mahaja_students_phone_format    CHECK (guardian_phone ~ '^\+?[0-9]{6,15}$'),
  CONSTRAINT mahaja_students_age_range       CHECK (age BETWEEN 3 AND 100),
  CONSTRAINT mahaja_students_address_len     CHECK (char_length(btrim(address)) BETWEEN 2 AND 160),
  CONSTRAINT mahaja_students_ahzab_range     CHECK (quran_ahzab BETWEEN 0 AND 60)
);

-- Prevents accidental double registration of the same student.
CREATE UNIQUE INDEX IF NOT EXISTS mahaja_students_unique_student
  ON public.mahaja_students (lower(btrim(full_name)), guardian_phone);
CREATE INDEX IF NOT EXISTS mahaja_students_created_at_idx ON public.mahaja_students (created_at DESC);
CREATE INDEX IF NOT EXISTS mahaja_students_address_idx    ON public.mahaja_students (address);

CREATE OR REPLACE FUNCTION public.mahaja_students_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS mahaja_students_touch ON public.mahaja_students;
CREATE TRIGGER mahaja_students_touch BEFORE UPDATE ON public.mahaja_students
  FOR EACH ROW EXECUTE FUNCTION public.mahaja_students_touch_updated_at();

ALTER TABLE public.mahaja_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS mahaja_students_admins ON public.mahaja_students;
CREATE POLICY mahaja_students_admins ON public.mahaja_students FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.mahaja_students FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mahaja_students TO authenticated;

-- ----------------------------------------------------------
-- 2. Session tokens for legacy (system_admins) dashboard logins
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mahaja_admin_tokens (
  token_hash  TEXT PRIMARY KEY,
  admin_id    UUID NOT NULL,
  username    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.mahaja_admin_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mahaja_admin_tokens FROM anon, authenticated;

-- Returns the acting administrator's label, or raises if the caller is not an admin.
CREATE OR REPLACE FUNCTION public.mahaja_students_require_admin(p_token TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_username TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_admin() THEN
    RETURN 'auth:' || auth.uid()::text;
  END IF;
  IF p_token IS NOT NULL AND length(p_token) >= 32 THEN
    SELECT t.username INTO v_username
      FROM public.mahaja_admin_tokens t
      JOIN public.system_admins a ON a.id = t.admin_id AND a.is_active
     WHERE t.token_hash = encode(digest(p_token, 'sha256'), 'hex')
       AND t.expires_at > now();
    IF v_username IS NOT NULL THEN RETURN v_username; END IF;
  END IF;
  RAISE EXCEPTION 'MAHAJA_UNAUTHORIZED' USING ERRCODE = '42501';
END $$;
REVOKE ALL ON FUNCTION public.mahaja_students_require_admin(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mahaja_students_issue_token(p_username TEXT, p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_admin RECORD; v_token TEXT; v_expires TIMESTAMPTZ := now() + interval '7 days';
BEGIN
  SELECT id, username, password_hash, is_active INTO v_admin
    FROM public.system_admins WHERE username = btrim(p_username);
  IF NOT FOUND OR NOT v_admin.is_active OR v_admin.password_hash <> crypt(p_password, v_admin.password_hash) THEN
    RETURN json_build_object('success', false);
  END IF;
  DELETE FROM public.mahaja_admin_tokens WHERE expires_at < now();
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.mahaja_admin_tokens (token_hash, admin_id, username, expires_at)
  VALUES (encode(digest(v_token, 'sha256'), 'hex'), v_admin.id, v_admin.username, v_expires);
  RETURN json_build_object('success', true, 'token', v_token, 'expires_at', v_expires);
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_students_revoke_token(p_token TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$ DELETE FROM public.mahaja_admin_tokens WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex'); $$;

-- Lightweight check so the UI knows whether a stored token is still valid.
CREATE OR REPLACE FUNCTION public.mahaja_students_check_access(p_token TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.mahaja_students_require_admin(p_token);
  RETURN true;
EXCEPTION WHEN insufficient_privilege THEN
  RETURN false;
END $$;

-- ----------------------------------------------------------
-- 3. CRUD RPCs
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mahaja_students_list(p_token TEXT DEFAULT NULL)
RETURNS SETOF public.mahaja_students LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.mahaja_students_require_admin(p_token);
  RETURN QUERY SELECT * FROM public.mahaja_students ORDER BY created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_students_get(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS public.mahaja_students LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_row public.mahaja_students;
BEGIN
  PERFORM public.mahaja_students_require_admin(p_token);
  SELECT * INTO v_row FROM public.mahaja_students WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_students_create(p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS public.mahaja_students LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_actor TEXT; v_row public.mahaja_students;
BEGIN
  v_actor := public.mahaja_students_require_admin(p_token);
  INSERT INTO public.mahaja_students
    (full_name, guardian_name, guardian_phone, age, address, quran_ahzab, photo_url, photo_path, notes, created_by, updated_by)
  VALUES (
    btrim(p_data->>'full_name'),
    btrim(p_data->>'guardian_name'),
    regexp_replace(coalesce(p_data->>'guardian_phone', ''), '[\s\-()]', '', 'g'),
    (p_data->>'age')::int,
    btrim(p_data->>'address'),
    coalesce((p_data->>'quran_ahzab')::int, 0),
    nullif(p_data->>'photo_url', ''),
    nullif(p_data->>'photo_path', ''),
    nullif(btrim(coalesce(p_data->>'notes', '')), ''),
    v_actor, v_actor)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

-- Only keys present in p_data are changed.
CREATE OR REPLACE FUNCTION public.mahaja_students_update(p_id UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS public.mahaja_students LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_actor TEXT; v_row public.mahaja_students;
BEGIN
  v_actor := public.mahaja_students_require_admin(p_token);
  UPDATE public.mahaja_students SET
    full_name      = CASE WHEN p_data ? 'full_name'      THEN btrim(p_data->>'full_name') ELSE full_name END,
    guardian_name  = CASE WHEN p_data ? 'guardian_name'  THEN btrim(p_data->>'guardian_name') ELSE guardian_name END,
    guardian_phone = CASE WHEN p_data ? 'guardian_phone' THEN regexp_replace(p_data->>'guardian_phone', '[\s\-()]', '', 'g') ELSE guardian_phone END,
    age            = CASE WHEN p_data ? 'age'            THEN (p_data->>'age')::int ELSE age END,
    address        = CASE WHEN p_data ? 'address'        THEN btrim(p_data->>'address') ELSE address END,
    quran_ahzab    = CASE WHEN p_data ? 'quran_ahzab'    THEN (p_data->>'quran_ahzab')::int ELSE quran_ahzab END,
    photo_url      = CASE WHEN p_data ? 'photo_url'      THEN nullif(p_data->>'photo_url', '') ELSE photo_url END,
    photo_path     = CASE WHEN p_data ? 'photo_path'     THEN nullif(p_data->>'photo_path', '') ELSE photo_path END,
    notes          = CASE WHEN p_data ? 'notes'          THEN nullif(btrim(coalesce(p_data->>'notes', '')), '') ELSE notes END,
    updated_by     = v_actor
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN v_row;
END $$;

-- Returns the deleted row so the client can remove the stored photo.
CREATE OR REPLACE FUNCTION public.mahaja_students_delete(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS public.mahaja_students LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_row public.mahaja_students;
BEGIN
  PERFORM public.mahaja_students_require_admin(p_token);
  DELETE FROM public.mahaja_students WHERE id = p_id RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN v_row;
END $$;

DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.mahaja_students_issue_token(text, text)',
    'public.mahaja_students_revoke_token(text)',
    'public.mahaja_students_check_access(text)',
    'public.mahaja_students_list(text)',
    'public.mahaja_students_get(uuid, text)',
    'public.mahaja_students_create(jsonb, text)',
    'public.mahaja_students_update(uuid, jsonb, text)',
    'public.mahaja_students_delete(uuid, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
END $$;

-- ----------------------------------------------------------
-- 4. Storage bucket for student photos
-- ----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('mahaja-students', 'mahaja-students', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Legacy dashboard admins have no Supabase Auth session, so uploads/deletes must be
-- allowed for anon as well; they are confined to this bucket's `students/` folder.
-- Once every admin signs in through Supabase Auth, change `anon, authenticated`
-- below to `authenticated` and add `AND public.is_admin()` to tighten this.
DROP POLICY IF EXISTS mahaja_students_photos_select ON storage.objects;
DROP POLICY IF EXISTS mahaja_students_photos_insert ON storage.objects;
DROP POLICY IF EXISTS mahaja_students_photos_delete ON storage.objects;
CREATE POLICY mahaja_students_photos_select ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'mahaja-students' AND (storage.foldername(name))[1] = 'students');
CREATE POLICY mahaja_students_photos_insert ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'mahaja-students' AND (storage.foldername(name))[1] = 'students');
CREATE POLICY mahaja_students_photos_delete ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'mahaja-students' AND (storage.foldername(name))[1] = 'students');

COMMIT;

NOTIFY pgrst, 'reload schema';
