-- ==========================================================
-- تسجيل دخول الأعضاء بالبريد الإلكتروني ورقم الهاتف (دون تأكيد البريد ودون إعادة تعيين كلمة المرور)
-- Members sign in with email + registered phone again (password = phone || 'Awn1!').
-- ==========================================================
-- Safe to re-run. No account, profile or other data is deleted.
--
-- Some accounts got a different password recently (personal password set from the site,
-- or new sign-ups that chose one). Their sign-in password is set back to the phone-based one,
-- using the phone saved in their profile, so every member can sign in with email + phone.
-- Accounts whose profile has no valid phone are left untouched.
-- ==========================================================

-- 1. Every account: password derived from the profile phone (only where it differs).
DO $$
DECLARE v_count INT;
BEGIN
  UPDATE auth.users a
     SET encrypted_password = extensions.crypt(u.phone || 'Awn1!', extensions.gen_salt('bf')),
         raw_user_meta_data = coalesce(a.raw_user_meta_data, '{}'::jsonb) - 'password_set',
         updated_at = now()
    FROM public.users u
   WHERE u.id = a.id
     AND u.phone ~ '^[234][0-9]{7}$' AND u.phone <> '20000000'
     AND (a.encrypted_password IS NULL OR a.encrypted_password = ''
          OR a.encrypted_password IS DISTINCT FROM extensions.crypt(u.phone || 'Awn1!', a.encrypted_password));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Accounts switched back to email + phone sign-in: %', v_count;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'No permission on auth.users (run this file from the Supabase SQL Editor).';
END $$;

-- 2. If an administrator changes a member's phone, the sign-in follows the new number.
CREATE OR REPLACE FUNCTION public.users_sync_login_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone AND NEW.phone ~ '^[234][0-9]{7}$' AND NEW.phone <> '20000000' THEN
    BEGIN
      UPDATE auth.users SET encrypted_password = extensions.crypt(NEW.phone || 'Awn1!', extensions.gen_salt('bf')), updated_at = now()
       WHERE id = NEW.id;
    EXCEPTION WHEN insufficient_privilege OR undefined_table THEN
      RAISE WARNING 'users_sync_login_phone: could not update the sign-in of %', NEW.id;
    END;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.users_sync_login_phone() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS users_sync_login_phone ON public.users;
CREATE TRIGGER users_sync_login_phone AFTER UPDATE OF phone ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_sync_login_phone();

-- 3. No email confirmation: new accounts are active immediately, existing ones confirmed.
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
