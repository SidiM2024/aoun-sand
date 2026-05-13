import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, Bell, Vote, Upload, LogOut, ShieldAlert, LayoutDashboard, HandHeart } from 'lucide-react';

import { UsersTab } from '../components/admin/UsersTab';
import { NotificationsTab } from '../components/admin/NotificationsTab';
import { PollsTab } from '../components/admin/PollsTab';
import { MediaTab } from '../components/admin/MediaTab';
import { DonationsTab } from '../components/admin/DonationsTab';

export const AdminPage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [activeTab, setActiveTab] = useState<'users' | 'notifications' | 'voting' | 'media' | 'donations'>('users');

  const [usersCount, setUsersCount] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [polls, setPolls] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);

  // Keep a ref to the realtime channel so we can clean it up on logout/unmount
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Verify session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const verifySession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: adminRecord } = await supabase
          .from('admins')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();
        if (adminRecord) {
          setIsAuthenticated(true);
          fetchDashboardData();
          setupRealtimeSubscriptions();
        }
      }
      setIsCheckingSession(false);
    };
    verifySession();

    // Cleanup: remove realtime subscriptions on unmount
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, []);

  const setupRealtimeSubscriptions = () => {
    // Clean up any existing channel before creating a new one
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }
    const channel = supabase.channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchPolls())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchPolls())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchNotifications())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchUsers())
      .subscribe();
    realtimeChannelRef.current = channel;
  };

  const fetchUsers = async () => {
    // Direct query — RLS now allows admins to see all users
    const { data } = await supabase
      .from('users')
      .select('id,full_name,email,phone,membership_type,current_status,location,national_id,created_at')
      .order('created_at', { ascending: false });
    if (data) {
      setUsers(data);
      setUsersCount(data.length);
    }
  };

  const fetchPolls = async () => {
    const { data: pollsData } = await supabase
      .from('polls')
      .select('*, poll_options(*), poll_votes(*)');
    if (pollsData) setPolls(pollsData);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setNotifications(data);
  };

  const fetchMedia = async () => {
    const { data } = await supabase.storage.from('media').list();
    if (data) {
      const filtered = data.filter(f => f.name !== '.emptyFolderPlaceholder');
      setMediaFiles(filtered);
    }
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    await Promise.all([fetchUsers(), fetchPolls(), fetchNotifications(), fetchMedia()]);
    setIsLoading(false);
  };

  // ── Login via Supabase Auth ──────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      toast.error(isRTL ? 'بيانات الدخول خاطئة' : 'Invalid credentials');
      setIsLoading(false);
      return;
    }

    // Server-side admin verification — cannot be bypassed client-side
    const { data: adminRecord } = await supabase
      .from('admins')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!adminRecord) {
      await supabase.auth.signOut();
      toast.error(isRTL ? 'ليس لديك صلاحية الوصول' : 'Access denied');
      setIsLoading(false);
      return;
    }

    setIsAuthenticated(true);
    fetchDashboardData();
    setupRealtimeSubscriptions();
    toast.success(isRTL ? 'تم تسجيل الدخول بنجاح' : 'Logged in successfully');
    setIsLoading(false);
  };

  const handleLogout = async () => {
    // 1. Stop all realtime subscriptions first (no stale listeners)
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    // 2. Sign out from Supabase (clears JWT from localStorage)
    await supabase.auth.signOut();
    // 3. Wipe all admin data from React state (nothing stays in memory)
    setIsAuthenticated(false);
    setUsers([]);
    setPolls([]);
    setNotifications([]);
    setMediaFiles([]);
    setUsersCount(0);
    setEmail('');
    setPassword('');
    toast.success(isRTL ? 'تم تسجيل الخروج' : 'Logged out');
  };

  // ── Loading spinner while checking session ───────────────────────────────
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Login form ───────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 pt-24" dir={isRTL ? 'rtl' : 'ltr'}>
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-200 dark:border-slate-800"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/30"
            >
              <ShieldAlert className="w-10 h-10" />
            </motion.div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-2">
              {isRTL ? 'بوابة الإدارة' : 'Admin Portal'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
              {isRTL ? 'الوصول مصرح للمسؤولين فقط' : 'Authorized personnel only'}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                {isRTL ? 'البريد الإلكتروني' : 'Email'}
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                {isRTL ? 'كلمة المرور' : 'Password'}
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium tracking-widest text-center"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-bold text-lg shadow-xl shadow-indigo-500/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
              ) : (
                isRTL ? 'تسجيل الدخول' : 'Sign In'
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: 'users',         icon: Users,     label: isRTL ? 'المستخدمين' : 'Users',         color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { id: 'notifications', icon: Bell,      label: isRTL ? 'الإشعارات'  : 'Notifications',  color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/20'  },
    { id: 'voting',        icon: Vote,      label: isRTL ? 'التصويت'    : 'Voting',         color: 'text-teal-500',   bg: 'bg-teal-50 dark:bg-teal-900/20'   },
    { id: 'donations',     icon: HandHeart, label: isRTL ? 'التبرعات'   : 'Donations',      color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20'},
    { id: 'media',         icon: Upload,    label: isRTL ? 'الوسائط'    : 'Media',          color: 'text-pink-500',   bg: 'bg-pink-50 dark:bg-pink-900/20'   },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-24 pb-12" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container-custom max-w-7xl">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <LayoutDashboard className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-white">
                {isRTL ? 'لوحة تحكم النظام' : 'System Dashboard'}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                {isRTL ? 'إدارة شاملة للمحتوى والمستخدمين' : 'Comprehensive content and user management'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl font-bold transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>{isRTL ? 'تسجيل الخروج' : 'Logout'}</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full lg:w-72 flex-shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-3 flex lg:flex-col gap-2 overflow-x-auto sticky top-24">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3 px-5 py-4 rounded-2xl transition-all whitespace-nowrap font-bold text-lg relative ${
                      isActive
                        ? 'text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800'
                        : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute inset-0 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700"
                        style={{ zIndex: 0 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-4 w-full">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? tab.bg : 'bg-transparent'} transition-colors`}>
                        <tab.icon className={`w-5 h-5 ${isActive ? tab.color : 'text-slate-400'}`} />
                      </div>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm rounded-3xl">
                <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            )}

            <AnimatePresence mode="wait">
              {activeTab === 'users'         && <UsersTab users={users} usersCount={usersCount} />}
              {activeTab === 'notifications' && <NotificationsTab notifications={notifications} fetchDashboardData={fetchDashboardData} />}
              {activeTab === 'voting'        && <PollsTab polls={polls} fetchDashboardData={fetchDashboardData} />}
              {activeTab === 'donations'     && <DonationsTab fetchDashboardData={fetchDashboardData} />}
              {activeTab === 'media'         && <MediaTab mediaFiles={mediaFiles} fetchMedia={fetchMedia} />}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
