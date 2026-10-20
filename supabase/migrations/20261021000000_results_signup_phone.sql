-- ==========================================================
-- نتائج الانتخابات للأعضاء + تسجيل بدون تأكيد البريد + التحقق من رقم الهاتف
-- Election results for members, signup without email confirmation, phone validation
-- ==========================================================
-- Requires 20261020000000_site_v2_elections_projects_auth.sql. Safe to re-run.
-- No member, vote or ballot is deleted.
-- ==========================================================

BEGIN;

-- ----------------------------------------------------------
-- 1. Elections: vote counts are shown to members by default
-- ----------------------------------------------------------
-- Results were only returned to members when an admin enabled «إظهار النتائج»
-- (default off). Counts are now visible by default; the admin can still hide them.
ALTER TABLE public.elections ALTER COLUMN results_visible SET DEFAULT true;
UPDATE public.elections SET results_visible = true, updated_at = now() WHERE results_visible = false;

-- ----------------------------------------------------------
-- 2. Phone number: exactly 8 digits starting with 2, 3 or 4
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_valid_phone(p TEXT)
RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(p, '') ~ '^[234][0-9]{7}$' $$;

-- Enforced for new members and whenever a phone number is changed. Existing rows
-- are not re-validated, so no current member is blocked or modified.
CREATE OR REPLACE FUNCTION public.users_check_phone()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone) AND NOT public.is_valid_phone(NEW.phone) THEN
    RAISE EXCEPTION 'PHONE_INVALID: رقم الهاتف يجب أن يتكون من 8 أرقام ويبدأ بـ 2 أو 3 أو 4'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS users_check_phone ON public.users;
CREATE TRIGGER users_check_phone BEFORE INSERT OR UPDATE OF phone ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_check_phone();

-- Profile creation from signup metadata: only a valid phone is accepted as-is.
CREATE OR REPLACE FUNCTION public.handle_new_user_safe()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m JSONB := coalesce(NEW.raw_user_meta_data, '{}'::jsonb); v_mahaja BOOLEAN := coalesce((m->>'is_mahaja')::boolean, false);
BEGIN
  INSERT INTO public.users (id, full_name, email, phone, membership_type, current_status, location, national_id, approval_status)
  VALUES (
    NEW.id,
    coalesce(nullif(btrim(m->>'full_name'), ''), 'مستخدم جديد'),
    lower(NEW.email),
    CASE WHEN public.is_valid_phone(btrim(m->>'phone')) THEN btrim(m->>'phone') ELSE '20000000' END,
    coalesce(nullif(m->>'membership_type', ''), CASE WHEN v_mahaja THEN 'محجة' ELSE 'عضو' END),
    coalesce(nullif(m->>'current_status', ''), CASE WHEN v_mahaja THEN 'طالب علم' ELSE 'لا شيء' END),
    coalesce(m->>'location', ''),
    coalesce(m->>'national_id', CASE WHEN v_mahaja THEN 'N/A' ELSE '' END),
    'Pending Approval')
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    UPDATE public.users SET is_mahaja = v_mahaja, date_of_birth = nullif(m->>'date_of_birth', '')::date WHERE id = NEW.id;
  EXCEPTION WHEN undefined_column OR invalid_datetime_format THEN NULL;
  END;
  RETURN NEW;
EXCEPTION WHEN others THEN
  RAISE WARNING 'handle_new_user_safe failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_my_profile(p_data JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE v_user UUID := auth.uid(); a auth.users; m JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'LOGIN_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE id = v_user) THEN RETURN jsonb_build_object('created', false); END IF;
  SELECT * INTO a FROM auth.users WHERE id = v_user;
  m := coalesce(a.raw_user_meta_data, '{}'::jsonb) || coalesce(p_data, '{}'::jsonb);
  INSERT INTO public.users (id, full_name, email, phone, membership_type, current_status, location, national_id, approval_status)
  VALUES (v_user, coalesce(nullif(btrim(m->>'full_name'), ''), 'مستخدم جديد'), lower(a.email),
          CASE WHEN public.is_valid_phone(btrim(m->>'phone')) THEN btrim(m->>'phone') ELSE '20000000' END,
          coalesce(nullif(m->>'membership_type', ''), 'عضو'), coalesce(nullif(m->>'current_status', ''), 'لا شيء'),
          coalesce(m->>'location', ''), coalesce(m->>'national_id', ''), 'Pending Approval')
  ON CONFLICT (id) DO NOTHING;
  RETURN jsonb_build_object('created', true);
END $$;

GRANT EXECUTE ON FUNCTION public.is_valid_phone(text) TO anon, authenticated;

COMMIT;

-- ----------------------------------------------------------
-- 3. No email confirmation: new accounts are active immediately,
--    and existing unconfirmed accounts can sign in.
-- ----------------------------------------------------------
-- Run outside the transaction above so that, if this project does not allow changes to
-- the auth schema from the SQL editor, the rest of the update is still applied.
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
  RAISE NOTICE 'No permission on auth.users: turn off "Confirm email" in Authentication > Providers > Email instead.';
END $$;

-- Existing accounts that never confirmed their email (their data is untouched).
DO $$ BEGIN
  UPDATE auth.users SET email_confirmed_at = now() WHERE email_confirmed_at IS NULL AND email IS NOT NULL;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'No permission on auth.users: confirm the accounts from Authentication > Users instead.';
END $$;

NOTIFY pgrst, 'reload schema';
