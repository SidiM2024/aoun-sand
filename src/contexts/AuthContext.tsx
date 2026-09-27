import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
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
  logout: () => Promise<void>;
  checkLegacyAdmin: () => void;
}
const AuthContext = createContext<AuthContextType>({ user: null, userProfile: null, loading: true, isAdmin: false, adminRole: null, logout: async () => {}, checkLegacyAdmin: () => {} });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [legacyAdminRole, setLegacyAdminRole] = useState<string | null>(() => {
    return sessionStorage.getItem('admin_role') || localStorage.getItem('admin_role');
  });
  const [isLegacyAdmin, setIsLegacyAdmin] = useState<boolean>(() => {
    return sessionStorage.getItem('admin_auth') === 'true' || localStorage.getItem('admin_auth') === 'true';
  });

  const [supabaseAdminRole, setSupabaseAdminRole] = useState<string | null>(null);

  const checkLegacyAdmin = () => {
    const role = sessionStorage.getItem('admin_role') || localStorage.getItem('admin_role');
    const isAuth = sessionStorage.getItem('admin_auth') === 'true' || localStorage.getItem('admin_auth') === 'true';
    setLegacyAdminRole(role);
    setIsLegacyAdmin(isAuth);
  };

  useEffect(() => {
    let disposed = false;
    let revision = 0;
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    let controller: AbortController | null = null;
    
    // Always listen to storage events to sync legacy admin across tabs
    const handleStorageChange = () => {
      checkLegacyAdmin();
    };
    window.addEventListener('storage', handleStorageChange);

    const synchronize = async (nextUser: User | null) => {
      const current = ++revision;
      controller?.abort();
      controller = new AbortController();
      const requestController = controller;
      if (profileChannel) { void supabase.removeChannel(profileChannel); profileChannel = null; }
      setUser(nextUser);
      setUserProfile(null);
      setSupabaseAdminRole(null);
      
      // If no supabase user, just end loading immediately. (Legacy admin might still be true)
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
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const logout = async () => {
    // We try to sign out of Supabase, but don't throw if it fails (admin might only have legacy session)
    try {
        await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
        console.warn('Supabase logout error', err);
    }
    for (const storage of [localStorage, sessionStorage]) { storage.removeItem('admin_auth'); storage.removeItem('admin_role'); }
    setUser(null); setUserProfile(null); setSupabaseAdminRole(null);
    checkLegacyAdmin(); // update legacy admin state
  };

  const currentAdminRole = legacyAdminRole || supabaseAdminRole;
  const currentIsAdmin = isLegacyAdmin || (!!user && supabaseAdminRole !== null);

  return <AuthContext.Provider value={{ user, userProfile, loading, isAdmin: currentIsAdmin, adminRole: currentAdminRole, logout, checkLegacyAdmin }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
