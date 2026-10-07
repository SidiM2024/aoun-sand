import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { Users, Bell, Vote, Upload, LogOut, ShieldAlert, LayoutDashboard, HandHeart, ShieldCheck, DollarSign, HeartPulse, BookOpen, UserCog, FileText, CreditCard, Heart } from 'lucide-react';

import { UsersTab } from '../components/admin/UsersTab';
import { NotificationsTab } from '../components/admin/NotificationsTab';
import { PollsTab } from '../components/admin/PollsTab';
import { MediaTab } from '../components/admin/MediaTab';
import { DonationsTab } from '../components/admin/DonationsTab';
import { ApprovalsTab } from '../components/admin/ApprovalsTab';
import { FinanceTab } from '../components/admin/FinanceTab';
import { PatientsTab } from '../components/admin/PatientsTab';
import { MahajaTab } from '../components/admin/MahajaTab';
import { AdminsTab } from '../components/admin/AdminsTab';
import { RequestsManagementTab } from '../components/admin/RequestsManagementTab';
import { CompetitionsManagementTab } from '../components/admin/CompetitionsManagementTab';
import { MembershipsTab } from '../components/admin/MembershipsTab';
import { UserDonationsTab } from '../components/admin/UserDonationsTab';
import { useAuth } from '../contexts/AuthContext';
import { adminLogin, adminLogout } from '../lib/adminSession';

type TabId = 'users' | 'approvals' | 'notifications' | 'voting' | 'media' | 'donations' | 'finance' | 'patients' | 'mahaja' | 'admins' | 'requests' | 'competitions' | 'memberships' | 'user_donations';

export const AdminPage = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const { isAdmin, adminRole, adminSections, isSuperAdmin, adminLabel, loading: authLoading, logout, checkLegacyAdmin } = useAuth();

  const isAuthenticated = isAdmin;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // The open section is kept in the URL (?tab=finance) so it can be linked to;
  // a section the admin is not allowed to open is never rendered.
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedTabs = useMemo(() => {
    const set = new Set<string>(adminSections);
    if (isSuperAdmin) set.add('admins');
    return set;
  }, [adminSections, isSuperAdmin]);
  const can = (tab: string) => allowedTabs.has(tab);
  const requestedTab = searchParams.get('tab') as TabId | null;
  const activeTab: TabId | null = requestedTab && allowedTabs.has(requestedTab)
    ? requestedTab
    : ((['users', 'approvals', 'memberships', 'finance', 'user_donations', 'donations', 'patients', 'mahaja', 'requests', 'notifications', 'voting', 'competitions', 'media', 'admins'] as TabId[]).find(t => allowedTabs.has(t)) ?? null);
  const blockedTab = requestedTab && !allowedTabs.has(requestedTab) ? requestedTab : null;
  const setActiveTab = (tab: TabId) => setSearchParams({ tab }, { replace: true });

  // Dashboard state
  const [usersCount, setUsersCount] = useState(0);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [polls, setPolls] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);

  // Only load / subscribe to the data of sections this admin may open.
  const needsUsers = can('users') || can('approvals');
  const needsPolls = can('voting');
  const needsNotifications = can('notifications');
  const needsMedia = can('media');

  useEffect(() => {
    if (!isAdmin) return;
    void fetchDashboardData();
    const channel = supabase.channel('admin-dashboard');
    if (needsPolls) channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'polls' }, () => fetchPolls())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, () => fetchPolls());
    if (needsNotifications) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchNotifications());
    if (needsUsers) channel.on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchUsers());
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [isAdmin, needsUsers, needsPolls, needsNotifications, needsMedia]);

  const fetchUsers = async () => {
    let allUsers: any[] = [];
    let from = 0;
    const step = 1000;
    let fetchMore = true;

    while (fetchMore) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, from + step - 1);

      if (error) {
        console.error("Error fetching users:", error);
        break;
      }

      if (data && data.length > 0) {
        allUsers = [...allUsers, ...data];
        from += step;
        if (data.length < step) {
          fetchMore = false;
        }
      } else {
        fetchMore = false;
      }
    }

    setUsers(allUsers);
    setUsersCount(allUsers.length);
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
    try {
      const fetchPromise = Promise.all([
        needsUsers && fetchUsers().catch(err => console.error("Error fetching users:", err)),
        needsPolls && fetchPolls().catch(err => console.error("Error fetching polls:", err)),
        needsNotifications && fetchNotifications().catch(err => console.error("Error fetching notifications:", err)),
        needsMedia && fetchMedia().catch(err => console.error("Error fetching media:", err))
      ]);

      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 5000));

      await Promise.race([fetchPromise, timeoutPromise]);
    } catch (err) {
      console.error("Error in fetchDashboardData:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);

    try {
      // 1. Dashboard administrators (system_admins) → server-side session with sections.
      const result = await adminLogin(username, password);
      if (result.ok) {
        setPassword('');
        toast.success(isRTL ? 'تم تسجيل الدخول بنجاح!' : 'Logged in successfully!');
        checkLegacyAdmin();
        return;
      }
      if (!result.notFound) { toast.error(result.message); return; }

      // 2. Supabase Auth administrators (public.admins), signing in with their email.
      {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: username.trim(),
          password: password
        });

        if (authError) {
          toast.error(result.message === 'legacy_error' ? (isRTL ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : 'Invalid credentials.') : result.message);
          return;
        }

        if (authData.user) {
          const { data: adminData, error: adminError } = await supabase.from('admins').select('id').eq('id', authData.user.id).single();
          if (adminError || !adminData) {
            await supabase.auth.signOut();
            toast.error(isRTL ? 'عفواً، هذا الحساب ليس لديه صلاحيات الإدارة.' : 'This account does not have admin privileges.');
            setIsLoggingIn(false);
            return;
          }
          setPassword('');
          toast.success(isRTL ? 'تم تسجيل الدخول بنجاح!' : 'Logged in successfully!');
        }
      }
    } catch (err: any) {
      console.error("Login error:", err);
      toast.error('An error occurred during login. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    try { await logout(); } catch { toast.error(isRTL ? 'تعذر تسجيل الخروج' : 'Unable to sign out.'); return; }
    toast.success(isRTL ? 'تم تسجيل الخروج' : 'Logged out');
    if (checkLegacyAdmin) checkLegacyAdmin();
  };

  if (authLoading) return <div role="status" className="min-h-screen grid place-items-center">{isRTL ? 'جارٍ التحقق من الجلسة…' : 'Verifying session…'}</div>;
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
              className="w-20 h-20 bg-gradient-to-br from-teal-800 to-teal-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/30"
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

          <a href="/" className="block text-center text-teal-700 mb-5">{isRTL ? 'العودة إلى الموقع' : 'Back to website'}</a>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                {isRTL ? 'البريد الإلكتروني' : 'Email'}
              </label>
              <input
                type="text" autoComplete="username" aria-label={isRTL ? 'البريد الإلكتروني' : 'Email'}
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                {isRTL ? 'كلمة المرور' : 'Password'}
              </label>
              <input
                type="password" autoComplete="current-password" aria-label={isRTL ? 'كلمة المرور' : 'Password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium tracking-widest text-center"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className={`w-full py-4 px-4 rounded-xl font-bold text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
                isLoggingIn
                  ? 'bg-slate-400 dark:bg-slate-700 text-white cursor-not-allowed shadow-none'
                  : 'bg-teal-800 hover:bg-teal-700 text-white shadow-teal-500/20 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isLoggingIn ? (
                <>
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isRTL ? 'جاري التحقق...' : 'Verifying...'}</span>
                </>
              ) : (
                <span>{isRTL ? 'دخول المشرف' : 'Admin Login'}</span>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: 'users',         icon: Users,     label: isRTL ? 'المستخدمين' : 'Users',         color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { id: 'approvals',     icon: ShieldCheck, label: isRTL ? 'طلبات الموافقة' : 'User Approvals', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { id: 'notifications', icon: Bell,      label: isRTL ? 'الإشعارات'  : 'Notifications',  color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/20'  },
    { id: 'voting',        icon: Vote,      label: isRTL ? 'التصويت'    : 'Voting',         color: 'text-teal-500',   bg: 'bg-teal-50 dark:bg-teal-900/20'   },
    { id: 'donations',     icon: HandHeart, label: isRTL ? 'التبرعات'   : 'Donations',      color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20'},
    { id: 'patients',      icon: HeartPulse, label: isRTL ? 'إدارة المرضى' : 'Patients',    color: 'text-rose-500',   bg: 'bg-rose-50 dark:bg-rose-900/20'   },
    { id: 'media',         icon: Upload,    label: isRTL ? 'الوسائط'    : 'Media',          color: 'text-pink-500',   bg: 'bg-pink-50 dark:bg-pink-900/20'   },
    { id: 'finance',       icon: DollarSign, label: isRTL ? 'المالية'    : 'Finance',        color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { id: 'requests',      icon: FileText,   label: isRTL ? 'الطلبات'    : 'Requests',       color: 'text-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { id: 'competitions',  icon: Vote,       label: isRTL ? 'المسابقات'  : 'Competitions',   color: 'text-purple-500',  bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { id: 'mahaja',        icon: BookOpen,   label: isRTL ? 'المحجة البيضاء' : 'Al-Mahaja',    color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/20' },
    { id: 'memberships',   icon: CreditCard,  label: isRTL ? 'رسوم الانتساب' : 'Memberships',   color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { id: 'user_donations',icon: Heart,       label: isRTL ? 'التبرعات الواردة' : 'User Donations', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
  ];

  tabs.push({ id: 'admins', icon: UserCog, label: isRTL ? 'المشرفين' : 'Admins', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' });
  const visibleTabs = tabs.filter(tab => can(tab.id));

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
              {(adminLabel || adminRole) && (
                <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
                  {adminLabel && <span className="font-bold text-slate-700 dark:text-slate-200">{adminLabel}</span>}
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isSuperAdmin ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300'}`}>
                    {isSuperAdmin ? (isRTL ? 'المشرف الرئيسي' : 'Super Admin') : adminRole}
                  </span>
                </div>
              )}
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
              {visibleTabs.map((tab) => {
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
          <div className="flex-1 min-w-0 relative">
            {isLoading && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm rounded-3xl">
                <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            )}

            {blockedTab && (
              <div role="alert" className="mb-6 p-4 rounded-2xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-bold flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                {isRTL ? 'ليست لديك صلاحية للوصول إلى هذا القسم. تم عرض أول قسم مسموح لك.' : 'You do not have access to that section.'}
              </div>
            )}

            {!activeTab && (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 text-center">
                <ShieldAlert className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h2 className="text-xl font-black text-slate-800 dark:text-white mb-2">{isRTL ? 'لا توجد أقسام مخصصة لحسابك' : 'No sections assigned'}</h2>
                <p className="text-slate-500">{isRTL ? 'تواصل مع المشرف الرئيسي لمنحك صلاحية الوصول إلى الأقسام المطلوبة.' : 'Ask the Super Admin to grant you access.'}</p>
              </div>
            )}

            {/* activeTab is always one of the sections this admin is allowed to open. */}
            <AnimatePresence mode="wait">
              {activeTab === 'users'        && <UsersTab users={users} usersCount={usersCount} />}
              {activeTab === 'approvals'     && <ApprovalsTab users={users} onRefresh={fetchUsers} />}
              {activeTab === 'notifications' && <NotificationsTab notifications={notifications} fetchDashboardData={fetchDashboardData} />}
              {activeTab === 'voting'        && <PollsTab polls={polls} fetchDashboardData={fetchDashboardData} />}
              {activeTab === 'donations'     && <DonationsTab fetchDashboardData={fetchDashboardData} />}
              {activeTab === 'patients'      && <PatientsTab />}
              {activeTab === 'media'         && <MediaTab mediaFiles={mediaFiles} fetchMedia={fetchMedia} />}
              {activeTab === 'finance'       && <FinanceTab />}
              {activeTab === 'requests'      && <RequestsManagementTab />}
              {activeTab === 'competitions'  && <CompetitionsManagementTab />}
              {activeTab === 'mahaja'        && <MahajaTab />}
              {activeTab === 'admins'        && <AdminsTab />}
              {activeTab === 'memberships'   && <MembershipsTab />}
              {activeTab === 'user_donations'&& <UserDonationsTab />}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
