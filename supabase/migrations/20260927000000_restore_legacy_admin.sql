-- Restore permissions to legacy admin functions
GRANT EXECUTE ON FUNCTION public.verify_admin_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_admin_password(TEXT) TO anon, authenticated;

-- Ensure system_admins can be read
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.system_admins;
CREATE POLICY "Enable read access for all users" ON public.system_admins FOR SELECT USING (true);
