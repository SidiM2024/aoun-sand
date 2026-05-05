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
  logout: async () => {} 
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).single();
    if (data) {
      setUserProfile(data);
    } else {
      setUserProfile(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      checkIfAdmin();
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setUserProfile(null);
      }
      checkIfAdmin();
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkIfAdmin = () => {
    const adminSession = localStorage.getItem('admin_session');
    setIsAdmin(adminSession === 'true');
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('admin_session');
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
