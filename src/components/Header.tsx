import { useState, useEffect } from 'react';
import { Sun, Moon, Bell, Menu, X, Home, Info, FolderHeart, Vote, BookOpen, HandHeart, Receipt, FileText, MessageCircle, GraduationCap, User, LogIn, LogOut, CreditCard, Globe } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { MembershipCardModal } from './MembershipCardModal';
import { NotificationPanel } from './NotificationPanel';

// App-style header: menu (start), centered logo, notifications (end).
export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
   
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { user, userProfile, logout } = useAuth();
  const location = useLocation();
  const isRTL = language === 'ar';

  // Close the drawer on navigation.
  useEffect(() => { setIsMenuOpen(false); }, [location.pathname]);

  /* ── Notifications ── */
  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);

    if (data) {
      setNotifications(data);
      const lastSeen = localStorage.getItem('last_notification_seen');
      if (data.length > 0 && (!lastSeen || new Date(data[0].created_at) > new Date(lastSeen))) {
        setHasUnread(true);
      }
    }
  };

  useEffect(() => {
    fetchNotifications();

    const sub = supabase.channel('header:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications(prev => [payload.new, ...prev].slice(0, 15));
        setHasUnread(true);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(payload.new.title, { body: payload.new.message });
        }
      })
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, []);

  const openNotifications = () => {
    setHasUnread(false);
    setIsNotifOpen(!isNotifOpen);
    if (notifications.length > 0) {
      localStorage.setItem('last_notification_seen', new Date().toISOString());
    }
  };

  const links: [string, string, string, typeof Home][] = [
    ['/', 'الرئيسية', 'Home', Home],
    ['/about', 'عن الجمعية', 'About', Info],
    ['/projects', 'مشاريعنا', 'Projects', FolderHeart],
    ['/elections', 'الانتخابات', 'Elections', Vote],
    ['/lessons', 'الدروس والمحاضرات', 'Lessons', BookOpen],
    ['/donate', 'تبرع الآن', 'Donate', HandHeart],
    ['/donation-expenses', 'شفافية المصاريف', 'Expenses', Receipt],
    ['/requests', 'طلباتي', 'My requests', FileText],
    ['/mahaja', 'المحجة البيضاء', 'Al-Mahaja', GraduationCap],
    ['/contact', 'تواصل معنا', 'Contact', MessageCircle],
    ['/account', 'حسابي', 'My account', User],
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-[#211d45] shadow-lg shadow-[#211d45]/20" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <nav className="relative h-[76px] max-w-6xl mx-auto px-3 sm:px-6 flex items-center justify-between" dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Menu */}
        <button
          id="header-menu"
          onClick={() => setIsMenuOpen(true)}
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-white hover:bg-white/10 transition-colors"
          aria-label={isRTL ? 'القائمة' : 'Menu'}
          aria-expanded={isMenuOpen}
        >
          <Menu className="w-7 h-7" />
        </button>

        {/* Centered logo */}
        <Link to="/" id="header-logo" className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2" aria-label={isRTL ? 'جمعية عون وسند الخيرية — الرئيسية' : 'Home'}>
          <img src="/aoun-logo.png" alt={isRTL ? 'جمعية عون وسند الخيرية' : 'Awn & Sanad Charity'} className="h-[60px] w-auto" />
        </Link>

        {/* Notifications */}
        <div className="relative">
          <button
            id="header-bell"
            onClick={openNotifications}
            className="relative w-11 h-11 rounded-2xl flex items-center justify-center text-white hover:bg-white/10 transition-colors"
            aria-label={isRTL ? 'الإشعارات' : 'Notifications'}
          >
            <Bell className="w-6 h-6" />
            <AnimatePresence>
              {hasUnread && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  className="absolute top-2 end-2 w-3 h-3 bg-rose-500 rounded-full border-2 border-[#211d45]" />
              )}
            </AnimatePresence>
          </button>
          <NotificationPanel isNotifOpen={isNotifOpen} setIsNotifOpen={setIsNotifOpen} notifications={notifications} isRTL={isRTL} />
        </div>
      </nav>

      {/* Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <div className="fixed inset-0 z-[90]" dir={isRTL ? 'rtl' : 'ltr'}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)} />
            <motion.aside
              initial={{ x: isRTL ? '100%' : '-100%' }} animate={{ x: 0 }} exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute top-0 bottom-0 start-0 w-[86%] max-w-sm bg-white dark:bg-slate-900 shadow-2xl flex flex-col"
              aria-label={isRTL ? 'القائمة الرئيسية' : 'Main menu'}
            >
              <div className="bg-[#211d45] text-white p-5 pt-[calc(1.25rem+env(safe-area-inset-top))]">
                <div className="flex items-center justify-between mb-4">
                  <img src="/aoun-logo.png" alt="" className="h-12 w-auto" />
                  <button onClick={() => setIsMenuOpen(false)} className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center" aria-label={isRTL ? 'إغلاق' : 'Close'}>
                    <X className="w-6 h-6" />
                  </button>
                </div>
                {userProfile ? (
                  <div className="flex items-center gap-3">
                    {userProfile.avatar_url
                      ? <img src={userProfile.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-[#f7b2b0]" />
                      : <div className="w-12 h-12 rounded-full bg-[#f7b2b0] text-[#211d45] font-black text-lg flex items-center justify-center">{userProfile.full_name?.charAt(0)}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold truncate">{userProfile.full_name}</p>
                      {userProfile.unique_short_id && <p className="text-xs text-white/60" dir="ltr" style={{ textAlign: isRTL ? 'right' : 'left' }}>{userProfile.unique_short_id}</p>}
                    </div>
                    <button onClick={() => { setIsMenuOpen(false); setIsCardModalOpen(true); }}
                      className="px-3 py-2 rounded-xl bg-[#f7b2b0] text-[#211d45] text-xs font-black flex items-center gap-1.5 shrink-0">
                      <CreditCard className="w-4 h-4" /> {isRTL ? 'بطاقتي' : 'My card'}
                    </button>
                  </div>
                ) : !user ? (
                  <Link to="/auth" className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#f7b2b0] text-[#211d45] font-black">
                    <LogIn className="w-5 h-5" /> {isRTL ? 'تسجيل الدخول / إنشاء حساب' : 'Sign in / Register'}
                  </Link>
                ) : null}
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {links.map(([to, ar, en, Icon]) => (
                  <NavLink key={to} to={to} end={to === '/'}
                    className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-colors ${isActive ? 'bg-[#fde8e6] text-[#211d45] dark:bg-[#f7b2b0]/15 dark:text-[#f7b2b0]' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <Icon className="w-5 h-5 text-[#e2877f]" /> {isRTL ? ar : en}
                  </NavLink>
                ))}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-600 dark:text-slate-300">
                    <Globe className="w-4 h-4" />
                    <select aria-label="Language" value={language} onChange={e => setLanguage(e.target.value as 'ar' | 'fr' | 'en')} className="flex-1 bg-transparent outline-none">
                      <option value="ar">العربية</option><option value="fr">Français</option><option value="en">English</option>
                    </select>
                  </label>
                  <button id="header-theme-toggle" onClick={toggleTheme} className="px-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300" aria-label="Toggle theme">
                    {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </button>
                </div>
                {user && (
                  <button onClick={() => { setIsMenuOpen(false); void logout(); }}
                    className="w-full py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold flex items-center justify-center gap-2">
                    <LogOut className="w-5 h-5" /> {isRTL ? 'تسجيل الخروج' : 'Log out'}
                  </button>
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {userProfile && (
        <MembershipCardModal
          isOpen={isCardModalOpen}
          onClose={() => setIsCardModalOpen(false)}
        />
      )}
    </header>
  );
};
