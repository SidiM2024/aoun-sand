-- ==========================================================
-- تأمين الموقع: صلاحيات الخادم، إغلاق الجداول المفتوحة، تحديد محاولات الدخول
-- Security hardening: server-side authorization for every direct table access,
-- closing tables that were writable by anyone, fixing admin functions that did not
-- check the caller, rate limiting of logins, shorter admin sessions.
-- ==========================================================
-- Requires 20261008000000 (admin sessions). Safe to re-run. No row of data is deleted.
--
-- IMPORTANT (order): publish the website update FIRST, then run this file.
-- The new website sends the dashboard session in the «x-admin-token» header; the
-- policies below rely on it to recognise dashboard admins (who have no Supabase login).
--
-- Findings fixed here:
--  * finance / patients / notifications / polls / competitions / site settings / requests
--    tables accepted inserts, updates and deletes from anyone holding the public anon key;
--  * admin_update_user_status and admin_delete_user ignored their «admin_secret»
--    (anyone could approve, suspend or delete any member);
--  * admin_get_all_* / admin_update_* trusted an admin id passed by the browser;
--  * update_user_mahaja_progress let anyone write another member's progress;
--  * members could change their own approval status by updating their row;
--  * dashboard logins could be brute-forced (no attempt limit).
-- ==========================================================

BEGIN;

-- ----------------------------------------------------------
-- 1. Who is calling? (request headers are set by PostgREST)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_header(p_name TEXT)
RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN nullif(btrim(current_setting('request.headers', true)::json ->> lower(p_name)), '');
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.request_ip()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT coalesce(public.request_header('cf-connecting-ip'), public.request_header('x-real-ip'),
                  nullif(btrim(split_part(coalesce(public.request_header('x-forwarded-for'), ''), ',', 1)), ''), 'unknown');
$$;

-- True when the request comes from a dashboard admin allowed to use p_section
-- (Super Admin: everything; Supabase Auth admins count as Super Admin).
CREATE OR REPLACE FUNCTION public.admin_can(p_section TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v JSONB;
BEGIN
  v := public.admin_resolve(public.request_header('x-admin-token'));
  RETURN v IS NOT NULL AND (p_section IS NULL OR (v->>'is_super')::BOOLEAN OR (v->'sections') ? p_section);
END $$;

CREATE OR REPLACE FUNCTION public.admin_can_any(p_sections TEXT[])
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v JSONB;
BEGIN
  v := public.admin_resolve(public.request_header('x-admin-token'));
  RETURN v IS NOT NULL AND ((v->>'is_super')::BOOLEAN OR (v->'sections') ?| p_sections);
END $$;

CREATE OR REPLACE FUNCTION public.admin_require(p_sections TEXT[])
RETURNS VOID LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NOT public.admin_can_any(p_sections) THEN RAISE EXCEPTION 'ADMIN_FORBIDDEN' USING ERRCODE = '42501'; END IF;
END $$;


-- Replaces a function even when an older version used different parameter names.
CREATE OR REPLACE FUNCTION public.sec_replace_function(p_signature TEXT, p_sql TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN invalid_function_definition OR duplicate_function THEN
    EXECUTE format('DROP FUNCTION IF EXISTS %s', p_signature);
    EXECUTE p_sql;
  END;
END $$;
REVOKE ALL ON FUNCTION public.sec_replace_function(text, text) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------
-- 2. Rate limiting (failed logins, account lookups)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_attempts (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket      TEXT NOT NULL,
  key         TEXT NOT NULL,
  ip          TEXT NOT NULL,
  success     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_attempts_key_idx ON public.security_attempts (bucket, key, created_at);
CREATE INDEX IF NOT EXISTS security_attempts_ip_idx ON public.security_attempts (bucket, ip, created_at);
ALTER TABLE public.security_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_attempts FROM anon, authenticated;

-- True when the key (e.g. a username) or the caller's IP has too many failures in the window.
CREATE OR REPLACE FUNCTION public.security_blocked(p_bucket TEXT, p_key TEXT, p_max_key INT, p_max_ip INT, p_window INTERVAL)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT (SELECT count(*) FROM public.security_attempts
           WHERE bucket = p_bucket AND key = lower(coalesce(p_key, '')) AND NOT success AND created_at > now() - p_window) >= p_max_key
      OR (public.request_ip() <> 'unknown' AND
          (SELECT count(*) FROM public.security_attempts
            WHERE bucket = p_bucket AND ip = public.request_ip() AND NOT success AND created_at > now() - p_window) >= p_max_ip);
$$;

CREATE OR REPLACE FUNCTION public.security_record(p_bucket TEXT, p_key TEXT, p_success BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_success THEN
    DELETE FROM public.security_attempts WHERE bucket = p_bucket AND key = lower(coalesce(p_key, '')) AND NOT success;
  ELSE
    INSERT INTO public.security_attempts (bucket, key, ip, success) VALUES (p_bucket, lower(coalesce(p_key, '')), public.request_ip(), false);
  END IF;
  DELETE FROM public.security_attempts WHERE created_at < now() - interval '2 days';
END $$;

-- Dashboard login: 5 failures per username or 20 per IP within 15 minutes → locked for 15 minutes.
-- Sessions now last 3 days (was 14).
CREATE OR REPLACE FUNCTION public.admin_login(p_username TEXT, p_password TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_admin RECORD; v_token TEXT; v_user TEXT := btrim(coalesce(p_username, ''));
BEGIN
  IF public.security_blocked('admin_login', v_user, 5, 20, interval '15 minutes') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Too many attempts', 'locked', true);
  END IF;
  SELECT id, password_hash, is_active INTO v_admin FROM public.system_admins WHERE username = v_user;
  IF NOT FOUND OR v_admin.password_hash IS NULL OR p_password IS NULL
     OR v_admin.password_hash IS DISTINCT FROM crypt(p_password, v_admin.password_hash) THEN
    PERFORM public.security_record('admin_login', v_user, false);
    RETURN jsonb_build_object('success', false, 'message', 'Invalid credentials');
  END IF;
  IF v_admin.is_active IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account is disabled');
  END IF;
  PERFORM public.security_record('admin_login', v_user, true);

  DELETE FROM public.admin_sessions WHERE expires_at < now();
  v_token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.admin_sessions (token_hash, admin_id, expires_at)
  VALUES (public.admin_token_hash(v_token), v_admin.id, now() + interval '3 days');
  UPDATE public.system_admins SET last_login = now() WHERE id = v_admin.id;
  BEGIN
    INSERT INTO public.admin_activity_log (admin_id, action, details)
    VALUES (v_admin.id, 'login', jsonb_build_object('method', 'session', 'ip', public.request_ip()));
  EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
  END;
  RETURN jsonb_build_object('success', true, 'token', v_token, 'admin', public.admin_resolve(v_token));
END $$;

-- Older login function (kept for compatibility): same attempt limit; no token, no data.
DROP FUNCTION IF EXISTS public.verify_admin_login(text, text);
CREATE FUNCTION public.verify_admin_login(p_username TEXT, p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_admin RECORD; v_user TEXT := btrim(coalesce(p_username, ''));
BEGIN
  IF public.security_blocked('admin_login', v_user, 5, 20, interval '15 minutes') THEN
    RETURN json_build_object('success', false, 'message', 'Too many attempts');
  END IF;
  SELECT id, username, password_hash, role, permissions, is_active INTO v_admin FROM public.system_admins WHERE username = v_user;
  IF NOT FOUND OR p_password IS NULL OR v_admin.password_hash IS DISTINCT FROM crypt(p_password, v_admin.password_hash) THEN
    PERFORM public.security_record('admin_login', v_user, false);
    RETURN json_build_object('success', false, 'message', 'Invalid credentials');
  END IF;
  IF v_admin.is_active IS NOT TRUE THEN RETURN json_build_object('success', false, 'message', 'Account is disabled'); END IF;
  PERFORM public.security_record('admin_login', v_user, true);
  RETURN json_build_object('success', true, 'admin', json_build_object(
    'id', v_admin.id, 'username', v_admin.username, 'role', v_admin.role, 'permissions', v_admin.permissions));
END $$;

-- A password change or deactivation ends that admin's open sessions.
CREATE OR REPLACE FUNCTION public.system_admins_end_sessions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    DELETE FROM public.admin_sessions WHERE admin_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS system_admins_end_sessions ON public.system_admins;
CREATE TRIGGER system_admins_end_sessions AFTER UPDATE ON public.system_admins
  FOR EACH ROW EXECUTE FUNCTION public.system_admins_end_sessions();

-- Account lookups used by the sign-in / sign-up forms: 30 per IP per 10 minutes.
CREATE OR REPLACE FUNCTION public.member_account_status(p_email TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF public.security_blocked('account_lookup', 'ip', 1000000, 30, interval '10 minutes') THEN
    RETURN 'active'; -- reveal nothing once the limit is reached
  END IF;
  PERFORM public.security_record('account_lookup', 'ip', false);
  RETURN coalesce((
    SELECT CASE WHEN a.email_confirmed_at IS NULL THEN 'unconfirmed' ELSE 'active' END
      FROM auth.users a WHERE lower(a.email) = lower(btrim(p_email))
     ORDER BY a.created_at LIMIT 1), 'none');
END $$;

CREATE OR REPLACE FUNCTION public.member_check_available(p_email TEXT, p_phone TEXT DEFAULT NULL, p_national_id TEXT DEFAULT NULL, p_is_mahaja BOOLEAN DEFAULT false)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF public.security_blocked('account_lookup', 'ip', 1000000, 30, interval '10 minutes') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = '54000';
  END IF;
  PERFORM public.security_record('account_lookup', 'ip', false);
  RETURN jsonb_build_object(
    'email_taken', EXISTS (SELECT 1 FROM auth.users a WHERE lower(a.email) = lower(btrim(p_email)))
                   OR EXISTS (SELECT 1 FROM public.users u WHERE lower(u.email) = lower(btrim(p_email))),
    'phone_taken', NOT p_is_mahaja AND length(public.normalize_phone(p_phone)) = 8
                   AND EXISTS (SELECT 1 FROM public.users u
                                WHERE public.normalize_phone(u.phone) = public.normalize_phone(p_phone)
                                  AND coalesce(u.is_mahaja, false) = false AND u.phone <> '20000000'),
    'national_id_taken', NOT p_is_mahaja AND length(btrim(coalesce(p_national_id, ''))) >= 4
                   AND EXISTS (SELECT 1 FROM public.users u
                                WHERE btrim(u.national_id) = btrim(p_national_id) AND coalesce(u.is_mahaja, false) = false));
END $$;

-- ----------------------------------------------------------
-- 3. Admin functions that did not check the caller
-- ----------------------------------------------------------
-- (Signatures unchanged so the current dashboard keeps working; the old «admin_secret» /
--  «p_admin_id» arguments are ignored: the server session decides.)
DO $$ BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    PERFORM public.sec_replace_function('public.admin_update_user_status(uuid, text, text)', $f$
    CREATE OR REPLACE FUNCTION public.admin_update_user_status(target_user_id UUID, new_status TEXT, admin_secret TEXT)
    RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $b$
    BEGIN
      PERFORM public.admin_require(ARRAY['approvals', 'users']);
      IF new_status NOT IN ('Approved', 'Pending Approval', 'Rejected', 'Suspended') THEN
        RAISE EXCEPTION 'BAD_STATUS' USING ERRCODE = '22023';
      END IF;
      PERFORM set_config('app.bypass_admin_check', 'true', true);
      UPDATE public.users SET approval_status = new_status WHERE id = target_user_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'User not found or update failed'; END IF;
    END $b$;
    $f$);
    PERFORM public.sec_replace_function('public.admin_delete_user(uuid, text)', $f$
    CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID, admin_secret TEXT)
    RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $b$
    BEGIN
      PERFORM public.admin_require(ARRAY['users']);
      DELETE FROM public.users WHERE id = target_user_id;
      DELETE FROM auth.users WHERE id = target_user_id;
    END $b$;
    $f$);
  END IF;
END $$;

DO $$
DECLARE r RECORD;
BEGIN
  -- table, section, list function, update function, id argument
  FOR r IN SELECT * FROM (VALUES
      ('user_requests', 'requests', 'admin_get_all_requests', 'admin_update_request_status', 'p_request_id'),
      ('user_payments', 'requests', 'admin_get_all_payments', 'admin_update_payment_status', 'p_payment_id'),
      ('user_memberships', 'memberships', 'admin_get_all_memberships', 'admin_update_membership_status', 'p_membership_id'),
      ('user_donations', 'user_donations', 'admin_get_all_donations', 'admin_update_donation_status', 'p_donation_id')
    ) AS t(tbl, section, list_fn, update_fn, id_arg)
  LOOP
    CONTINUE WHEN to_regclass('public.' || r.tbl) IS NULL;
    PERFORM public.sec_replace_function(format('public.%I(uuid)', r.list_fn), format($f$
      CREATE OR REPLACE FUNCTION public.%1$I(p_admin_id UUID)
      RETURNS SETOF public.%2$I LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $b$
      BEGIN
        PERFORM public.admin_require(ARRAY[%3$L]);
        RETURN QUERY SELECT * FROM public.%2$I ORDER BY created_at DESC;
      END $b$;
    $f$, r.list_fn, r.tbl, r.section));
    IF r.update_fn = 'admin_update_request_status' THEN
      PERFORM public.sec_replace_function('public.admin_update_request_status(uuid, uuid, text, numeric)', $f$
        CREATE OR REPLACE FUNCTION public.admin_update_request_status(p_admin_id UUID, p_request_id UUID, p_status TEXT, p_approved_amount NUMERIC DEFAULT NULL)
        RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $b$
        BEGIN
          IF NOT public.admin_can_any(ARRAY['requests']) THEN RETURN json_build_object('success', false, 'message', 'Unauthorized'); END IF;
          IF p_status NOT IN ('pending', 'approved', 'rejected') THEN RETURN json_build_object('success', false, 'message', 'Invalid status'); END IF;
          UPDATE public.user_requests SET status = p_status, approved_amount = COALESCE(p_approved_amount, approved_amount), updated_at = now()
           WHERE id = p_request_id;
          RETURN json_build_object('success', true, 'message', 'Status updated successfully');
        END $b$;
      $f$);
    ELSE
      PERFORM public.sec_replace_function(format('public.%I(uuid, uuid, text)', r.update_fn), format($f$
        CREATE OR REPLACE FUNCTION public.%1$I(p_admin_id UUID, %2$I UUID, p_status TEXT)
        RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $b$
        BEGIN
          IF NOT public.admin_can_any(ARRAY[%3$L]) THEN RETURN json_build_object('success', false, 'message', 'Unauthorized'); END IF;
          IF p_status NOT IN ('pending', 'approved', 'rejected') THEN RETURN json_build_object('success', false, 'message', 'Invalid status'); END IF;
          UPDATE public.%4$I SET status = p_status, updated_at = now() WHERE id = %2$I;
          RETURN json_build_object('success', true, 'message', 'Status updated');
        END $b$;
      $f$, r.update_fn, r.id_arg, r.section, r.tbl));
    END IF;
  END LOOP;
END $$;

-- A member can only save their own course progress.
DO $$ BEGIN
  IF to_regclass('public.mahaja_user_progress') IS NOT NULL THEN
    PERFORM public.sec_replace_function('public.update_user_mahaja_progress(uuid, uuid, uuid, jsonb, numeric)', $f$
    CREATE OR REPLACE FUNCTION public.update_user_mahaja_progress(p_user_id UUID, p_course_id UUID, p_lesson_id UUID, p_completed_lessons JSONB, p_percentage NUMERIC)
    RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $b$
    BEGIN
      IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
      INSERT INTO public.mahaja_user_progress (user_id, course_id, last_lesson_id, completed_lessons, progress_percentage)
      VALUES (p_user_id, p_course_id, p_lesson_id, p_completed_lessons, p_percentage)
      ON CONFLICT (user_id, course_id) DO UPDATE SET
        last_lesson_id = p_lesson_id, completed_lessons = p_completed_lessons, progress_percentage = p_percentage, updated_at = now();
    END $b$;
    $f$);
  END IF;
END $$;

-- ----------------------------------------------------------
-- 4. Members cannot approve themselves
-- ----------------------------------------------------------
-- Not SECURITY DEFINER on purpose: current_user must be the caller's role (anon / authenticated).
CREATE OR REPLACE FUNCTION public.users_guard_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions, pg_temp AS $$
DECLARE v_trusted BOOLEAN;
BEGIN
  -- Trusted: database functions / service role, approval RPC, dashboard admins, Supabase Auth admins.
  v_trusted := current_user NOT IN ('anon', 'authenticated')
            OR current_setting('app.bypass_admin_check', true) = 'true'
            OR public.admin_can_any(ARRAY['users', 'approvals', 'memberships'])
            OR coalesce(public.is_admin(), false);
  IF v_trusted THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.approval_status := 'Pending Approval';
  ELSIF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    NEW.approval_status := OLD.approval_status;
  END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS users_guard_status ON public.users;
    CREATE TRIGGER users_guard_status BEFORE INSERT OR UPDATE ON public.users
      FOR EACH ROW EXECUTE FUNCTION public.users_guard_status();
  END IF;
END $$;

-- ----------------------------------------------------------
-- 5. Row Level Security for every table the website reads or writes directly
-- ----------------------------------------------------------
-- Existing policies on these tables are replaced by the rules below:
--   P = everyone may read, A(x) = dashboard admin with section x, O = the member's own rows.
CREATE OR REPLACE FUNCTION public.sec_reset_table(p_table TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE pol RECORD;
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN RETURN false; END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, p_table);
  END LOOP;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', p_table);
  -- Dashboard admins have no Supabase login (role anon); the policies decide what is allowed.
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', p_table);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.sec_has_column(p_table TEXT, p_column TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = p_table AND column_name = p_column);
$$;

-- p_read: SQL condition for SELECT; p_write: condition for INSERT/UPDATE/DELETE;
-- p_insert: optional separate condition for INSERT (members creating their own rows).
CREATE OR REPLACE FUNCTION public.sec_apply(p_table TEXT, p_read TEXT, p_write TEXT, p_insert TEXT DEFAULT NULL, p_update TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.sec_reset_table(p_table) THEN RETURN; END IF;
  EXECUTE format('CREATE POLICY sec_read ON public.%I FOR SELECT TO anon, authenticated USING (%s)', p_table, p_read);
  EXECUTE format('CREATE POLICY sec_insert ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (%s)', p_table, coalesce(p_insert, p_write));
  EXECUTE format('CREATE POLICY sec_update ON public.%1$I FOR UPDATE TO anon, authenticated USING (%2$s) WITH CHECK (%2$s)', p_table, coalesce(p_update, p_write));
  EXECUTE format('CREATE POLICY sec_delete ON public.%I FOR DELETE TO anon, authenticated USING (%s)', p_table, p_write);
END $$;

DO $$
DECLARE
  fin TEXT := '(SELECT public.admin_can_any(ARRAY[''finance'',''memberships'',''user_donations'',''donations'']))';
  own TEXT := '(user_id = auth.uid())';
  t TEXT;
BEGIN
  -- Finance (internal). The public totals come from public_home_stats() (unchanged).
  FOREACH t IN ARRAY ARRAY['membership_revenues', 'membership_expenses', 'donation_revenues', 'daily_donation_stats'] LOOP
    PERFORM public.sec_apply(t, fin, fin);
  END LOOP;
  -- Donation expenses stay public (transparency page), only admins edit them.
  PERFORM public.sec_apply('donation_expenses', 'true', fin);

  -- Patients: health data, dashboard only.
  PERFORM public.sec_apply('patients', '(SELECT public.admin_can(''patients''))', '(SELECT public.admin_can(''patients''))');
  PERFORM public.sec_apply('patient_services', '(SELECT public.admin_can(''patients''))', '(SELECT public.admin_can(''patients''))');

  -- Public content edited from the dashboard.
  PERFORM public.sec_apply('notifications', 'true', '(SELECT public.admin_can(''notifications''))');
  PERFORM public.sec_apply('polls', 'true', '(SELECT public.admin_can(''voting''))');
  PERFORM public.sec_apply('poll_options', 'true', '(SELECT public.admin_can(''voting''))');
  PERFORM public.sec_apply('competitions', 'true', '(SELECT public.admin_can(''competitions''))');
  PERFORM public.sec_apply('media', 'true', '(SELECT public.admin_can(''media''))');
  PERFORM public.sec_apply('site_settings', 'true', '(SELECT public.admin_can_any(ARRAY[''donations'',''homepage'']))');
  PERFORM public.sec_apply('payment_methods', 'true', '(SELECT public.admin_can_any(ARRAY[''requests'',''finance'']))');

  -- Old polls: members vote for themselves; admins remove votes with a poll.
  IF public.sec_has_column('poll_votes', 'user_id') THEN
    PERFORM public.sec_apply('poll_votes', 'true', '(SELECT public.admin_can(''voting''))', own, 'false');
  END IF;

  -- Members' requests: own rows; the matching dashboard section sees and updates all.
  IF public.sec_has_column('user_requests', 'user_id') THEN
    PERFORM public.sec_apply('user_requests', own || ' OR (SELECT public.admin_can(''requests''))', '(SELECT public.admin_can(''requests''))', own);
  END IF;
  IF public.sec_has_column('user_payments', 'user_id') THEN
    PERFORM public.sec_apply('user_payments', own || ' OR (SELECT public.admin_can(''requests''))', '(SELECT public.admin_can(''requests''))', own);
  END IF;
  IF public.sec_has_column('user_memberships', 'user_id') THEN
    PERFORM public.sec_apply('user_memberships', own || ' OR (SELECT public.admin_can(''memberships''))', '(SELECT public.admin_can(''memberships''))', own);
  END IF;
  IF public.sec_has_column('user_donations', 'user_id') THEN
    PERFORM public.sec_apply('user_donations', own || ' OR (SELECT public.admin_can(''user_donations''))', '(SELECT public.admin_can(''user_donations''))', own);
  END IF;
  IF public.sec_has_column('membership_cards', 'user_id') THEN
    PERFORM public.sec_apply('membership_cards', own || ' OR (SELECT public.admin_can())', '(SELECT public.admin_can())', own);
  END IF;
  IF public.sec_has_column('push_subscriptions', 'user_id') THEN
    PERFORM public.sec_apply('push_subscriptions', own || ' OR (SELECT public.admin_can(''notifications''))', own || ' OR (SELECT public.admin_can(''notifications''))');
  END IF;

  -- Mahaja courses: readable content, edited by Mahaja admins; progress is per member.
  FOREACH t IN ARRAY ARRAY['mahaja_courses', 'mahaja_lessons', 'mahaja_books'] LOOP
    PERFORM public.sec_apply(t,
      CASE WHEN public.sec_has_column(t, 'is_published') THEN 'is_published OR (SELECT public.admin_can(''mahaja''))' ELSE 'true' END,
      '(SELECT public.admin_can(''mahaja''))');
  END LOOP;
  IF public.sec_has_column('mahaja_user_progress', 'user_id') THEN
    PERFORM public.sec_apply('mahaja_user_progress', own || ' OR (SELECT public.admin_can(''mahaja''))', own);
  END IF;

  -- Members' profiles: each member their own row; any dashboard admin reads; user admins edit.
  IF to_regclass('public.users') IS NOT NULL THEN
    PERFORM public.sec_apply('users',
      '(id = auth.uid()) OR (SELECT public.admin_can())',
      '(SELECT public.admin_can(''users''))',
      '(id = auth.uid()) OR (SELECT public.admin_can(''users''))',
      '(id = auth.uid()) OR (SELECT public.admin_can_any(ARRAY[''users'',''approvals'',''memberships'']))');
  END IF;
END $$;

-- ----------------------------------------------------------
-- 6. Grants
-- ----------------------------------------------------------
DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.security_blocked(text, text, integer, integer, interval)', 'public.security_record(text, text, boolean)',
    'public.sec_reset_table(text)', 'public.sec_apply(text, text, text, text, text)', 'public.system_admins_end_sessions()',
    'public.users_guard_status()', 'public.admin_require(text[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
  -- Used inside policies, so the calling roles must be able to execute them (they only answer
  -- "may the current request do this?").
  FOREACH f IN ARRAY ARRAY['public.admin_can(text)', 'public.admin_can_any(text[])', 'public.request_header(text)', 'public.request_ip()'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY['public.admin_login(text, text)', 'public.verify_admin_login(text, text)',
                           'public.member_account_status(text)', 'public.member_check_available(text, text, text, boolean)'] LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
  END LOOP;
END $$;

-- Functions whose old versions are callable by anyone but are only for the dashboard.
DO $$ DECLARE f TEXT; BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.admin_update_user_status(uuid, text, text)', 'public.admin_delete_user(uuid, text)',
    'public.admin_get_all_requests(uuid)', 'public.admin_get_all_payments(uuid)', 'public.admin_get_all_memberships(uuid)',
    'public.admin_get_all_donations(uuid)', 'public.admin_update_request_status(uuid, uuid, text, numeric)',
    'public.admin_update_payment_status(uuid, uuid, text)', 'public.admin_update_membership_status(uuid, uuid, text)',
    'public.admin_update_donation_status(uuid, uuid, text)', 'public.update_user_mahaja_progress(uuid, uuid, uuid, jsonb, numeric)'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', f);
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
  END LOOP;
END $$;

COMMIT;

-- ----------------------------------------------------------
-- 7. No email confirmation: accounts are active immediately (re-applied; see 20261021).
--    Note: this does not prove that the member owns the address. Password reset links are
--    still sent to that address, so its real owner can always take the account back.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_confirm_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := now();
  END IF;
  RETURN NEW;
END $$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS auto_confirm_new_user ON auth.users;
  CREATE TRIGGER auto_confirm_new_user BEFORE INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_new_user();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'No permission on auth.users: turn off "Confirm email" in Authentication > Sign In / Providers > Email.';
END $$;

DO $$ BEGIN
  UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL AND email IS NOT NULL;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'No permission on auth.users: confirm the accounts from Authentication > Users instead.';
END $$;

NOTIFY pgrst, 'reload schema';
