-- Protect the existing Supabase Auth administrator membership and legacy records.
-- Apply through the SQL editor/CLI with the database owner. No accounts or content are deleted.
-- Precondition: at least one verified administrator must already be linked in public.admins.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admins) THEN
    RAISE EXCEPTION 'Link a verified existing Auth administrator before applying this migration';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid()); $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Permissive policies combine with OR. Remove all previous policies on these
-- three administration tables before installing the intended boundary.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('admins','system_admins','admin_activity_log')
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename); END LOOP;
END $$;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY admins_read ON public.admins FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
-- Membership assignment remains a server-side operation; no browser may grant itself access.
REVOKE INSERT, UPDATE, DELETE ON public.admins FROM anon, authenticated;
GRANT SELECT ON public.admins TO authenticated;

ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY verified_admins_manage_legacy ON public.system_admins FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY verified_admins_activity ON public.admin_activity_log FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Legacy password checks are not a replacement for a Supabase Auth session.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT oid::regprocedure AS signature FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname IN ('verify_admin_login','check_admin_password')
  LOOP EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', p.signature); END LOOP;
END $$;
COMMIT;
