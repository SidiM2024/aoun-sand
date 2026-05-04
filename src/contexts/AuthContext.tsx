import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      checkIfAdmin(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      checkIfAdmin(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkIfAdmin = (currentUser: User | null) => {
    // Basic admin check based on metadata or specific email
    // Since the prompt specified Awn / Sanad#2025 for admin, we might handle admin login separately.
    // For now, if the user role is admin or they login through admin page, we set this.
    // Let's rely on localStorage for admin state if it's a simple passcode login.
    const adminSession = localStorage.getItem('admin_session');
    setIsAdmin(adminSession === 'true');
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
