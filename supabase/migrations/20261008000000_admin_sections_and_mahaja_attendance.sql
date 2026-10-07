-- ==========================================================
-- صلاحيات المشرفين حسب الأقسام + تطوير إدارة طلاب المحجة البيضاء
-- Admin section permissions + Mahaja students attendance / notes / history
-- ==========================================================
-- Requires 20261007000000_mahaja_students.sql to have been run first.
-- Safe to re-run. No existing rows or columns are dropped.
--
-- What this changes
--   * system_admins gets a `sections` list (which dashboard sections an admin may open)
--     and an optional `display_name`. Existing admins are backfilled from their role.
--   * Dashboard logins now receive a server-side session (admin_sessions). The browser
--     can no longer grant itself admin access or extra sections: every protected RPC
--     re-checks the session, the admin's active flag and sections on each call.
--   * Admin management (add / edit / delete / enable / disable / sections) is done only
--     through RPCs that require a Super Admin. Direct anon access to system_admins
--     (which exposed password hashes) is removed.
--   * Mahaja students: status (active / suspended), timestamped notes, attendance and a
--     history log, all behind the 'mahaja' section.
-- ==========================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$ BEGIN
  IF to_regclass('public.mahaja_students') IS NULL THEN
    RAISE EXCEPTION 'Run 20261007000000_mahaja_students.sql first (شغّل ملف طلاب المحجة البيضاء أولاً)';
  END IF;
  IF to_regclass('public.system_admins') IS NULL THEN
    RAISE EXCEPTION 'public.system_admins is missing';
  END IF;
END $$;

-- ----------------------------------------------------------
-- 1. Sections on system_admins
-- ----------------------------------------------------------
ALTER TABLE public.system_admins ADD COLUMN IF NOT EXISTS sections TEXT[];
ALTER TABLE public.system_admins ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.system_admins ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';

-- Every dashboard section that can be granted. Keep in sync with src/lib/adminSession.ts.
CREATE OR REPLACE FUNCTION public.admin_all_sections()
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['users','approvals','notifications','voting','donations','patients','media',
               'finance','requests','competitions','mahaja','memberships','user_donations']::TEXT[];
$$;

-- Backfill once, from the role each existing admin already has.
UPDATE public.system_admins SET sections = CASE role
    WHEN 'Super Admin'                THEN public.admin_all_sections()
    WHEN 'Finance Admin'              THEN ARRAY['finance','memberships','user_donations']
    WHEN 'Membership Admin'           THEN ARRAY['users','approvals','memberships']
    WHEN 'Patients Admin'             THEN ARRAY['patients']
    WHEN 'Al-Mahajja Al-Baydaa Admin' THEN ARRAY['mahaja']
    WHEN 'Content Admin'              THEN ARRAY['notifications','voting','media','competitions','donations']
    ELSE ARRAY[]::TEXT[]
  END
WHERE sections IS NULL;

-- Lock the table: password hashes must not be readable with the public anon key.
DROP POLICY IF EXISTS "Enable read access for all users" ON public.system_admins;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.system_admins;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.system_admins;
ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verified_admins_manage_legacy ON public.system_admins;
CREATE POLICY verified_admins_manage_legacy ON public.system_admins FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
REVOKE ALL ON public.system_admins FROM anon;

-- ----------------------------------------------------------
-- 2. Server-side admin sessions
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token_hash   TEXT PRIMARY KEY,
  admin_id     UUID NOT NULL REFERENCES public.system_admins(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_admin_idx ON public.admin_sessions (admin_id);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_sessions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_token_hash(p_token TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE
SET search_path = public, extensions, pg_temp
AS $$ SELECT encode(digest(p_token, 'sha256'), 'hex') $$;

-- Who is calling? NULL when not an administrator.
-- Supabase Auth administrators (public.admins) are Super Admins.
CREATE OR REPLACE FUNCTION public.admin_resolve(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v RECORD; v_email TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND public.is_admin() THEN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    RETURN jsonb_build_object(
      'kind', 'auth', 'id', auth.uid(), 'username', coalesce(v_email, auth.uid()::text),
      'label', coalesce(v_email, 'مشرف'), 'role', 'Super Admin', 'is_super', true,
      'sections', to_jsonb(public.admin_all_sections()));
  END IF;
  IF p_token IS NULL OR length(p_token) < 32 THEN RETURN NULL; END IF;
  SELECT a.id, a.username, a.display_name, a.role, coalesce(a.sections, '{}'::TEXT[]) AS sections
    INTO v
    FROM public.admin_sessions s
    JOIN public.system_admins a ON a.id = s.admin_id
   WHERE s.token_hash = public.admin_token_hash(p_token)
     AND s.expires_at > now()
     AND a.is_active IS TRUE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'kind', 'legacy', 'id', v.id, 'username', v.username,
    'label', coalesce(nullif(btrim(v.display_name), ''), v.username),
    'role', v.role, 'is_super', v.role = 'Super Admin',
    'sections', CASE WHEN v.role = 'Super Admin' THEN to_jsonb(public.admin_all_sections()) ELSE to_jsonb(v.sections) END);
END $$;

CREATE OR REPLACE FUNCTION public.admin_require_section(p_token TEXT, p_section TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v JSONB := public.admin_resolve(p_token);
BEGIN
  IF v IS NULL THEN RAISE EXCEPTION 'ADMIN_UNAUTHORIZED' USING ERRCODE = '42501'; END IF;
  IF NOT (v->>'is_super')::BOOLEAN AND NOT ((v->'sections') ? p_section) THEN
    RAISE EXCEPTION 'ADMIN_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.admin_require_super(p_token TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v JSONB := public.admin_resolve(p_token);
BEGIN
  IF v IS NULL THEN RAISE EXCEPTION 'ADMIN_UNAUTHORIZED' USING ERRCODE = '42501'; END IF;
  IF NOT (v->>'is_super')::BOOLEAN THEN RAISE EXCEPTION 'ADMIN_FORBIDDEN' USING ERRCODE = '42501'; END IF;
  RETURN v;
END $$;

-- Dashboard login. Returns a session token and the admin's sections.
CREATE OR REPLACE FUNCTION public.admin_login(p_username TEXT, p_password TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_admin RECORD; v_token TEXT;
BEGIN
  SELECT id, password_hash, is_active INTO v_admin
    FROM public.system_admins WHERE username = btrim(coalesce(p_username, ''));
  IF NOT FOUND OR v_admin.password_hash IS NULL OR p_password IS NULL
     OR v_admin.password_hash IS DISTINCT FROM crypt(p_password, v_admin.password_hash) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid credentials');
  END IF;
  IF v_admin.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account is disabled');
  END IF;

  DELETE FROM public.admin_sessions WHERE expires_at < now();
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.admin_sessions (token_hash, admin_id, expires_at)
  VALUES (public.admin_token_hash(v_token), v_admin.id, now() + interval '14 days');
  UPDATE public.system_admins SET last_login = now() WHERE id = v_admin.id;
  BEGIN
    INSERT INTO public.admin_activity_log (admin_id, action, details)
    VALUES (v_admin.id, 'login', '{"method": "session"}'::jsonb);
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;
  RETURN jsonb_build_object('success', true, 'token', v_token, 'admin', public.admin_resolve(v_token));
END $$;

CREATE OR REPLACE FUNCTION public.admin_session_info(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$ SELECT public.admin_resolve(p_token) $$;

CREATE OR REPLACE FUNCTION public.admin_logout(p_token TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$ DELETE FROM public.admin_sessions WHERE token_hash = public.admin_token_hash(p_token); $$;

-- ----------------------------------------------------------
-- 3. Admin management (Super Admin only)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_clean_sections(p_sections JSONB)
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_agg(DISTINCT s ORDER BY s), '{}'::TEXT[])
    FROM jsonb_array_elements_text(coalesce(p_sections, '[]'::jsonb)) AS s
   WHERE s = ANY (public.admin_all_sections());
$$;

CREATE OR REPLACE FUNCTION public.admin_active_super_count(p_exclude UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT count(*)::int FROM public.system_admins
       WHERE role = 'Super Admin' AND is_active IS TRUE AND id IS DISTINCT FROM p_exclude $$;

CREATE OR REPLACE FUNCTION public.admin_list(p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.admin_require_super(p_token);
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'username', username, 'display_name', display_name, 'role', role,
      'permissions', coalesce(permissions, '{}'::TEXT[]), 'sections', coalesce(sections, '{}'::TEXT[]),
      'is_active', is_active, 'last_login', last_login, 'created_at', created_at, 'updated_at', updated_at)
      ORDER BY created_at DESC)
    FROM public.system_admins), '[]'::jsonb);
END $$;

-- p_id NULL creates an admin. Keys: username, password, display_name, role, permissions, sections.
CREATE OR REPLACE FUNCTION public.admin_save(p_id UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_me JSONB := public.admin_require_super(p_token);
  v_username TEXT := btrim(coalesce(p_data->>'username', ''));
  v_password TEXT := p_data->>'password';
  v_role TEXT := coalesce(nullif(btrim(p_data->>'role'), ''), 'Read Only');
  v_sections TEXT[] := public.admin_clean_sections(p_data->'sections');
  v_permissions TEXT[] := ARRAY(SELECT jsonb_array_elements_text(coalesce(p_data->'permissions', '[]'::jsonb)));
  v_display TEXT := nullif(btrim(coalesce(p_data->>'display_name', '')), '');
  v_old RECORD;
  v_id UUID;
BEGIN
  IF v_username !~ '^[A-Za-z0-9@._+-]{3,64}$' THEN RAISE EXCEPTION 'ADMIN_BAD_USERNAME' USING ERRCODE = '22023'; END IF;
  IF v_password IS NOT NULL AND v_password <> '' AND length(v_password) < 6 THEN RAISE EXCEPTION 'ADMIN_WEAK_PASSWORD' USING ERRCODE = '22023'; END IF;

  IF p_id IS NULL THEN
    IF coalesce(v_password, '') = '' THEN RAISE EXCEPTION 'ADMIN_WEAK_PASSWORD' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.system_admins (username, password_hash, role, permissions, sections, display_name, is_active)
    VALUES (v_username, crypt(v_password, gen_salt('bf')), v_role, v_permissions, v_sections, v_display, true)
    RETURNING id INTO v_id;
  ELSE
    SELECT * INTO v_old FROM public.system_admins WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'ADMIN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF v_old.role = 'Super Admin' AND v_role <> 'Super Admin' AND v_old.is_active IS TRUE
       AND public.admin_active_super_count(p_id) = 0 THEN
      RAISE EXCEPTION 'ADMIN_LAST_SUPER' USING ERRCODE = '22023';
    END IF;
    UPDATE public.system_admins SET
      username = v_username, role = v_role, permissions = v_permissions, sections = v_sections,
      display_name = v_display, updated_at = now(),
      password_hash = CASE WHEN coalesce(v_password, '') <> '' THEN crypt(v_password, gen_salt('bf')) ELSE password_hash END
    WHERE id = p_id
    RETURNING id INTO v_id;
    -- A password change signs the admin out everywhere.
    IF coalesce(v_password, '') <> '' THEN DELETE FROM public.admin_sessions WHERE admin_id = p_id AND (v_me->>'id') IS DISTINCT FROM p_id::text; END IF;
  END IF;

  RETURN (SELECT jsonb_build_object(
    'id', id, 'username', username, 'display_name', display_name, 'role', role,
    'permissions', coalesce(permissions, '{}'::TEXT[]), 'sections', coalesce(sections, '{}'::TEXT[]),
    'is_active', is_active, 'last_login', last_login, 'created_at', created_at, 'updated_at', updated_at)
    FROM public.system_admins WHERE id = v_id);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_active(p_id UUID, p_active BOOLEAN, p_token TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_super(p_token); v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.system_admins WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADMIN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF NOT p_active THEN
    IF (v_me->>'id') = p_id::text THEN RAISE EXCEPTION 'ADMIN_SELF' USING ERRCODE = '22023'; END IF;
    IF v_role = 'Super Admin' AND public.admin_active_super_count(p_id) = 0 THEN RAISE EXCEPTION 'ADMIN_LAST_SUPER' USING ERRCODE = '22023'; END IF;
    DELETE FROM public.admin_sessions WHERE admin_id = p_id;
  END IF;
  UPDATE public.system_admins SET is_active = p_active, updated_at = now() WHERE id = p_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_me JSONB := public.admin_require_super(p_token); v_role TEXT; v_active BOOLEAN;
BEGIN
  SELECT role, is_active INTO v_role, v_active FROM public.system_admins WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADMIN_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF (v_me->>'id') = p_id::text THEN RAISE EXCEPTION 'ADMIN_SELF' USING ERRCODE = '22023'; END IF;
  IF v_role = 'Super Admin' AND v_active IS TRUE AND public.admin_active_super_count(p_id) = 0 THEN
    RAISE EXCEPTION 'ADMIN_LAST_SUPER' USING ERRCODE = '22023';
  END IF;
  BEGIN
    UPDATE public.admin_activity_log SET admin_id = NULL WHERE admin_id = p_id;
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;
  DELETE FROM public.system_admins WHERE id = p_id;
END $$;

-- ----------------------------------------------------------
-- 4. Mahaja RPCs now use the shared session + the 'mahaja' section
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mahaja_students_require_admin(p_token TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v JSONB;
BEGIN
  v := public.admin_resolve(p_token);
  -- Tokens issued by the first students migration remain valid until they expire.
  IF v IS NULL AND p_token IS NOT NULL AND to_regclass('public.mahaja_admin_tokens') IS NOT NULL THEN
    SELECT jsonb_build_object('label', coalesce(nullif(btrim(a.display_name), ''), a.username),
                              'is_super', a.role = 'Super Admin',
                              'sections', to_jsonb(CASE WHEN a.role = 'Super Admin' THEN public.admin_all_sections() ELSE coalesce(a.sections, '{}'::TEXT[]) END))
      INTO v
      FROM public.mahaja_admin_tokens t
      JOIN public.system_admins a ON a.id = t.admin_id AND a.is_active IS TRUE
     WHERE t.token_hash = encode(digest(p_token, 'sha256'), 'hex') AND t.expires_at > now();
  END IF;
  IF v IS NULL THEN RAISE EXCEPTION 'ADMIN_UNAUTHORIZED' USING ERRCODE = '42501'; END IF;
  IF NOT (v->>'is_super')::BOOLEAN AND NOT ((v->'sections') ? 'mahaja') THEN
    RAISE EXCEPTION 'ADMIN_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  RETURN v->>'label';
END $$;

-- Re-verification from the students page issues a normal dashboard session.
CREATE OR REPLACE FUNCTION public.mahaja_students_issue_token(p_username TEXT, p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v JSONB := public.admin_login(p_username, p_password);
BEGIN
  IF (v->>'success')::BOOLEAN THEN
    RETURN json_build_object('success', true, 'token', v->>'token', 'admin', v->'admin');
  END IF;
  RETURN json_build_object('success', false);
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_students_revoke_token(p_token TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  DELETE FROM public.admin_sessions WHERE token_hash = public.admin_token_hash(p_token);
  IF to_regclass('public.mahaja_admin_tokens') IS NOT NULL THEN
    DELETE FROM public.mahaja_admin_tokens WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex');
  END IF;
END $$;

-- ----------------------------------------------------------
-- 5. Students: status, notes, attendance, history
-- ----------------------------------------------------------
ALTER TABLE public.mahaja_students ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.mahaja_students ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE public.mahaja_students ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mahaja_students_status_check') THEN
    ALTER TABLE public.mahaja_students ADD CONSTRAINT mahaja_students_status_check CHECK (status IN ('active', 'suspended'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.mahaja_attendance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES public.mahaja_students(id) ON DELETE CASCADE,
  attendance_date  DATE NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'left_early', 'excused')),
  note             TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  recorded_by      TEXT NOT NULL,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS mahaja_attendance_date_idx ON public.mahaja_attendance (attendance_date);

CREATE TABLE IF NOT EXISTS public.mahaja_student_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES public.mahaja_students(id) ON DELETE CASCADE,
  note        TEXT NOT NULL CHECK (char_length(btrim(note)) BETWEEN 1 AND 1000),
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mahaja_student_notes_student_idx ON public.mahaja_student_notes (student_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.mahaja_student_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id  UUID NOT NULL REFERENCES public.mahaja_students(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mahaja_student_log_student_idx ON public.mahaja_student_log (student_id, created_at DESC);

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['mahaja_attendance', 'mahaja_student_notes', 'mahaja_student_log'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admins', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t || '_admins', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- Create / update now also write the student's history.
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
  INSERT INTO public.mahaja_student_log (student_id, action, details, actor) VALUES (v_row.id, 'created', '{}'::jsonb, v_actor);
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_students_update(p_id UUID, p_data JSONB, p_token TEXT DEFAULT NULL)
RETURNS public.mahaja_students LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_actor TEXT; v_old public.mahaja_students; v_row public.mahaja_students; v_changed TEXT[];
BEGIN
  v_actor := public.mahaja_students_require_admin(p_token);
  SELECT * INTO v_old FROM public.mahaja_students WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
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
  SELECT array_agg(k) INTO v_changed
    FROM unnest(ARRAY['full_name','guardian_name','guardian_phone','age','address','quran_ahzab','photo_path','notes']) AS k
   WHERE to_jsonb(v_old)->k IS DISTINCT FROM to_jsonb(v_row)->k;
  IF v_changed IS NOT NULL THEN
    INSERT INTO public.mahaja_student_log (student_id, action, details, actor)
    VALUES (p_id, 'updated', jsonb_build_object('fields', to_jsonb(v_changed),
            'old_ahzab', v_old.quran_ahzab, 'new_ahzab', v_row.quran_ahzab), v_actor);
  END IF;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_students_set_status(p_id UUID, p_status TEXT, p_reason TEXT DEFAULT NULL, p_token TEXT DEFAULT NULL)
RETURNS public.mahaja_students LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_actor TEXT; v_row public.mahaja_students; v_reason TEXT := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  v_actor := public.mahaja_students_require_admin(p_token);
  IF p_status NOT IN ('active', 'suspended') THEN RAISE EXCEPTION 'MAHAJA_BAD_STATUS' USING ERRCODE = '22023'; END IF;
  UPDATE public.mahaja_students
     SET status = p_status, status_reason = CASE WHEN p_status = 'suspended' THEN v_reason END,
         status_changed_at = now(), updated_by = v_actor
   WHERE id = p_id
  RETURNING * INTO v_row;
  IF NOT FOUND THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.mahaja_student_log (student_id, action, details, actor)
  VALUES (p_id, CASE WHEN p_status = 'suspended' THEN 'suspended' ELSE 'reactivated' END,
          jsonb_build_object('reason', v_reason), v_actor);
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_student_add_note(p_id UUID, p_note TEXT, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_actor TEXT; v_note public.mahaja_student_notes;
BEGIN
  v_actor := public.mahaja_students_require_admin(p_token);
  IF NOT EXISTS (SELECT 1 FROM public.mahaja_students WHERE id = p_id) THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  INSERT INTO public.mahaja_student_notes (student_id, note, created_by)
  VALUES (p_id, btrim(coalesce(p_note, '')), v_actor)
  RETURNING * INTO v_note;
  INSERT INTO public.mahaja_student_log (student_id, action, details, actor)
  VALUES (p_id, 'note_added', jsonb_build_object('note', left(v_note.note, 120)), v_actor);
  RETURN to_jsonb(v_note);
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_student_details(p_id UUID, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.mahaja_students_require_admin(p_token);
  IF NOT EXISTS (SELECT 1 FROM public.mahaja_students WHERE id = p_id) THEN RAISE EXCEPTION 'MAHAJA_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'notes', coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC) FROM public.mahaja_student_notes n WHERE n.student_id = p_id), '[]'::jsonb),
    'attendance', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attendance_date DESC) FROM public.mahaja_attendance a WHERE a.student_id = p_id), '[]'::jsonb),
    'log', coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC)
                       FROM (SELECT * FROM public.mahaja_student_log WHERE student_id = p_id ORDER BY created_at DESC LIMIT 300) l), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.mahaja_attendance_day(p_date DATE, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  PERFORM public.mahaja_students_require_admin(p_token);
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM public.mahaja_attendance a WHERE a.attendance_date = p_date), '[]'::jsonb);
END $$;

-- p_records: [{ "student_id": uuid, "status": "present"|...|null, "note": text }]
-- A null status removes that student's record for the day.
CREATE OR REPLACE FUNCTION public.mahaja_attendance_save(p_date DATE, p_records JSONB, p_token TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_actor TEXT; r JSONB; v_status TEXT; v_note TEXT; v_student UUID; v_prev TEXT;
BEGIN
  v_actor := public.mahaja_students_require_admin(p_token);
  IF p_date IS NULL OR p_date > current_date + 1 OR p_date < DATE '2000-01-01' THEN
    RAISE EXCEPTION 'MAHAJA_BAD_DATE' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_records) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'MAHAJA_BAD_RECORDS' USING ERRCODE = '22023'; END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(p_records) LOOP
    v_student := (r->>'student_id')::UUID;
    v_status := nullif(r->>'status', '');
    v_note := nullif(btrim(coalesce(r->>'note', '')), '');
    SELECT status INTO v_prev FROM public.mahaja_attendance WHERE student_id = v_student AND attendance_date = p_date;

    IF v_status IS NULL THEN
      IF v_prev IS NOT NULL THEN
        DELETE FROM public.mahaja_attendance WHERE student_id = v_student AND attendance_date = p_date;
        INSERT INTO public.mahaja_student_log (student_id, action, details, actor)
        VALUES (v_student, 'attendance_cleared', jsonb_build_object('date', p_date), v_actor);
      END IF;
      CONTINUE;
    END IF;

    INSERT INTO public.mahaja_attendance (student_id, attendance_date, status, note, recorded_by, recorded_at)
    VALUES (v_student, p_date, v_status, v_note, v_actor, now())
    ON CONFLICT (student_id, attendance_date) DO UPDATE
      SET status = EXCLUDED.status, note = EXCLUDED.note, recorded_by = EXCLUDED.recorded_by, recorded_at = now()
      WHERE public.mahaja_attendance.status IS DISTINCT FROM EXCLUDED.status
         OR public.mahaja_attendance.note IS DISTINCT FROM EXCLUDED.note;

    IF v_prev IS DISTINCT FROM v_status THEN
      INSERT INTO public.mahaja_student_log (student_id, action, details, actor)
      VALUES (v_student, 'attendance', jsonb_build_object('date', p_date, 'status', v_status, 'previous', v_prev, 'note', v_note), v_actor);
    END IF;
  END LOOP;

  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM public.mahaja_attendance a WHERE a.attendance_date = p_date), '[]'::jsonb);
END $$;

-- ----------------------------------------------------------
-- 6. Grants
-- ----------------------------------------------------------
DO $$ DECLARE f TEXT; BEGIN
  -- internal helpers: not callable from the browser
  FOREACH f IN ARRAY ARRAY[
    'public.admin_resolve(text)', 'public.admin_require_section(text, text)', 'public.admin_require_super(text)',
    'public.admin_active_super_count(uuid)', 'public.mahaja_students_require_admin(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  -- public RPCs (each one checks the caller itself)
  FOREACH f IN ARRAY ARRAY[
    'public.admin_login(text, text)', 'public.admin_session_info(text)', 'public.admin_logout(text)',
    'public.admin_list(text)', 'public.admin_save(uuid, jsonb, text)', 'public.admin_set_active(uuid, boolean, text)',
    'public.admin_delete(uuid, text)',
    'public.mahaja_students_issue_token(text, text)', 'public.mahaja_students_revoke_token(text)',
    'public.mahaja_students_create(jsonb, text)', 'public.mahaja_students_update(uuid, jsonb, text)',
    'public.mahaja_students_set_status(uuid, text, text, text)', 'public.mahaja_student_add_note(uuid, text, text)',
    'public.mahaja_student_details(uuid, text)', 'public.mahaja_attendance_day(date, text)',
    'public.mahaja_attendance_save(date, jsonb, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
