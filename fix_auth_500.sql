-- ════════════════════════════════════════════════════════════════
-- FIX AUTH 500 ERROR — Run in Supabase SQL Editor
-- Root cause: handle_new_user trigger crashes on auth.signInWithPassword
-- because it fails silently on schema issues
-- ════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- STEP 1: Fix the handle_new_user trigger to NEVER crash auth
-- The EXCEPTION handler ensures auth.users INSERT always succeeds
-- even if public.users INSERT fails for any reason
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Attempt to create the public profile
  -- Wrap in EXCEPTION so auth is NEVER blocked by a profile error
  BEGIN
    INSERT INTO public.users (
      id,
      full_name,
      email,
      phone,
      membership_type,
      current_status,
      location,
      national_id
    ) VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
      NEW.email,
      COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
        '20000000'  -- default valid phone (starts with 2, 8 digits)
      ),
      COALESCE(NEW.raw_user_meta_data->>'membership_type', 'عضو'),
      COALESCE(NEW.raw_user_meta_data->>'current_status', 'غير محدد'),
      COALESCE(NEW.raw_user_meta_data->>'location', ''),
      COALESCE(NEW.raw_user_meta_data->>'national_id', '')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but do NOT re-raise — auth must succeed regardless
    RAISE WARNING 'handle_new_user failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- STEP 2: Full cleanup of any corrupted admin account data
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  admin_email TEXT := 'Awn2025@gmail.com';
BEGIN
  DELETE FROM auth.identities
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = admin_email);
  DELETE FROM auth.sessions
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = admin_email);
  DELETE FROM auth.mfa_factors
    WHERE user_id IN (SELECT id FROM auth.users WHERE email = admin_email);
  DELETE FROM public.admins
    WHERE id IN (SELECT id FROM auth.users WHERE email = admin_email);
  DELETE FROM public.users WHERE email = admin_email;
  DELETE FROM auth.users WHERE email = admin_email;
  RAISE NOTICE 'Cleanup complete.';
END $$;

-- ─────────────────────────────────────────────────────────────
-- STEP 3: Create a clean admin account with all required tables
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  new_id UUID := gen_random_uuid();
  admin_email TEXT := 'Awn2025@gmail.com';
  admin_phone TEXT := '44444444';
  admin_pass  TEXT := crypt('Awn&Sanad#2025', gen_salt('bf', 10));
BEGIN
  -- Create in auth.users
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role
  ) VALUES (
    new_id, '00000000-0000-0000-0000-000000000000',
    admin_email, admin_pass, now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'full_name', 'المدير العام',
      'phone', admin_phone,
      'membership_type', 'مشرف',
      'current_status', 'أعمل',
      'location', 'نواكشوط',
      'national_id', '0000000000'
    ),
    now(), now(), 'authenticated', 'authenticated'
  );

  -- Create the Identity record so GoTrue accepts login
  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    admin_email,     -- provider_id = email for email/password auth
    new_id,
    jsonb_build_object('sub', new_id::text, 'email', admin_email),
    'email',
    now(), now(), now()
  );

  -- Insert directly into public.users (bypass trigger output)
  INSERT INTO public.users (
    id, full_name, email, phone, membership_type,
    current_status, location, national_id, created_at
  ) VALUES (
    new_id, 'المدير العام', admin_email, admin_phone,
    'مشرف', 'أعمل', 'نواكشوط', '0000000000', now()
  ) ON CONFLICT (id) DO UPDATE SET membership_type = 'مشرف';

  -- Grant admin privileges
  INSERT INTO public.admins (id) VALUES (new_id) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '✅ Admin account created! UUID: %', new_id;
END $$;
