import { useState, useEffect } from 'react';
import { Sun, Moon, Globe, Bell, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

export const Header = () => {
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen]       = useState(false);
  const [scrolled, setScrolled]             = useState(false);
  const [hasUnread, setHasUnread]           = useState(false);
  const [notifications, setNotifications]   = useState<any[]>([]);

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isRTL = language === 'ar';

  /* ── Scroll shadow ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    setIsNotifOpen(v => !v);
    if (notifications.length > 0) {
      localStorage.setItem('last_notification_seen', new Date().toISOString());
    }
  };

  const languages = [
    { code: 'ar' as const, label: 'العربية',  flag: '🇲🇷' },
    { code: 'fr' as const, label: 'Français',  flag: '🇫🇷' },
    { code: 'en' as const, label: 'English',   flag: '🇬🇧' },
  ];

  const brandName =
    language === 'ar' ? 'عون وسند' :
    language === 'fr' ? 'Aide & Soutien' :
                        'Awn & Sanad';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.1)] dark:shadow-[0_2px_20px_-4px_rgba(0,0,0,0.4)]'
          : 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-md'
      } border-b border-slate-200/50 dark:border-slate-800/50`}
    >
      <nav
        className="px-4 sm:px-6 py-3 max-w-5xl mx-auto flex items-center justify-between"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* ── Logo ── */}
        <Link
          to="/"
          id="header-logo"
          className="flex items-center gap-2.5 group shrink-0"
        >
          <div className="relative overflow-hidden rounded-full shadow-md ring-2 ring-indigo-500/20 group-hover:ring-indigo-500/50 transition-all">
            <img
              src="/ABC.jpg"
              alt="Logo"
              className="h-9 w-9 object-cover transform group-hover:scale-110 transition-transform duration-500"
            />
          </div>
          <span className="text-base font-black bg-gradient-to-r from-indigo-600 to-teal-600 dark:from-indigo-400 dark:to-teal-400 bg-clip-text text-transparent hidden sm:block">
            {brandName}
          </span>
        </Link>

        {/* ── User greeting (sm+) ── */}
        {userProfile?.full_name && (
          <button
            onClick={() => navigate('/account')}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full
              bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30
              text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {userProfile.full_name.charAt(0)}
            </div>
            <span className="max-w-[120px] truncate">{userProfile.full_name}</span>
          </button>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-1">

          {/* Notifications bell */}
          <div className="relative">
            <button
              id="header-bell"
              onClick={openNotifications}
              className="relative p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              <AnimatePresence>
                {hasUnread && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute top-1.5 end-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"
                  />
                )}
              </AnimatePresence>
            </button>

            {/* ── Notification panel ── */}
            <AnimatePresence>
              {isNotifOpen && (
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                  onClick={() => setIsNotifOpen(false)}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 30, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    onClick={e => e.stopPropagation()}
                    className="w-full max-w-md bg-white dark:bg-slate-900
                      rounded-3xl shadow-2xl overflow-hidden flex flex-col
                      max-h-[85vh]"
                    dir={isRTL ? 'rtl' : 'ltr'}
                  >
                    {/* Panel header */}
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Bell className="w-5 h-5 text-indigo-500" />
                        {isRTL ? 'الإشعارات والتصويتات' : 'Notifications & Polls'}
                      </h3>
                      <button
                        onClick={() => setIsNotifOpen(false)}
                        className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Scrollable content */}
                    <div className="overflow-y-auto flex-1 p-4 space-y-3">
                      {/* Notification list */}
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center flex flex-col items-center gap-3">
                          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                            <Bell className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                          </div>
                          <p className="text-slate-400 dark:text-slate-500 font-medium text-sm">
                            {isRTL ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-100 dark:border-slate-700/60"
                            >
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1.5">
                                {notif.title}
                              </h4>
                              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                                {notif.message}
                              </p>

                              {notif.link && (
                                <a
                                  href={notif.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-2 inline-block text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:underline"
                                >
                                  {isRTL ? 'عرض الرابط ↗' : 'View Link ↗'}
                                </a>
                              )}

                              {notif.media_url && (
                                <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                  {notif.media_type === 'video' ? (
                                    <video src={notif.media_url} controls className="w-full max-h-36 object-cover" />
                                  ) : (
                                    <img src={notif.media_url} alt="media" className="w-full max-h-36 object-cover" />
                                  )}
                                </div>
                              )}

                              <span className="text-[11px] text-slate-400 mt-2 block font-medium">
                                {new Date(notif.created_at).toLocaleDateString(
                                  isRTL ? 'ar-SA' : 'en-US',
                                  { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme toggle */}
          <button
            id="header-theme-toggle"
            onClick={toggleTheme}
            className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {/* Language picker */}
          <div className="relative">
            <button
              id="header-language"
              onClick={() => setIsLangMenuOpen(v => !v)}
              className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
              aria-label="Change language"
            >
              <Globe className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {isLangMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsLangMenuOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-44
                      bg-white dark:bg-slate-800 rounded-2xl shadow-xl
                      border border-slate-100 dark:border-slate-700 py-1.5 z-50 overflow-hidden`}
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => { setLanguage(lang.code); setIsLangMenuOpen(false); }}
                        className={`w-full px-4 py-2.5 text-start hover:bg-indigo-50 dark:hover:bg-indigo-900/20
                          transition-colors flex items-center gap-3 text-sm font-medium ${
                          language === lang.code
                            ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span>{lang.label}</span>
                        {language === lang.code && <span className="ms-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </nav>
    </header>
  );
};
