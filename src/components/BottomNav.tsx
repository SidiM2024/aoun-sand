import { Home, FolderHeart, HeartHandshake, CreditCard, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { motion } from 'framer-motion';

export const BottomNav = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const navItems = [
    { path: '/',           label: isRTL ? 'الرئيسية' : (language === 'fr' ? 'Accueil'  : 'Home'),       icon: Home          },
    { path: '/projects',   label: isRTL ? 'المشاريع' : (language === 'fr' ? 'Projets'  : 'Projects'),   icon: FolderHeart   },
    { path: '/donate',     label: isRTL ? 'التبرع'   : (language === 'fr' ? 'Don'      : 'Donate'),     icon: HeartHandshake},
    { path: '/membership', label: isRTL ? 'الانتساب' : (language === 'fr' ? 'Adhésion' : 'Membership'), icon: CreditCard    },
    { path: '/account',    label: isRTL ? 'الحساب'   : (language === 'fr' ? 'Compte'   : 'Account'),    icon: User          },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50
        bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl
        border-t border-slate-200/80 dark:border-slate-800/80
        shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.4)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <nav
        className="flex justify-around items-center h-16 max-w-lg mx-auto px-1"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path === '/account' && location.pathname === '/admin');

          return (
            <Link
              key={item.path}
              to={item.path}
              id={`bottom-nav-${item.path.replace('/', '') || 'home'}`}
              className="relative flex flex-col items-center justify-center flex-1 h-full pt-1"
            >
              {/* Active indicator pill */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-pill"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-gradient-to-r from-indigo-500 to-teal-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}

              <motion.div
                animate={{ scale: isActive ? 1.12 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <item.icon
                  className={`w-5 h-5 transition-all ${
                    isActive ? 'stroke-[2.2]' : 'stroke-[1.6]'
                  }`}
                />
                <span className={`text-[10px] font-semibold leading-none transition-all ${
                  isActive ? 'opacity-100' : 'opacity-60'
                }`}>
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
