import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { ALL_SECTION_IDS, fetchAdminSession, forgetAdminSession, getAdminToken, type AdminSessionInfo } from '../lib/adminSession';
export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  membership_type: string;
  current_status: string;
  location: string;
  national_id: string;
  approval_status: string;
  avatar_url?: string;
  unique_short_id?: string;
  is_mahaja?: boolean;
  date_of_birth?: string;
}


interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  adminRole: string | null;
  /** Server-verified dashboard sections; Super Admins get every section. */
  adminSections: string[];
  isSuperAdmin: boolean;
  /** Display name of the signed-in admin. */
  adminLabel: string | null;
  logout: () => Promise<void>;
  checkLegacyAdmin: () => void;
}
const AuthContext = createContext<AuthContextType>({ user: null, userProfile: null, loading: true, isAdmin: false, adminRole: null, adminSections: [], isSuperAdmin: false, adminLabel: null, logout: async () => {}, checkLegacyAdmin: () => {} });

const readLegacyFlags = () => {
  const role = sessionStorage.getItem('admin_role') || localStorage.getItem('admin_role');
  const isAuth = sessionStorage.getItem('admin_auth') === 'true' || localStorage.getItem('admin_auth') === 'true';
  return { role, isAuth };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Dashboard (system_admins) administrator, verified by the server on every load.
  const [dashboardAdmin, setDashboardAdmin] = useState<AdminSessionInfo | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(() => !!getAdminToken() || readLegacyFlags().isAuth);
  const lastCheck = useRef(0);

  const [supabaseAdminRole, setSupabaseAdminRole] = useState<string | null>(null);

  const verifyDashboardAdmin = useCallback(async () => {
    const flags = readLegacyFlags();
    if (!getAdminToken() && !flags.isAuth) { setDashboardAdmin(null); setDashboardLoading(false); return; }
    lastCheck.current = Date.now();
    const result = await fetchAdminSession();
    if (result.status === 'valid' && result.session.kind === 'legacy') {
      setDashboardAdmin(result.session);
    } else if (result.status === 'not_installed' && flags.isAuth) {
      // Permissions migration not applied yet: keep the previous behaviour (all sections).
      setDashboardAdmin({ kind: 'legacy', id: '', username: '', label: '', role: flags.role ?? '', is_super: flags.role === 'Super Admin', sections: ALL_SECTION_IDS });
    } else if (result.status === 'offline') {
      // Keep whatever we had; protected calls are re-checked by the server anyway.
    } else {
      forgetAdminSession();
      setDashboardAdmin(null);
    }
    setDashboardLoading(false);
  }, []);

  const checkLegacyAdmin = useCallback(() => { setDashboardLoading(true); void verifyDashboardAdmin(); }, [verifyDashboardAdmin]);

  useEffect(() => {
    void verifyDashboardAdmin();
    // Re-validate when the tab regains focus so disabled admins / changed sections apply quickly.
    const onFocus = () => { if (Date.now() - lastCheck.current > 60_000) void verifyDashboardAdmin(); };
    const onStorage = (e: StorageEvent) => { if (!e.key || ['admin_session_token', 'admin_auth', 'admin_role'].includes(e.key)) void verifyDashboardAdmin(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onStorage); };
  }, [verifyDashboardAdmin]);

  useEffect(() => {
    let disposed = false;
    let revision = 0;
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    let controller: AbortController | null = null;

    const synchronize = async (nextUser: User | null) => {
      const current = ++revision;
      controller?.abort();
      controller = new AbortController();
      const requestController = controller;
      if (profileChannel) { void supabase.removeChannel(profileChannel); profileChannel = null; }
      setUser(nextUser);
      setUserProfile(null);
      setSupabaseAdminRole(null);

      // If no supabase user, just end loading immediately. (Dashboard admin is verified separately.)
      if (!nextUser) { setLoading(false); return; }
      setLoading(true);
      const timer = setTimeout(() => requestController.abort(), 12000);
      try {
        const [profile, adminRpc] = await Promise.all([
          supabase.from('users').select('*').eq('id', nextUser.id).abortSignal(requestController.signal).maybeSingle(),
          supabase.rpc('is_admin').abortSignal(requestController.signal),
        ]);
        if (disposed || current !== revision) return;
        setUserProfile(profile.data);
        const isUserAdmin = adminRpc.data === true;
        setSupabaseAdminRole(isUserAdmin ? 'Super Admin' : null);
        if (adminRpc.error) console.error('Unable to verify administrator access:', adminRpc.error.message);
        profileChannel = supabase.channel('session-profile-' + nextUser.id)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: 'id=eq.' + nextUser.id }, payload => { if (!disposed && current === revision) setUserProfile(payload.new as UserProfile); })
          .subscribe();
      } catch (error) {
        if (!disposed && current === revision) console.error('Unable to load account:', error);
      } finally {
        clearTimeout(timer);
        if (!disposed && current === revision) setLoading(false);
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => { if (!disposed) void synchronize(session?.user ?? null); }, 0);
    });
    return () => {
      disposed = true;
      revision++;
      controller?.abort();
      subscription.unsubscribe();
      if (profileChannel) void supabase.removeChannel(profileChannel);
    };
  }, []);

  const logout = async () => {
    // We try to sign out of Supabase, but don't throw if it fails (admin might only have a dashboard session)
    try {
        await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
        console.warn('Supabase logout error', err);
    }
    forgetAdminSession();
    setUser(null); setUserProfile(null); setSupabaseAdminRole(null); setDashboardAdmin(null);
  };

  const isSupabaseAdmin = !!user && supabaseAdminRole !== null;
  const currentIsAdmin = isSupabaseAdmin || !!dashboardAdmin;
  const isSuperAdmin = isSupabaseAdmin || !!dashboardAdmin?.is_super;
  const adminSections = isSuperAdmin ? ALL_SECTION_IDS : dashboardAdmin?.sections ?? [];
  const currentAdminRole = isSupabaseAdmin ? supabaseAdminRole : dashboardAdmin?.role ?? null;
  const adminLabel = isSupabaseAdmin ? user?.email ?? null : dashboardAdmin?.label || dashboardAdmin?.username || null;

  return (
    <AuthContext.Provider value={{
      user, userProfile, loading: loading || dashboardLoading, isAdmin: currentIsAdmin, adminRole: currentAdminRole,
      adminSections, isSuperAdmin, adminLabel, logout, checkLegacyAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => useContext(AuthContext);
