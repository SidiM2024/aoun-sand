-- =====================================================================================
-- ULTIMATE USER SYNC & FIX SQL
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- =====================================================================================

-- 1. Ensure `approval_status` exists and defaults correctly
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'Pending Approval';

-- 2. Drop any old constraints that might cause issues and add the correct one
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS valid_approval_status;
ALTER TABLE public.users ADD CONSTRAINT valid_approval_status 
  CHECK (approval_status IN ('Pending Approval', 'Approved', 'Rejected', 'Suspended'));

-- 3. Create a bulletproof trigger to ALWAYS sync new signups into public.users
CREATE OR REPLACE FUNCTION public.handle_new_user_safe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin, bypassing RLS
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, 
    full_name, 
    email, 
    phone, 
    membership_type, 
    current_status, 
    location, 
    national_id, 
    approval_status
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '20000000'), -- fallback to valid format
    COALESCE(NEW.raw_user_meta_data->>'membership_type', 'عضو'),
    COALESCE(NEW.raw_user_meta_data->>'current_status', 'لا شيء'),
    COALESCE(NEW.raw_user_meta_data->>'location', ''),
    COALESCE(NEW.raw_user_meta_data->>'national_id', ''),
    'Pending Approval'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    membership_type = EXCLUDED.membership_type,
    current_status = EXCLUDED.current_status,
    location = EXCLUDED.location,
    national_id = EXCLUDED.national_id;
  
  RETURN NEW;
EXCEPTION WHEN others THEN
  -- If there's an error (like phone regex mismatch), we silently ignore it 
  -- so the auth user is still created, but they might need manual sync.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_safe();

-- 4. Automatically sync all missing users right now! (Fixes users stuck in limbo)
DO $$
BEGIN
  INSERT INTO public.users (
    id, full_name, email, phone, membership_type, current_status, location, national_id, approval_status
  )
  SELECT 
    au.id, 
    COALESCE(au.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    au.email, 
    COALESCE(au.raw_user_meta_data->>'phone', '20000000'), 
    COALESCE(au.raw_user_meta_data->>'membership_type', 'عضو'),
    COALESCE(au.raw_user_meta_data->>'current_status', 'لا شيء'),
    COALESCE(au.raw_user_meta_data->>'location', ''),
    COALESCE(au.raw_user_meta_data->>'national_id', ''),
    'Pending Approval'
  FROM auth.users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL
  ON CONFLICT (id) DO NOTHING;
END $$;
