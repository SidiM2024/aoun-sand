import { useState, useEffect } from 'react';
import { Sun, Moon, Globe, Bell, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { ActivePollsWidget } from './ActivePollsWidget';

export const Header = () => {
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();
  const isRTL = language === 'ar';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
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

    const subscription = supabase.channel('public:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications((prev) => [payload.new, ...prev].slice(0, 10));
        setHasUnread(true);
        // Also show browser notification if enabled
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(payload.new.title, { body: payload.new.message });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const openNotifications = () => {
    setHasUnread(false);
    setIsNotifOpen(!isNotifOpen);
    if (notifications.length > 0) {
      localStorage.setItem('last_notification_seen', new Date().toISOString());
    }
  };

  const languages = [
    { code: 'ar' as const, label: 'العربية', flag: '🇲🇷' },
    { code: 'fr' as const, label: 'Français', flag: '🇫🇷' },
    { code: 'en' as const, label: 'English', flag: '🇬🇧' },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
      ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-sm'
      : 'bg-white dark:bg-slate-900 shadow-sm'
      }`}>

      <nav className="px-4 py-3 max-w-md mx-auto flex items-center justify-between relative">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="relative overflow-hidden rounded-full shadow-md">
            <img
              src="/ABC.jpg"
              alt="Logo"
              className="h-9 w-9 object-cover transform group-hover:scale-110 transition-transform duration-500"
            />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-teal-600 to-cyan-600 dark:from-teal-400 dark:to-cyan-400 bg-clip-text text-transparent">
            {language === 'ar' ? 'عون وسند' : language === 'fr' ? 'Aide et Soutien' : 'Aid & Support'}
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={openNotifications}
              className="relative p-2 rounded-full hover:bg-slate-100 dark:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {hasUnread && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
              )}
            </button>
            
            <AnimatePresence>
              {isNotifOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsNotifOpen(false)}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                  >
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-md sticky top-0 z-10">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Bell className="w-5 h-5 text-indigo-500" />
                        {isRTL ? 'الإشعارات' : 'Notifications'}
                      </h3>
                      <button 
                        onClick={() => setIsNotifOpen(false)} 
                        className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full text-slate-500 dark:text-slate-300 transition-colors"
                      >
                        <X className="w-5 h-5"/>
                      </button>
                    </div>
                    
                    <div className="overflow-y-auto flex-1 p-4 space-y-4">
                      {/* Active Polls Section */}
                      <ActivePollsWidget />
                      
                      {/* Divider if polls exist and notifications exist */}
                      {notifications.length > 0 && <hr className="border-slate-100 dark:border-slate-700/50" />}

                      {notifications.length === 0 ? (
                        <div className="p-8 text-center flex flex-col items-center justify-center">
                          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          </div>
                          <p className="text-slate-500 font-medium">
                            {isRTL ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
                            {isRTL ? 'الإشعارات السابقة' : 'Recent Notifications'}
                          </h4>
                          {notifications.map((notif) => (
                            <div key={notif.id} className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700">
                              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-2">{notif.title}</h4>
                              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{notif.message}</p>
                              
                              {notif.link && (
                                <a href={notif.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:underline">
                                  {isRTL ? 'عرض الرابط' : 'View Link'}
                                </a>
                              )}
                              
                              {notif.media_url && (
                                <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                  {notif.media_type === 'video' ? (
                                    <video src={notif.media_url} controls className="w-full h-auto max-h-40 object-cover" />
                                  ) : (
                                    <img src={notif.media_url} alt="media" className="w-full h-auto max-h-40 object-cover" />
                                  )}
                                </div>
                              )}
                              
                              <span className="text-xs text-slate-400 dark:text-slate-500 mt-3 block font-medium">
                                {new Date(notif.created_at).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
                                  weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                })}
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

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 text-slate-600 dark:text-slate-300"
              aria-label="Change language"
            >
              <Globe className="w-5 h-5" />
            </button>

            <AnimatePresence>
              {isLangMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsLangMenuOpen(false)}></div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-2 z-50`}
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setIsLangMenuOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors flex items-center gap-3 ${language === lang.code ? 'text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-900/10' : 'text-slate-600 dark:text-slate-300'
                          }`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="font-medium">{lang.label}</span>
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
