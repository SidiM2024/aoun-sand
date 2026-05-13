import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  membership_type: string;
  current_status: string;
  location: string;
  national_id: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('id,full_name,email,phone,membership_type,current_status,location,national_id')
      .eq('id', userId)
      .single();
    setUserProfile(data ?? null);
  };

  // Server-side admin check: queries the admins table — cannot be spoofed via localStorage
  const checkIfAdmin = async (userId: string | undefined) => {
    if (!userId) { setIsAdmin(false); return; }
    const { data } = await supabase
      .from('admins')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    setIsAdmin(!!data);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id);
        checkIfAdmin(u.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        fetchProfile(u.id);
        checkIfAdmin(u.id);
      } else {
        setUserProfile(null);
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    // Clear all user data from React state
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
